import zonasData from "../../../data/zonas-afectadas.json";

export interface Zona {
  id: string;
  nombre: string;
  tipo: "epicentro" | "ciudad";
  lat: number;
  lng: number;
  /** Intensidad Mercalli reportada (I–XII). Solo con fuente verificable; sin reporte, omitir. */
  intensidad?: number;
  detalle?: string;
  fuente: string;
  verificado_por: string;
  fecha_verificacion: string;
  verificacion: "oficial" | "confirmado" | "sin-confirmar";
}

export const zonas: Zona[] = zonasData;
