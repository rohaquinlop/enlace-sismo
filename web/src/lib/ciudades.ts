// Ciudades derivadas de los reportes ciudadanos en vivo.
// La ciudad es un atributo del reporte (nunca un dato sísmico): el catálogo
// SGC no se toca; las ciudades reportadas se deduplican por nombre normalizado.
import type { PuntoVivo } from "./puntos-rescate";
import { puntoActivo } from "./puntos-rescate";

export interface CiudadReportada {
  nombre: string;
  puntos: PuntoVivo[];
  /** Centroide (media de lat/lng de sus puntos) — destino del vuelo del mapa. */
  lat: number;
  lng: number;
}

/** Agrupa los puntos activos por ciudad (solo los que tienen `ciudad`). */
export function agruparCiudades(vivos: PuntoVivo[], ahora = Date.now()): CiudadReportada[] {
  const grupos = new Map<string, PuntoVivo[]>();
  for (const p of vivos) {
    if (!p.ciudad || !puntoActivo(p, ahora)) continue;
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

/** Unión sin duplicados de ciudades catalogadas y reportadas, orden es-CO. */
export function fusionarCiudadesSelect(catalogadas: string[], reportadas: string[]): string[] {
  return Array.from(new Set([...catalogadas, ...reportadas])).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}
