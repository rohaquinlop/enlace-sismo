// Picker de ubicación compartido (UbicacionPicker.astro).
// Tipos, constantes de eventos y dedupe ≤150 m usados por el componente
// y por las páginas que lo integran (/reportar y formularios de sugerencia).

import { haversineKm } from "./geo";
import type { PrecisionPin } from "./items-ayuda";

/** Entrada contra la que deduplicar (catálogo verificado del tipo elegido). */
export interface DedupeItem {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  ciudad: string;
  tipo: string;
  url?: string; // enlace a la ficha en el catálogo
}

/** Detalle del evento `enlace:ubicacion:fijada`. */
export interface UbicacionFijada {
  lat: number;
  lng: number;
  direccion: string | null;
  coordenadas_nivel: PrecisionPin;
}

/** Detalle del evento `enlace:ubicacion:fijar` (pin programático). */
export interface FijarPinEvento {
  lat: number;
  lng: number;
  /** Precisión del pin existente (p. ej. al editar un punto). */
  precision?: PrecisionPin;
}

/** Detalle del evento `enlace:ubicacion:dedupe`. */
export interface DedupeEvento {
  candidato: DedupeItem | null;
}

/** El pin se fijó (GPS, clic, arrastre, búsqueda o coordenadas manuales). */
export const EVENTO_FIJADA = "enlace:ubicacion:fijada";
/** La página pide al picker fijar un pin programáticamente (p. ej. modo edición). */
export const EVENTO_FIJAR = "enlace:ubicacion:fijar";
/** Hay (o dejó de haber) un candidato de dedupe a ≤150 m. */
export const EVENTO_DEDUPE = "enlace:ubicacion:dedupe";
/** La página pide al picker reiniciarse (p. ej. tras un envío exitoso). */
export const EVENTO_REINICIAR = "enlace:ubicacion:reiniciar";

export const RADIO_DEDUPE_KM = 0.15; // 150 m

/** El ítem más cercano a ≤150 m, o null. */
export function dedupeCerca(
  items: DedupeItem[],
  lat: number,
  lng: number
): DedupeItem | null {
  let mejor: DedupeItem | null = null;
  let mejorDist = RADIO_DEDUPE_KM;
  for (const item of items) {
    const d = haversineKm(lat, lng, item.lat, item.lng);
    if (d <= mejorDist) {
      mejorDist = d;
      mejor = item;
    }
  }
  return mejor;
}
