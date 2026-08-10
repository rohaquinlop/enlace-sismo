-- Migración inicial de Enlace Sismo.
-- Tablas dinámicas: alertas oficiales, personas desaparecidas y reportes de errores.
-- Los catálogos (acopios, albergues, salud) viven en el repositorio (data/) y se
-- publican por PRs verificados; aquí solo está lo que necesita actualización en vivo.

CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  fuente TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'normal',
  creado_por TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS desaparecidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  edad INTEGER,
  ciudad TEXT NOT NULL,
  lugar TEXT,
  fecha TEXT,
  descripcion TEXT,
  contacto TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'buscando',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reportes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  ref_id TEXT,
  detalle TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_desaparecidos_estado ON desaparecidos(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_created ON alertas(created_at);
