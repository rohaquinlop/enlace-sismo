// Lectura de catálogos verificados y registro en vivo (GitHub como almacén).
// GET /api/datos/:catalogo → el JSON del repo parseado tal cual (mismo shape
// que los imports de build), validado contra el schema del catálogo y
// cacheado en KV con envoltura { data, ts }: fresco <60 s, stale <6 h ante
// caída de GitHub. El repo es la fuente de verdad; KV es un acelerador
// desechable — si se pierde, el próximo request repuebla desde GitHub.
import { Hono, type Context } from "hono";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { Bindings } from "./index";
import { KV_REGISTRO } from "./github";
import verificadoSchema from "../../data/schema/verificado.schema.json";
import acopioSchema from "../../data/schema/acopio.schema.json";
import albergueSchema from "../../data/schema/albergue.schema.json";
import centroSaludSchema from "../../data/schema/centro-salud.schema.json";
import jornadaSangreSchema from "../../data/schema/jornada-sangre.schema.json";
import canalAyudaSchema from "../../data/schema/canal-ayuda.schema.json";
import zonasSchema from "../../data/schema/zonas.schema.json";
import contactoSchema from "../../data/schema/contacto.schema.json";
import puntoRescateSchema from "../../data/schema/punto-rescate.schema.json";
import reportePuntoSchema from "../../data/schema/reporte-punto.schema.json";

const REPO_DEFAULT = "rohaquinlop/enlace-sismo";
const UA = "enlace-sismo/1.0 (https://enlacesismo.com)";
const FRESCO_MS = 60_000; // datos servidos con ≤60 s de edad
const STALE_MS = 6 * 3_600_000; // ventana de stale ante caída de GitHub
const MAX_BYTES = 1024 * 1024; // tope defensivo por archivo
const HEADERS = { "Cache-Control": "public, max-age=30" };

// Los schemas de entrada referencian verificado.schema.json por $id
// (https://enlacesismo.com/schemas/verificado.schema.json): se registra antes
// de compilar (mismo cableado que scripts/validate-data.mjs). Los formatos
// (date/uri) se registran con ajv-formats: el worker valida igual que el CI.
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(verificadoSchema as never);

interface DefCatalogo {
  ruta: string;
  /** Propiedad que contiene el arreglo de entradas (null = el documento ES el arreglo). */
  campo: string | null;
  /** true: el documento completo se valida (evento, sin schema propio). */
  documento?: boolean;
  valida: (doc: unknown) => boolean;
  /** Clave KV propia (el registro la comparte con el write-through del worker). */
  clave?: string;
}

const compilar = (schema: unknown) => ajv.compile(schema as never);

// Espejo de CATALOGOS en scripts/validate-data.mjs (archivo → schema → clave).
const CATALOGOS: Record<string, DefCatalogo> = {
  acopios: { ruta: "data/acopios.json", campo: "acopios", valida: compilar(acopioSchema) },
  albergues: { ruta: "data/albergues.json", campo: "albergues", valida: compilar(albergueSchema) },
  "centros-salud": { ruta: "data/centros-salud.json", campo: "centros", valida: compilar(centroSaludSchema) },
  "donacion-sangre": { ruta: "data/donacion-sangre.json", campo: "jornadas", valida: compilar(jornadaSangreSchema) },
  "canales-ayuda": { ruta: "data/canales-ayuda.json", campo: null, valida: compilar(canalAyudaSchema) },
  "zonas-afectadas": { ruta: "data/zonas-afectadas.json", campo: null, valida: compilar(zonasSchema) },
  contactos: { ruta: "data/contactos.json", campo: null, valida: compilar(contactoSchema) },
  "puntos-rescate": { ruta: "data/puntos-rescate.json", campo: null, valida: compilar(puntoRescateSchema) },
  evento: {
    ruta: "data/evento.json",
    campo: null,
    documento: true,
    // Boletín SGC sin schema propio: espejo exacto de validate-data.mjs
    // (fuente, fuente_url, verificado_por, fecha_verificacion) para no
    // divergir del CI.
    valida: (doc) => {
      if (typeof doc !== "object" || doc === null) return false;
      const e = doc as Record<string, unknown>;
      return ["fuente", "fuente_url", "verificado_por", "fecha_verificacion"].every(
        (k) => typeof e[k] === "string" && String(e[k]).length > 0
      );
    },
  },
  registro: {
    ruta: "web/public/datos/reportes-puntos.json",
    campo: null,
    valida: compilar(reportePuntoSchema),
    clave: KV_REGISTRO,
  },
};

/** Valida las entradas de un catálogo (arreglo directo o bajo una propiedad). */
function validaEntradas(doc: unknown, campo: string | null, valida: (e: unknown) => boolean): boolean {
  const arr = campo === null ? doc : (doc as Record<string, unknown>)?.[campo];
  if (!Array.isArray(arr)) return false;
  return arr.every((e) => valida(e));
}

// Error de red/HTTP de GitHub (→ stale si hay caché; GitHub como almacén caído).
class GithubIndisponible extends Error {}
// El archivo en main no es JSON válido o es sospechoso (→ 502; nunca stale:
// servir stale enmascararía la corrupción del repo hasta 6 h).
class ContenidoInvalido extends Error {}

async function leerDeGithub(c: Context<Bindings>, ruta: string): Promise<unknown> {
  const repo = c.env.GITHUB_REPO ?? REPO_DEFAULT;
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/main/${ruta}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new GithubIndisponible(`GitHub ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new ContenidoInvalido("Archivo demasiado grande");
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new ContenidoInvalido("El archivo no es JSON válido");
  }
}

interface EnvolturaKV {
  data: unknown;
  ts: string;
}

const app = new Hono<Bindings>();

app.get("/:nombre", async (c) => {
  const nombre = c.req.param("nombre");
  const def = CATALOGOS[nombre];
  if (!def) return c.json({ error: "Catálogo no encontrado" }, 404);

  const clave = def.clave ?? `datos:v1:${nombre}`;
  let stale: EnvolturaKV | null = null;
  // KV es un acelerador desechable: si la lectura falla, se relee de GitHub.
  try {
    const cacheado = await c.env.KV.get(clave);
    if (cacheado !== null) {
      const env = JSON.parse(cacheado) as EnvolturaKV;
      const edad = Date.now() - Date.parse(env.ts);
      if (Number.isFinite(edad)) {
        if (edad < FRESCO_MS) return c.json(env.data, 200, HEADERS);
        if (edad < STALE_MS) stale = env; // respaldo si GitHub falla
      }
    }
  } catch {
    // Envoltura corrupta o KV caído: ignora y relee desde GitHub.
  }

  let data: unknown;
  try {
    data = await leerDeGithub(c, def.ruta);
  } catch (err) {
    if (err instanceof ContenidoInvalido) {
      // El archivo en main está protegido por CI; esto es doble seguro.
      return c.json({ error: "Datos inválidos en el repositorio" }, 502);
    }
    if (stale) return c.json(stale.data, 200, HEADERS);
    return c.json({ error: "No se pudieron leer los datos" }, 502);
  }
  const valido = def.documento ? def.valida(data) : validaEntradas(data, def.campo, def.valida);
  if (!valido) {
    // El archivo en main está protegido por CI; esto es doble seguro.
    return c.json({ error: "Datos inválidos en el repositorio" }, 502);
  }
  // Un fallo de escritura no descarta los datos frescos (KV desechable).
  await c.env.KV.put(clave, JSON.stringify({ data, ts: new Date().toISOString() } satisfies EnvolturaKV)).catch(
    () => {}
  );
  return c.json(data, 200, HEADERS);
});

export default app;
