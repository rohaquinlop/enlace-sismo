import acopiosData from "../../../data/acopios.json";
import alberguesData from "../../../data/albergues.json";
import centrosSaludData from "../../../data/centros-salud.json";
import donacionSangreData from "../../../data/donacion-sangre.json";

export interface Verificado {
  fuente: string;
  verificado_por: string;
  fecha_verificacion: string;
  verificacion: "oficial" | "confirmado" | "sin-confirmar";
}

export interface Acopio extends Verificado {
  id: string;
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel?: "premisa" | "via" | "barrio";
  tipo?: "oficial-comunal" | "oficial-gobierno" | "no-oficial";
  horario?: string;
  necesidades?: string[];
  detalles?: string;
  estado: "abierto" | "cerrado" | "sin-confirmar";
  contacto?: string;
  fecha_limite?: string;
  recoleccion_periodica?: boolean;
  recoleccion_detalle?: string;
  evidencia_links?: string[];
  imagen_url?: string;
}

export interface Albergue extends Verificado {
  id: string;
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel?: "premisa" | "via" | "barrio";
  capacidad?: number;
  ocupacion?: number;
  admite_mascotas?: boolean;
  servicios?: string[];
  estado: "abierto" | "cerrado" | "sin-confirmar";
  tipo: "albergue" | "refugio";
  contacto?: string;
}

export interface CentroSalud extends Verificado {
  id: string;
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel?: "premisa" | "via" | "barrio";
  tipo: "hospital" | "clinica" | "punto-primeros-auxilios" | "puesto-vacunacion";
  estado: "operativo" | "limitado" | "cerrado" | "sin-confirmar";
  urgencias_24h?: boolean;
  contacto?: string;
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
export const acopios: Acopio[] = acopiosData.acopios as Acopio[];
export const albergues: Albergue[] = alberguesData.albergues as Albergue[];
export const centrosSalud: CentroSalud[] = centrosSaludData.centros as CentroSalud[];
export const jornadasSangre: JornadaSangre[] = donacionSangreData.jornadas as JornadaSangre[];

export const todasLasCiudades: string[] = Array.from(
  new Set([...acopios, ...albergues, ...centrosSalud, ...jornadasSangre].map((e) => e.ciudad))
).sort();

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
