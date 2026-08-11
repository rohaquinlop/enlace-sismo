-- Elimina la tabla desaparecidos (obsoleta): el registro ciudadano de personas
-- desaparecidas vive en ColombiaTeBusca (spec eliminacion-api.md, que se actualiza
-- al archivar el cambio reportar-zonas-afectadas). La tabla estaba vacía y sin
-- consumidores en el código.
DROP TABLE IF EXISTS desaparecidos;
