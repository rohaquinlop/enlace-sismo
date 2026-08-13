-- Catálogos comunitarios (fase unificada): columnas opcionales de los
-- catálogos seedeados (acopios/albergues/centros-salud → puntos_ayuda).
-- Todo default NULL: los puntos ciudadanos no las usan; las escriben el
-- seed y el mantenedor. Booleans como INTEGER 0/1; arreglos como JSON TEXT.
-- Espejo de las propiedades opcionales de data/schema/punto-ayuda.schema.json.
ALTER TABLE puntos_ayuda ADD COLUMN subtipo TEXT;
ALTER TABLE puntos_ayuda ADD COLUMN departamento TEXT;
ALTER TABLE puntos_ayuda ADD COLUMN capacidad INTEGER;
ALTER TABLE puntos_ayuda ADD COLUMN ocupacion INTEGER;
ALTER TABLE puntos_ayuda ADD COLUMN admite_mascotas INTEGER;
ALTER TABLE puntos_ayuda ADD COLUMN servicios TEXT;
ALTER TABLE puntos_ayuda ADD COLUMN urgencias_24h INTEGER;
ALTER TABLE puntos_ayuda ADD COLUMN recoleccion_periodica INTEGER;
ALTER TABLE puntos_ayuda ADD COLUMN recoleccion_detalle TEXT;
ALTER TABLE puntos_ayuda ADD COLUMN evidencia_links TEXT;
ALTER TABLE puntos_ayuda ADD COLUMN imagen_url TEXT;
