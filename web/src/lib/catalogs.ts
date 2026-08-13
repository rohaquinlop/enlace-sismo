import donacionSangreData from "../../../data/donacion-sangre.json";

// NOTA (cambio catalogos-comunitarios): los catálogos de lugares (acopios,
// albergues, centros de salud) viven en el registro unificado de puntos de
// ayuda (D1 vía GET /api/ayuda + snapshot SSG web/public/datos/reportes-ayuda.json).
// Los tipos Acopio/Albergue/CentroSalud y data/acopios.json|albergues.json|
// centros-salud.json quedaron como registro histórico del seed; aquí solo
// quedan los catálogos estáticos (jornadas de sangre y canales de ayuda).

export interface Verificado {
  fuente: string;
  verificado_por: string;
  fecha_verificacion: string;
  verificacion: "oficial" | "confirmado" | "sin-confirmar";
}

export interface JornadaSangre extends Verificado {
  id: string;
  organizador: string;
  punto: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel?: "premisa" | "via" | "barrio";
  fecha_inicio: string;
  fecha_fin?: string;
  horario: string;
  grupos?: string[];
  estado: "activa" | "finalizada" | "sin-confirmar";
  contacto?: string;
}

/** Canal de ayuda verificado (data/canales-ayuda.json; schema canal-ayuda.schema.json). */
export interface CanalAyuda extends Verificado {
  id: string;
  organizacion: string;
  tipo: "donacion-oficial" | "coordinacion-oficial" | "voluntariado" | "informacion-oficial";
  descripcion?: string;
  como_aportar?: string;
  sitio?: string;
  redes?: string;
  /** SOLO si la entidad oficial la publicó (regla de seguridad: estado 'oficial' + 2 aprobaciones). */
  cuenta_bancaria?: string;
  estado: "oficial" | "confirmado" | "sin-confirmar";
}

// Los datos se validan contra data/schema/* en CI (npm run validate:data); la
// inferencia de resolveJsonModule produce `string` donde los schemas exigen
// enums. El cast en la frontera tipa el JSON con los contratos del proyecto.
export const jornadasSangre: JornadaSangre[] = donacionSangreData.jornadas as JornadaSangre[];

export interface CiudadGrupo<T> {
  ciudad: string;
  items: T[];
  lat: number;
  lng: number;
}

export function agruparPorCiudad<T extends { ciudad: string; lat: number; lng: number }>(
  items: T[]
): CiudadGrupo<T>[] {
  const grupos = new Map<string, T[]>();
  for (const item of items) {
    const key = item.ciudad;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(item);
  }
  return Array.from(grupos.entries())
    .map(([ciudad, items]) => ({
      ciudad,
      items,
      lat: items.reduce((s, i) => s + i.lat, 0) / items.length,
      lng: items.reduce((s, i) => s + i.lng, 0) / items.length,
    }))
    .sort((a, b) => a.ciudad.localeCompare(b.ciudad));
}
