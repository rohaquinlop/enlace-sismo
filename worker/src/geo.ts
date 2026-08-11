// Utilidades geográficas del worker (workspace separado de la web).
// Haversine: copia de web/src/lib/geo.ts — no se comparte módulo entre workspaces.

const RADIO_TIERRA_KM = 6371;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/** Distancia en kilómetros entre dos coordenadas (fórmula de haversine). */
export function haversineKm(latA: number, lngA: number, latB: number, lngB: number): number {
  const dLat = aRadianes(latB - latA);
  const dLng = aRadianes(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(latA)) * Math.cos(aRadianes(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(a));
}
