// Registro unificado de puntos de rescate (web/public/datos/reportes-puntos.json).
// Un punto comienza como reporte ciudadano; cuando un mantenedor lo verifica,
// agrega nombre, fuente, verificado_por, fecha_verificacion y verificacion
// en el mismo registro.

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

export interface EdicionViva {
  ip_hash: string;
  created_at: string;
}

/** Punto de rescate (registro unificado: ciudadano + verificado). */
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
  ediciones?: EdicionViva[];
  ip_hash: string;
  created_at: string;
  // Campos de verificación (opcionales: se agregan al promover)
  nombre?: string;
  fuente?: string;
  verificado_por?: string;
  fecha_verificacion?: string;
  verificacion?: "oficial" | "confirmado" | "sin-confirmar";
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
