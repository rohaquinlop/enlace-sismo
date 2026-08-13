// Catálogo de ítems de los puntos de ayuda y vocabulario de la UI.
// Los ids de ITEMS_AYUDA son espejo de la whitelist del worker
// (worker/src/ayuda.ts — workspaces separados; mantener en sync).
// El alimento es SOLO "alimentos-no-perecederos" (regla del proyecto: el
// transporte entre ciudades lejanas exige durabilidad). Los ids compartidos
// con data/acopios.json usan el MISMO id para que la cobertura funcione
// contra los acopios oficiales.

export const ITEMS_AYUDA = [
  { id: "agua", label: "Agua potable" },
  { id: "alimentos-no-perecederos", label: "Alimentos no perecederos" },
  { id: "medicamentos", label: "Medicamentos" },
  { id: "insumos-medicos", label: "Insumos médicos" },
  { id: "elementos-aseo", label: "Elementos de aseo" },
  { id: "cobijas", label: "Cobijas" },
  { id: "colchonetas", label: "Colchonetas" },
  { id: "camas", label: "Camas" },
  { id: "ropa", label: "Ropa" },
  { id: "calzado", label: "Calzado" },
  { id: "panales", label: "Pañales" },
  { id: "kits-cocina", label: "Kits de cocina" },
  { id: "carpas", label: "Carpas" },
  { id: "herramientas", label: "Herramientas" },
  { id: "linternas", label: "Linternas" },
  { id: "baterias", label: "Baterías" },
  { id: "generador", label: "Generador eléctrico" },
  { id: "combustible", label: "Combustible" },
  { id: "maquinaria", label: "Maquinaria" },
  { id: "voluntarios", label: "Voluntarios" },
  { id: "transporte", label: "Transporte" },
] as const;

export type ItemAyudaId = (typeof ITEMS_AYUDA)[number]["id"];

export interface ItemAyuda {
  tipo: "catalogo" | "personalizado";
  id?: string;
  nombre?: string;
  cantidad?: number;
  unidad?: string;
}

export const TIPOS_AYUDA = [
  { id: "acopio", label: "Punto de acopio" },
  { id: "albergue", label: "Albergue / refugio" },
  { id: "hospital", label: "Hospital / centro de salud" },
  { id: "otro", label: "Otro lugar" },
] as const;

export type TipoAyuda = (typeof TIPOS_AYUDA)[number]["id"];

export const MODALIDADES = [
  { id: "necesita", label: "Este lugar necesita ayuda" },
  { id: "recolecta", label: "Este lugar recolecta para otros" },
  { id: "ambos", label: "Necesita y recolecta" },
] as const;

export type Modalidad = (typeof MODALIDADES)[number]["id"];

export const ESTADOS_AYUDA: Record<string, string> = {
  "sin-confirmar": "Sin confirmar",
  confirmado: "Confirmado",
  cerrado: "Cerrado",
  falso: "Falso",
  promovido: "Promovido",
};

export const etiquetaItem = (id: string): string =>
  ITEMS_AYUDA.find((n) => n.id === id)?.label ?? id;

export const etiquetaTipo = (id: string): string =>
  TIPOS_AYUDA.find((t) => t.id === id)?.label ?? id;

export const etiquetaModalidad = (m: string): string =>
  MODALIDADES.find((x) => x.id === m)?.label ?? m;

/** Etiqueta corta de modalidad para tarjetas ("necesita" / "recolecta" / "ambos"). */
export const etiquetaModalidadCorta = (m: string): string =>
  m === "necesita" ? "Necesita" : m === "recolecta" ? "Recolecta" : "Necesita y recolecta";

/** Etiqueta de un ítem para chips: "Agua potable" · "insulina" · "200 camas". */
export function etiquetaItemAyuda(i: ItemAyuda): string {
  const base = i.tipo === "catalogo" ? etiquetaItem(i.id ?? "") : (i.nombre ?? "");
  if (i.cantidad === undefined) return base;
  return `${base} · ${i.cantidad}${i.unidad ? ` ${i.unidad}` : ""}`;
}

// Nivel de precisión del pin (vocabulario de coordenadas_nivel del proyecto;
// movido desde necesidades.ts, que desaparece con la lógica de rescates).
export type PrecisionPin = "premisa" | "via" | "barrio";

export const PRECISION_PUNTO: Record<PrecisionPin, string> = {
  premisa: "Edificio o punto exacto",
  via: "A nivel de calle",
  barrio: "A nivel de barrio",
};

export const PRECISION_CORTA: Record<PrecisionPin, string> = {
  premisa: "Edificio",
  via: "Calle",
  barrio: "Barrio",
};

export const etiquetaPrecision = (p?: string): string =>
  (p && PRECISION_PUNTO[p as PrecisionPin]) || "";
