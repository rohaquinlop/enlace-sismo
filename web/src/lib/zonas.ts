import zonasData from "../../../data/zonas-afectadas.json";

export interface Zona {
  id: string;
  nombre: string;
  tipo: "epicentro" | "ciudad";
  lat: number;
  lng: number;
  detalle?: string;
  fuente: string;
  verificado_por: string;
  fecha_verificacion: string;
  verificacion: "oficial" | "confirmado" | "sin-confirmar";
}

export const zonas: Zona[] = zonasData;
