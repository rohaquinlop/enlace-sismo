// Registro en vivo de puntos de rescate: crear, confirmar, flag y estado (admin).
// El almacén es web/public/datos/reportes-puntos.json (GitHub como almacén);
// las lecturas son estáticas — este router solo escribe.
import { Hono, type Context } from "hono";
import { rateLimit, type Bindings } from "./index";
import { haversineKm } from "./geo";
import { reverseGeocode, normalizarCiudad } from "./geocodificar";
import { escribirRegistro, RegistroError, type EntradaPunto } from "./github";

const TIPOS = ["derrumbe", "deslizamiento", "inundacion", "incendio", "punto-rescate", "otro"];
// Espejo de web/src/lib/necesidades.ts (workspaces separados; mantener en sync).
const NECESIDADES = [
  "agua", "comida", "linternas", "palas", "picos", "mascarillas",
  "cuerdas", "botiquin", "mantas", "maquinaria", "generador", "voluntarios",
];
const ESTADOS_ADMIN = ["confirmado", "en-curso", "resuelto", "falso", "promovido"];
const ESTADOS_ACTIVOS = ["sin-confirmar", "confirmado", "en-curso"];
const RADIO_CONFIRMACION_KM = 1;
const MAX_DESCRIPCION = 1000;
const MAX_DETALLE_FLAG = 500;

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Celda ~1 km para privacidad: nunca se guarda la posición exacta del confirmante. */
function bucketDe(lat: number, lng: number): string {
  return `${(Math.round(lat * 100) / 100).toFixed(2)},${(Math.round(lng * 100) / 100).toFixed(2)}`;
}

function manejarRegistroError(c: Context<Bindings>, e: unknown): Response {
  if (e instanceof RegistroError) {
    return c.json({ error: e.message }, e.status as 400 | 401 | 403 | 404 | 409 | 429 | 503);
  }
  throw e;
}

const app = new Hono<Bindings>();

// ---------- Crear reporte ciudadano ----------
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);
  // Honeypot: si el bot llenó "website", responder 200 silencioso.
  if (body.website) return c.json({ ok: true });
  if (!(await rateLimit(c, "rl:puntos", 5))) {
    return c.json({ error: "Demasiados reportes. Intenta en una hora." }, 429);
  }

  const tipo = String(body.tipo ?? "");
  if (!TIPOS.includes(tipo)) return c.json({ error: "tipo inválido" }, 400);

  // Nivel de precisión del pin (vocabulario del proyecto: premisa/via/barrio).
  // Lo decide el formulario según el origen del punto (GPS/clic = premisa,
  // resultado de búsqueda = su precisión) y lo valida el servidor.
  const coordenadasNivel = String(body.coordenadas_nivel ?? "");
  if (!["premisa", "via", "barrio"].includes(coordenadasNivel)) {
    return c.json({ error: "coordenadas_nivel debe ser premisa, via o barrio" }, 400);
  }
  const nivelPin = coordenadasNivel as "premisa" | "via" | "barrio";

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return c.json({ error: "lat debe estar entre -90 y 90" }, 400);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return c.json({ error: "lng debe estar entre -180 y 180" }, 400);

  const necesidades = Array.isArray(body.necesidades) ? body.necesidades.map(String) : [];
  for (const n of necesidades) {
    if (!NECESIDADES.includes(n)) return c.json({ error: `necesidad inválida: ${n}` }, 400);
  }
  if (new Set(necesidades).size !== necesidades.length) {
    return c.json({ error: "necesidades duplicadas" }, 400);
  }

  const descripcion = String(body.descripcion ?? "").slice(0, MAX_DESCRIPCION);
  const otrasNecesidades = String(body.otras_necesidades ?? "").slice(0, 300);
  const contacto = body.contacto ? String(body.contacto).slice(0, 200) : undefined;

  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ipHash = await hashIp(ip);
  const ahora = new Date().toISOString();

  const entrada: EntradaPunto = {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    tipo,
    lat,
    lng,
    coordenadas_nivel: nivelPin,
    descripcion,
    necesidades: Array.from(new Set(necesidades)),
    estado: "sin-confirmar",
    confirmaciones: [],
    flags: [],
    ultima_confirmacion: ahora,
    ip_hash: ipHash,
    created_at: ahora,
  };
  if (otrasNecesidades) entrada.otras_necesidades = otrasNecesidades;
  if (contacto) entrada.contacto = contacto;
  // Reverse geocode con fallback: lat/lng son la fuente de verdad. La ciudad
  // se guarda normalizada y es opcional (el filtro la usa; sin ella, el punto
  // se oculta bajo un filtro de ciudad activo).
  const rev = await reverseGeocode(c, lat, lng);
  if (rev.direccion) entrada.direccion = rev.direccion;
  if (rev.ciudad) {
    const ciudad = normalizarCiudad(rev.ciudad);
    if (ciudad) entrada.ciudad = ciudad;
  }

  try {
    await escribirRegistro(c, (entradas) =>
      // Idempotente: si el PUT aplicó pero la respuesta se perdió, el retry
      // relee el archivo con la entrada ya presente — no duplicar.
      entradas.some((e) => e.id === entrada.id) ? entradas : [...entradas, entrada]
    );
  } catch (e) {
    return manejarRegistroError(c, e);
  }
  return c.json({ ok: true, id: entrada.id }, 201);
});

