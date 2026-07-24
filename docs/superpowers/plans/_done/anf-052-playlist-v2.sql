-- ANF-052: limite configurable + canciones de los novios.
-- Lo corre Diego ANTES de probar en local (el codigo nuevo selecciona estas
-- columnas explicitamente). Inerte para prod: el codigo en main no las referencia.
-- DEFAULT false hace que las filas existentes lean false.

BEGIN;

ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS playlist_max_songs INTEGER;
ALTER TABLE song_recommendations ADD COLUMN IF NOT EXISTS is_host_pick BOOLEAN DEFAULT false;

-- ANF-049 dejo el SELECT de anon en event_settings con grant por columna;
-- la pagina publica necesita leer la columna nueva:
GRANT SELECT (playlist_max_songs) ON event_settings TO anon;

COMMIT;
