-- Puntos de ayuda: registro en vivo (fase de coordinación post-72 h).
-- D1 es el almacén; el worker valida cada entrada con Ajv contra
-- data/schema/punto-ayuda.schema.json antes de escribir (contrato único).
CREATE TABLE IF NOT EXISTS puntos_ayuda (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('acopio','albergue','hospital','otro')),
  modalidad TEXT NOT NULL CHECK (modalidad IN ('necesita','recolecta','ambos')),
  nombre TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  coordenadas_nivel TEXT NOT NULL CHECK (coordenadas_nivel IN ('premisa','via','barrio')),
  ciudad TEXT,
  direccion TEXT,
  descripcion TEXT NOT NULL,
  -- JSON: arreglo de ítems { tipo: catalogo|personalizado, id?, nombre?, cantidad?, unidad? }
  items TEXT NOT NULL,
  -- JSON: { transporta: boolean, ciudades: string[], nota?: string }
  destino TEXT,
  horario TEXT,
  contacto TEXT,
  estado TEXT NOT NULL DEFAULT 'sin-confirmar'
    CHECK (estado IN ('sin-confirmar','confirmado','cerrado','falso','promovido')),
  -- JSON: arreglo { detalle, ip_hash, created_at }
  flags TEXT NOT NULL DEFAULT '[]',
  -- JSON: arreglo { ip_hash, created_at }
  ediciones TEXT NOT NULL DEFAULT '[]',
  token_hash TEXT,
  enlazado_a TEXT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ultima_actualizacion TEXT NOT NULL,
  fuente TEXT,
  verificado_por TEXT,
  fecha_verificacion TEXT,
  verificacion TEXT
    CHECK (verificacion IN ('oficial','confirmado','sin-confirmar')),
  CHECK (json_valid(items)),
  CHECK (json_valid(flags)),
  CHECK (json_valid(ediciones))
);

CREATE INDEX IF NOT EXISTS idx_puntos_ayuda_ciudad ON puntos_ayuda(ciudad);
CREATE INDEX IF NOT EXISTS idx_puntos_ayuda_estado ON puntos_ayuda(estado);
