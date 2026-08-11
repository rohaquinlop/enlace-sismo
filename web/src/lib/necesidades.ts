// Catálogo de necesidades y tipos de puntos de rescate.
// Los ids de NECESIDADES son espejo de la whitelist del worker
// (worker/src/puntos.ts — workspaces separados; mantener en sync).

export const NECESIDADES = [
  { id: "agua", label: "Agua potable" },
  { id: "comida", label: "Comida" },
  { id: "linternas", label: "Linternas" },
  { id: "palas", label: "Palas" },
  { id: "picos", label: "Picos" },
  { id: "mascarillas", label: "Mascarillas" },
  { id: "cuerdas", label: "Cuerdas" },
  { id: "botiquin", label: "Botiquín" },
  { id: "mantas", label: "Mantas" },
  { id: "maquinaria", label: "Maquinaria" },
  { id: "generador", label: "Generador eléctrico" },
  { id: "voluntarios", label: "Voluntarios" },
] as const;

export type NecesidadId = (typeof NECESIDADES)[number]["id"];

export const etiquetaNecesidad = (id: string): string =>
  NECESIDADES.find((n) => n.id === id)?.label ?? id;

export const TIPOS_PUNTO = [
  { id: "derrumbe", label: "Derrumbe / edificio colapsado" },
  { id: "deslizamiento", label: "Deslizamiento de tierra" },
  { id: "inundacion", label: "Inundación" },
  { id: "incendio", label: "Incendio" },
  { id: "punto-rescate", label: "Punto de rescate" },
  { id: "otro", label: "Otro" },
] as const;

export const etiquetaTipo = (id: string): string =>
  TIPOS_PUNTO.find((t) => t.id === id)?.label ?? id;

export const ESTADOS_PUNTO: Record<string, string> = {
  "sin-confirmar": "Sin confirmar",
  confirmado: "Confirmado",
  "en-curso": "Rescate en curso",
  resuelto: "Resuelto",
  falso: "Falso",
  promovido: "Promovido",
};

// Nivel de precisión del pin (vocabulario de coordenadas_nivel del proyecto).
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
