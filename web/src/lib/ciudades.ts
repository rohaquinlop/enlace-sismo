// Ciudades derivadas de los puntos de ayuda en vivo (registro D1).
// La ciudad es un atributo del punto (nunca un dato sísmico): el catálogo
// SGC no se toca; las ciudades reportadas se deduplican por nombre normalizado.
import type { PuntoAyuda } from "./puntos-ayuda";
import { puntoAyudaVisible } from "./puntos-ayuda";

export interface CiudadReportada {
  nombre: string;
  puntos: PuntoAyuda[];
  /** Centroide (media de lat/lng de sus puntos) — destino del vuelo del mapa. */
  lat: number;
  lng: number;
}

/** Compara nombres de ciudad sin sensibilidad a acentos/caja ("Bogotá" = "bogota"). */
export const nombreCiudadNormalizado = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Agrupa los puntos visibles por ciudad (solo los que tienen `ciudad`).
 *  Con `soloCiudadanos` excluye los puntos `promovido` (entradas curadas del
 *  seed): la sección de ciudades reportadas señala reportes comunitarios, no
 *  lugares ya verificados. */
export function agruparCiudades(vivos: PuntoAyuda[], opts: { soloCiudadanos?: boolean } = {}): CiudadReportada[] {
  const grupos = new Map<string, PuntoAyuda[]>();
  for (const p of vivos) {
    if (!p.ciudad || !puntoAyudaVisible(p)) continue;
    if (opts.soloCiudadanos && p.estado === "promovido") continue;
    const lista = grupos.get(p.ciudad) ?? [];
    lista.push(p);
    grupos.set(p.ciudad, lista);
  }
  return Array.from(grupos.entries())
    .map(([nombre, puntos]) => ({
      nombre,
      puntos,
      lat: puntos.reduce((s, p) => s + p.lat, 0) / puntos.length,
      lng: puntos.reduce((s, p) => s + p.lng, 0) / puntos.length,
    }))
    .sort((a, b) => b.puntos.length - a.puntos.length || a.nombre.localeCompare(b.nombre, "es"));
}

/** Unión sin duplicados de ciudades catalogadas y reportadas, orden es-CO.
 *  El dedupe ignora acentos y caja: "Bogotá" y "bogota" son la misma ciudad. */
export function fusionarCiudadesSelect(catalogadas: string[], reportadas: string[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const nombre of [...catalogadas, ...reportadas]) {
    const clave = nombreCiudadNormalizado(nombre);
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(nombre);
  }
  return salida.sort((a, b) => a.localeCompare(b, "es"));
}