// ---------- Confirmar con geolocalización (cercanía ≤ 1 km, 1 por IP) ----------
app.post("/:id/confirmar", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return c.json({ error: "coordenadas inválidas" }, 400);
  }
  if (!(await rateLimit(c, "rl:confirmar", 10))) {
    return c.json({ error: "Demasiadas confirmaciones. Espera un momento." }, 429);
  }

  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ipHash = await hashIp(ip);

  try {
    await escribirRegistro(c, (entradas) => {
      const punto = entradas.find((p) => p.id === id);
      if (!punto) throw new RegistroError("Punto no encontrado", 404);
      if (!ESTADOS_ACTIVOS.includes(punto.estado)) {
        throw new RegistroError("Este punto ya no está activo");
      }
      if (haversineKm(lat, lng, punto.lat, punto.lng) > RADIO_CONFIRMACION_KM) {
        throw new RegistroError("Estás a más de 1 km del punto");
      }
      if (punto.confirmaciones.some((cf) => cf.ip_hash === ipHash)) {
        throw new RegistroError("Ya confirmaste este punto");
      }
      const ahora = new Date().toISOString();
      punto.confirmaciones.push({ bucket: bucketDe(lat, lng), ip_hash: ipHash, created_at: ahora });
      punto.ultima_confirmacion = ahora;
      return entradas;
    });
  } catch (e) {
    return manejarRegistroError(c, e);
  }
  return c.json({ ok: true });
});

// ---------- Reportar punto falso (3+ flags lo ocultan del dashboard) ----------
app.post("/:id/flag", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const detalle = String(body.detalle ?? "");
  if (detalle.length < 3) return c.json({ error: "detalle es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!(await rateLimit(c, "rl:reportes", 20))) {
    return c.json({ error: "Demasiados reportes. Espera un momento." }, 429);
  }

  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ipHash = await hashIp(ip);

  try {
    await escribirRegistro(c, (entradas) => {
      const punto = entradas.find((p) => p.id === id);
      if (!punto) throw new RegistroError("Punto no encontrado", 404);
      // Coherente con confirmar: los puntos cerrados no se flaggean.
      if (!ESTADOS_ACTIVOS.includes(punto.estado)) {
        throw new RegistroError("Este punto ya no está activo");
      }
      if (punto.flags.some((f) => f.ip_hash === ipHash)) {
        throw new RegistroError("Ya reportaste este punto");
      }
      punto.flags.push({ detalle: detalle.slice(0, MAX_DETALLE_FLAG), ip_hash: ipHash, created_at: new Date().toISOString() });
      return entradas;
    });
  } catch (e) {
    return manejarRegistroError(c, e);
  }
  return c.json({ ok: true });
});

// ---------- Estado (admin): resuelto / falso / promovido / confirmado / en-curso ----------
app.post("/:id/estado", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token || token !== c.env.ADMIN_TOKEN) return c.json({ error: "No autorizado" }, 401);

  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const estado = String(body.estado ?? "");
  if (!ESTADOS_ADMIN.includes(estado)) return c.json({ error: "estado inválido" }, 400);

  try {
    await escribirRegistro(c, (entradas) => {
      const punto = entradas.find((p) => p.id === id);
      if (!punto) throw new RegistroError("Punto no encontrado", 404);
      punto.estado = estado;
      return entradas;
    });
  } catch (e) {
    return manejarRegistroError(c, e);
  }
  return c.json({ ok: true });
});

export default app;
