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
  horario?: string;
  necesidades?: string[];
  estado: "abierto" | "cerrado" | "sin-confirmar";
  contacto?: string;
}

export interface Albergue extends Verificado {
  id: string;
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  capacidad?: number;
  ocupacion?: number;
  admite_mascotas?: boolean;
  servicios?: string[];
  estado: "abierto" | "cerrado" | "sin-confirmar";
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
  fecha_inicio: string;
  fecha_fin?: string;
  horario: string;
  grupos?: string[];
  estado: "activa" | "finalizada" | "sin-confirmar";
  contacto?: string;
}

export const acopios: Acopio[] = acopiosData.acopios;
export const albergues: Albergue[] = alberguesData.albergues;
export const centrosSalud: CentroSalud[] = centrosSaludData.centros;
export const jornadasSangre: JornadaSangre[] = donacionSangreData.jornadas;

export const todasLasCiudades: string[] = Array.from(
  new Set([...acopios, ...albergues, ...centrosSalud, ...jornadasSangre].map((e) => e.ciudad))
).sort();
