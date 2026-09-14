-- Seguridad, Tramo 1b. CORRER SOLO DESPUES DE QUE /api/playlist/[token] ESTE
-- EN PRODUCCION (PR de fix/seguridad-anon-playlist mergeado y deploy listo).
-- Si se corre antes, la playlist publica deja de cargar.
--
-- Cierra la lectura de TODOS los eventos. Hoy:
--   * "Public can read events via playlist token": anon Y cualquier cuenta leen
--     la fila completa de todo evento con playlist (son todos).
--   * "public can read event_settings by token": roles public, asi que
--     cualquier cuenta logueada lee TODAS las columnas: CLABE, direccion de
--     envio, shared_token, review_token. anon lee 13 columnas por grant.
--   * songs_anon_select / songs_anon_insert: anon lee y escribe canciones de
--     cualquier evento.
--
-- Nada legitimo depende de estas policies (verificado 14-sep): el dueno entra
-- por "owner only", el colaborador por "collaborators can read events" /
-- "collaborators can read event_settings" / playlist_ver, y las paginas
-- publicas van por API con service role.

BEGIN;

DROP POLICY IF EXISTS "Public can read events via playlist token" ON public.events;
DROP POLICY IF EXISTS "public can read event_settings by token" ON public.event_settings;
DROP POLICY IF EXISTS songs_anon_select ON public.song_recommendations;
DROP POLICY IF EXISTS songs_anon_insert ON public.song_recommendations;

-- Quita tambien los 13 grants por columna (revocar el de tabla arrastra los de columna).
REVOKE SELECT ON public.event_settings FROM anon;

DO $$
DECLARE usan text;
BEGIN
  SELECT string_agg(schemaname || '.' || tablename || ' / ' || policyname, ', ') INTO usan
    FROM pg_policies
   WHERE coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ 'event_has_playlist_token';
  IF usan IS NOT NULL THEN
    RAISE EXCEPTION 'No se cambio nada. Todavia usan event_has_playlist_token: %', usan;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.event_has_playlist_token(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

-- Verificacion: policies_abiertas = [], anon_columnas_settings = 0, lo demas false.
SELECT jsonb_build_object(
  'policies_abiertas', (
    SELECT coalesce(jsonb_agg(tablename || ' / ' || policyname), '[]'::jsonb)
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('events', 'event_settings', 'song_recommendations')
       AND (roles && array['anon', 'public']::name[]
            OR coalesce(qual, '') || coalesce(with_check, '') ~ 'playlist_token')),
  'anon_columnas_settings', (
    SELECT count(*) FROM pg_attribute a
     WHERE a.attrelid = 'public.event_settings'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       AND has_column_privilege('anon', 'public.event_settings', a.attnum, 'SELECT')),
  'anon_event_has_playlist_token', has_function_privilege('anon', 'public.event_has_playlist_token(uuid)', 'EXECUTE')
) AS resultado;

-- Despues, desde la terminal: node --env-file=.env.local scripts/rls-audit.mjs
-- debe decir RESULTADO: TODO CERRADO.

-- COMO REVERTIR (solo si algo se rompe; regresa el hueco):
-- GRANT EXECUTE ON FUNCTION public.event_has_playlist_token(uuid) TO anon, authenticated;
-- GRANT SELECT (agent_config, album_url, budget_categories, created_at, event_id, id, message_templates,
--   playlist_categories, playlist_max_songs, playlist_token, registry_token, template_names, updated_at)
--   ON public.event_settings TO anon;
-- CREATE POLICY "Public can read events via playlist token" ON public.events
--   FOR SELECT TO anon, authenticated USING (event_has_playlist_token(id));
-- CREATE POLICY "public can read event_settings by token" ON public.event_settings
--   FOR SELECT TO public USING (playlist_token IS NOT NULL);
-- CREATE POLICY songs_anon_select ON public.song_recommendations
--   FOR SELECT TO anon USING (event_has_playlist_token(event_id));
-- CREATE POLICY songs_anon_insert ON public.song_recommendations
--   FOR INSERT TO anon WITH CHECK (event_has_playlist_token(event_id));
