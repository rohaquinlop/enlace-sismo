// Registro en vivo de puntos de rescate (web/public/datos/reportes-puntos.json)
// y catálogo verificado (data/puntos-rescate.json).
// Tipos y reglas de visibilidad compartidos por el dashboard y el formulario.

export interface ConfirmacionViva {
  bucket: string;
  ip_hash: string;
  created_at: string;
}

export interface FlagVivo {
  detalle: string;
  ip_hash: string;
  created_at: string;
}

/** Entrada del registro en vivo: reporte ciudadano sin verificación. */
export interface PuntoVivo {
  id: string;
  tipo: string;
  lat: number;
  lng: number;
  coordenadas_nivel?: "premisa" | "via" | "barrio";
  ciudad?: string;
  direccion?: string;
  descripcion: string;
  necesidades: string[];
  otras_necesidades?: string;
  contacto?: string;
  estado: string;
  confirmaciones: ConfirmacionViva[];
  flags: FlagVivo[];
  ultima_confirmacion?: string;
  ip_hash: string;
  created_at: string;
}

/** Entrada del catálogo verificado (promovida tras verificación contra fuente). */
export interface PuntoVerificado {
  id: string;
  nombre: string;
  tipo: string;
  ciudad: string;
  lat: number;
  lng: number;
  coordenadas_nivel?: "premisa" | "via" | "barrio";
  direccion: string;
  descripcion?: string;
  necesidades?: string[];
  otras_necesidades?: string;
  contacto?: string;
  estado: "confirmado" | "en-curso" | "resuelto";
  reporte_id?: string;
  created_at?: string;
  fuente: string;
}

export const HORAS_ACTIVO = 72;
export const MAX_FLAGS = 3;

const ESTADOS_ACTIVOS = ["sin-confirmar", "confirmado", "en-curso"];

/**
 * Un punto está activo si su estado lo permite, tiene menos de MAX_FLAGS y
 * recibió confirmación (o fue creado) hace menos de HORAS_ACTIVO horas.
 * Degradación calculada en cliente; el archivo conserva todo.
 */
export function puntoActivo(p: PuntoVivo, ahora = Date.now()): boolean {
  if (!ESTADOS_ACTIVOS.includes(p.estado)) return false;
  if (p.flags.length >= MAX_FLAGS) return false;
  const base = p.ultima_confirmacion ?? p.created_at;
  const t = Date.parse(base);
  if (Number.isNaN(t)) return false;
  return ahora - t < HORAS_ACTIVO * 3_600_000;
}

/** Timestamp desde el que un punto está inactivo (null si está activo). */
export function inactivoDesde(p: PuntoVivo): number | null {
  if (puntoActivo(p)) return null;
  const base = p.ultima_confirmacion ?? p.created_at;
  const t = Date.parse(base);
  return Number.isNaN(t) ? null : t;
}

/** Agrega necesidades de un conjunto de puntos: { id, cuenta } ordenado desc. */
export function agregarNecesidades(puntos: Array<Pick<PuntoVivo, "necesidades">>): Array<{ id: string; cuenta: number }> {
  const conteo = new Map<string, number>();
  for (const p of puntos) {
    for (const n of p.necesidades) conteo.set(n, (conteo.get(n) ?? 0) + 1);
  }
  return Array.from(conteo.entries())
    .map(([id, cuenta]) => ({ id, cuenta }))
    .sort((a, b) => b.cuenta - a.cuenta);
}
