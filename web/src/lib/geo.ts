// Utilidades geográficas compartidas (build y cliente).
// Haversine: distancia de círculo máximo entre dos puntos.

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

/** Formatea kilómetros al estilo es-CO: "0,8 km" bajo 1 km; enteros con separador de miles. */
export function formatearDistancia(km: number): string {
  if (km < 1) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km).toLocaleString("es-CO")} km`;
}
