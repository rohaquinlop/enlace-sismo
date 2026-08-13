// Puntos de ayuda (registro en vivo, D1): tipos de la proyección pública del
// API (GET /api/ayuda), visibilidad y cobertura oferta↔demanda.
// El worker escribe la forma interna (flags como arreglo); el front solo ve
// la proyección pública (flags como conteo, sin datos de IP).
import type { ItemAyuda, Modalidad, PrecisionPin, TipoAyuda } from "./items-ayuda";
import type { Acopio } from "./catalogs";
import { nombreCiudadNormalizado } from "./ciudades";

/** Punto de ayuda — proyección pública (GET /api/ayuda y snapshot SSG). */
export interface PuntoAyuda {
  id: string;
  tipo: TipoAyuda;
  modalidad: Modalidad;
  nombre?: string;
  lat: number;
  lng: number;
  coordenadas_nivel?: PrecisionPin;
  ciudad?: string;
  direccion?: string;
  descripcion: string;
  items: ItemAyuda[];
  destino?: { transporta: boolean; ciudades: string[]; nota?: string };
  horario?: string;
  contacto?: string;
  estado: string;
  flags: number;
  enlazado_a?: string;
  fuente?: string;
  verificado_por?: string;
  fecha_verificacion?: string;
  verificacion?: "oficial" | "confirmado" | "sin-confirmar";
  created_at: string;
  ultima_actualizacion: string;
}

const ESTADOS_VISIBLES = ["sin-confirmar", "confirmado", "promovido"];
export const MAX_FLAGS_AYUDA = 3;

/**
 * Un punto se muestra si su estado lo permite y tiene menos de 3 flags.
 * Sin degradación automática por antigüedad (decidido en diseño): la
 * vigencia la renueva el autor al actualizar y la cierra él o el mantenedor.
 */
export function puntoAyudaVisible(p: PuntoAyuda): boolean {
  return ESTADOS_VISIBLES.includes(p.estado) && p.flags < MAX_FLAGS_AYUDA;
}

export function esOferta(p: PuntoAyuda): boolean {
  return p.modalidad === "recolecta" || p.modalidad === "ambos";
}

/** Ids de catálogo que declara un punto (los personalizados no matchean). */
function idsDeItems(items: ItemAyuda[]): Set<string> {
  const ids = new Set<string>();
  for (const i of items) {
    if (i.tipo === "catalogo" && i.id) ids.add(i.id);
  }
  return ids;
}

/**
 * Resumen de cobertura de una necesidad: PUNTOS ÚNICOS que la cubren
 * (ofertas en vivo con modalidad recolecta/ambos + acopios oficiales del
 * catálogo) en la misma ciudad (nombre normalizado). Un punto que cubre
 * varios ítems cuenta una sola vez. Los ítems personalizados no participan.
 */
export function resumenCobertura(
  punto: PuntoAyuda,
  vivos: PuntoAyuda[],
  acopiosOficiales: Acopio[]
): { puntosEnVivo: number; acopiosOficiales: number } {
  const miCiudad = nombreCiudadNormalizado(punto.ciudad ?? "");
  const necesitados = idsDeItems(punto.items);
  const cubre = (items: ItemAyuda[]): boolean => {
    for (const id of idsDeItems(items)) {
      if (necesitados.has(id)) return true;
    }
    return false;
  };
  const puntosUnicos = new Set<string>();
  for (const p of vivos) {
    if (p.id === punto.id || !esOferta(p) || !puntoAyudaVisible(p)) continue;
    if (nombreCiudadNormalizado(p.ciudad ?? "") !== miCiudad) continue;
    if (cubre(p.items)) puntosUnicos.add(p.id);
  }
  const acopiosUnicos = new Set<string>();
  for (const a of acopiosOficiales) {
    if (a.estado === "cerrado" || !Array.isArray(a.necesidades)) continue;
    if (miCiudad && nombreCiudadNormalizado(a.ciudad) !== miCiudad) continue;
    if ((a.necesidades ?? []).some((n) => necesitados.has(n))) acopiosUnicos.add(a.id);
  }
  return { puntosEnVivo: puntosUnicos.size, acopiosOficiales: acopiosUnicos.size };
}

/** Texto de la línea de cobertura de una tarjeta ("" si nada la cubre). */
export function lineaCobertura(punto: PuntoAyuda, vivos: PuntoAyuda[], acopiosOficiales: Acopio[]): string {
  const r = resumenCobertura(punto, vivos, acopiosOficiales);
  const total = r.puntosEnVivo + r.acopiosOficiales;
  if (total === 0) return "";
  return `Cubierto por ${total} punto${total === 1 ? "" : "s"} en tu ciudad`;
}

/** Timestamp desde el que un punto está visible (para "actualizado hace X"). */
export function actualizadoHace(p: PuntoAyuda, ahora = Date.now()): string {
  const t = Date.parse(p.ultima_actualizacion ?? p.created_at);
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((ahora - t) / 60_000));
  if (mins < 60) return mins <= 1 ? "hace un momento" : `hace ${mins} min`;
  const horas = Math.round(mins / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} d`;
}

export interface ItemAgregado {
  id: string;
  /** Puntos que lo necesitan (modalidad necesita/ambos). */
  puntos: number;
  /** Suma de cantidades declaradas (0 si nadie declara cantidad). */
  suma: number;
  /** true si algún punto lo declara sin cantidad (la suma es un mínimo). */
  incompleto: boolean;
}

/**
 * Agrega los ítems de catálogo que necesitan los puntos (modalidad
 * necesita/ambos): suma las CANTIDADES declaradas y cuenta los puntos.
 * La tarjeta muestra "Insumos médicos · 10"; el agregado debe mostrar el
 * MISMO número (×10), no solo el conteo de puntos (×1), o no tiene sentido.
 */
export function agregarItemsNecesarios(vivos: PuntoAyuda[]): ItemAgregado[] {
  const mapa = new Map<string, ItemAgregado>();
  for (const p of vivos) {
    if (p.modalidad !== "necesita" && p.modalidad !== "ambos") continue;
    for (const i of p.items) {
      if (i.tipo !== "catalogo" || !i.id) continue;
      const agg = mapa.get(i.id) ?? { id: i.id, puntos: 0, suma: 0, incompleto: false };
      agg.puntos += 1;
      if (i.cantidad !== undefined) agg.suma += i.cantidad;
      else agg.incompleto = true;
      mapa.set(i.id, agg);
    }
  }
  return Array.from(mapa.values()).sort(
    (a, b) => b.puntos - a.puntos || a.id.localeCompare(b.id, "es")
  );
}

/**
 * Valor del agregado: "10" (suma de cantidades), "10+" (mínimo: algún punto
 * no declaró cantidad) o "2" (conteo de puntos, cuando nadie declaró
 * cantidades — el prefijo "N puntos necesitan" da el contexto).
 */
export function etiquetaAgregado(a: ItemAgregado): string {
  if (a.suma > 0) return `${a.suma}${a.incompleto ? "+" : ""}`;
  return String(a.puntos);
}
