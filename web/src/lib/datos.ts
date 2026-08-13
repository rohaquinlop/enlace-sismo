// Refresco runtime de datos (desacoplar-datos-deploy): los catálogos y el
// registro en vivo se leen del API (GET /api/datos/:catalogo — worker + KV
// con GitHub como almacén) con el baseline SSG como respaldo. Si el API falla
// o tarda, devuelve null y la página conserva lo renderizado en build
// (nunca pantalla en blanco ni listas vacías por culpa del refresco).
// Los puntos de ayuda se leen de GET /api/ayuda (D1, API público) con el
// snapshot SSG web/public/datos/reportes-ayuda.json como respaldo.
import { apiUrl } from "./api";
import type { PuntoAyuda } from "./puntos-ayuda";

const TIMEOUT_MS = 4000;

/**
 * Lee un catálogo fresco del API. Devuelve el documento parseado tal cual
 * (mismo shape que el import de build) o null si el API no responde, responde
 * no-OK o devuelve algo que no es objeto/arreglo. El llamador decide el
 * fallback (por defecto: conservar el SSG ya renderizado).
 */
export async function fetchCatalogo<T>(nombre: string): Promise<T | null> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(`/api/datos/${encodeURIComponent(nombre)}`), {
      headers: { Accept: "application/json" },
      signal: control.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    if (data === null || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lee los puntos de ayuda frescos del API público (GET /api/ayuda, D1).
 * Devuelve el arreglo o null si el API no responde; el llamador decide el
 * fallback (snapshot SSG o el estado actual de la página).
 */
export async function fetchPuntosAyuda(): Promise<PuntoAyuda[] | null> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl("/api/ayuda"), {
      headers: { Accept: "application/json" },
      signal: control.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as PuntoAyuda[]) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
