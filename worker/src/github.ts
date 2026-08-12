// Escritura del registro en vivo de puntos de rescate (GitHub como almacén).
// El worker es el ÚNICO escritor de web/public/datos/reportes-puntos.json:
// lee → muta → valida contra el schema → commitea con retry ante conflicto de sha.
// Los contribuidores editan el mismo archivo por PR; el CI lo protege.
import type { Context } from "hono";
import Ajv2020 from "ajv/dist/2020.js";
import type { Bindings } from "./index";
// Schema compartido con el repo (data/schema/reporte-punto.schema.json).
import reportePuntoSchema from "../../data/schema/reporte-punto.schema.json";

const REPO_DEFAULT = "rohaquinlop/enlace-sismo";
const RUTA = "web/public/datos/reportes-puntos.json";
const UA = "enlace-sismo/1.0 (https://enlacesismo.com)";
const MAX_INTENTOS = 3;


export interface Confirmacion {
  bucket: string;
  ip_hash: string;
  created_at: string;
}

export interface Flag {
  detalle: string;
  ip_hash: string;
  created_at: string;
}

export interface Edicion {
  ip_hash: string;
  created_at: string;
}

export interface EntradaPunto {
  id: string;
  tipo: string;
  lat: number;
  lng: number;
  coordenadas_nivel: "premisa" | "via" | "barrio";
  ciudad?: string;
  direccion?: string;
  descripcion: string;
  necesidades: string[];
  otras_necesidades?: string;
  contacto?: string;
  estado: string;
  confirmaciones: Confirmacion[];
  flags: Flag[];
  ultima_confirmacion?: string;
  ediciones?: Edicion[];
  ip_hash: string;
  created_at: string;
  // Campos de verificación (opcionales: se agregan al promover)
  nombre?: string;
  fuente?: string;
  verificado_por?: string;
  fecha_verificacion?: string;
  verificacion?: "oficial" | "confirmado" | "sin-confirmar";
}

/** Error de dominio del registro; lleva el status HTTP que debe devolver la ruta. */
export class RegistroError extends Error {
  constructor(
    message: string,
    readonly status = 409
  ) {
    super(message);
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const valida = ajv.compile(reportePuntoSchema as never);

// Workers no tiene Buffer: base64 ↔ UTF-8 con TextEncoder/Decoder.
function base64Decode(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function base64Encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

async function apiGithub(c: Context<Bindings>, path: string, init?: RequestInit): Promise<Response> {
  const token = c.env.GITHUB_TOKEN;
  if (!token) throw new RegistroError("GITHUB_TOKEN no configurado", 503);
  return fetch(`https://api.github.com${path}`, {    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": UA,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
}

/** Repositorio destino del registro (env para deploys desde fork). */
const repoDe = (c: Context<Bindings>): string => c.env.GITHUB_REPO ?? REPO_DEFAULT;

/** Lee el registro en vivo (contenido + sha para el commit optimista). */
export async function leerRegistro(c: Context<Bindings>): Promise<{ entradas: EntradaPunto[]; sha: string }> {
  const res = await apiGithub(c, `/repos/${repoDe(c)}/contents/${RUTA}`);
  if (!res.ok) throw new RegistroError(`No se pudo leer el registro (${res.status})`, 503);
  const data = (await res.json()) as { content: string; sha: string };
  let entradas: unknown;
  try {
    entradas = JSON.parse(base64Decode(data.content));
  } catch {
    throw new RegistroError("El registro en vivo no es JSON válido", 503);
  }
  if (!Array.isArray(entradas)) throw new RegistroError("El registro en vivo no es un arreglo", 503);
  return { entradas: entradas as EntradaPunto[], sha: data.sha };
}

/**
 * Lee, muta, valida y commitea el registro en un solo paso.
 * La mutación lanza RegistroError para abortar sin escribir (no se reintenta);
 * un 409 del PUT (conflicto concurrente) se reintenta hasta MAX_INTENTOS.
 */
export async function escribirRegistro(
  c: Context<Bindings>,
  mutar: (entradas: EntradaPunto[]) => EntradaPunto[]
): Promise<void> {
  let ultimo: RegistroError | null = null;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const { entradas, sha } = await leerRegistro(c);
    const nuevas = mutar(entradas);
    // El schema es por entrada (type: object): se valida cada una, no el
    // arreglo (espejo de validate-data.mjs).
    for (const e of nuevas) {
      if (!valida(e)) {
        const err = valida.errors?.[0];
        throw new RegistroError(
          `El registro resultante no valida: ${err?.instancePath ?? "/"} ${err?.message ?? "desconocido"}`,
          503
        );
      }
    }
    const res = await apiGithub(c, `/repos/${repoDe(c)}/contents/${RUTA}`, {
      method: "PUT",
      body: JSON.stringify({
        message: "reporte: actualizar puntos de rescate en vivo",
        content: base64Encode(JSON.stringify(nuevas, null, 2) + "\n"),
        sha,
      }),
    });
    if (res.ok) return;
    if (res.status === 409) {
      ultimo = new RegistroError("Conflicto concurrente al escribir el registro", 503);
      continue;
    }
    throw new RegistroError(`No se pudo commitear el registro (${res.status})`, 503);
  }
  throw ultimo ?? new RegistroError("No se pudo commitear el registro", 503);
}
