-- Tramo 3, parte 3: Mesa de regalos y Playlist por permiso de herramienta.
--
-- REQUISITOS:
--   1. El codigo de esta tanda esta en produccion.
--   2. Ya corrio el cimiento del Tramo 2 (puede_* y log_borrado existen).
--   3. Ya corrio 2026-09-06-accesos-event-settings.sql, porque este archivo
--      vuelve a reemplazar guard_event_config y da por hecho sus dos guardas.
--
-- Estado leido de pg_policies el 5-sep-2026:
--   gift_registry_items  4 policies con el UNION inline por role IN (admin,editor)
--   gift_reservations    3 iguales (no tiene INSERT: las reservas del invitado
--                        entran por /api/mesa/[token] con service role)
--   song_recommendations songs_editor_write (ALL) + songs_member_select
--                        + songs_anon_select / songs_anon_insert por token
--
-- LO QUE NO SE TOCA, y es lo mas importante de este archivo:
-- **songs_anon_select y songs_anon_insert son la pagina publica del invitado.**
-- Se quedan exactamente como estan. Si desaparecen, los invitados dejan de
-- poder sugerir canciones y no nos enteramos hasta que alguien reclame.
--
-- VERIFICADO antes de escribirlo: la mesa de regalos publica entra por
-- /api/mesa/[token] con service role, que se salta RLS. Cambiar estas policies
-- no la afecta.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Regalos
-- ============================================================
DROP POLICY IF EXISTS "host read gift items"   ON public.gift_registry_items;
DROP POLICY IF EXISTS "host insert gift items" ON public.gift_registry_items;
DROP POLICY IF EXISTS "host update gift items" ON public.gift_registry_items;
DROP POLICY IF EXISTS "host delete gift items" ON public.gift_registry_items;

DROP POLICY IF EXISTS regalos_ver    ON public.gift_registry_items;
DROP POLICY IF EXISTS regalos_crear  ON public.gift_registry_items;
DROP POLICY IF EXISTS regalos_editar ON public.gift_registry_items;
DROP POLICY IF EXISTS regalos_borrar ON public.gift_registry_items;

CREATE POLICY regalos_ver ON public.gift_registry_items FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'regalos') );

CREATE POLICY regalos_crear ON public.gift_registry_items FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'regalos') );

CREATE POLICY regalos_editar ON public.gift_registry_items FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'regalos') )
  WITH CHECK ( public.puede_editar(event_id, 'regalos') );

CREATE POLICY regalos_borrar ON public.gift_registry_items FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'regalos') );

-- ============================================================
-- 2. Reservas de regalo
-- ============================================================
-- Las crea el invitado por service role. Aqui solo se gobierna lo que hace el
-- planner: leerlas y marcarlas agradecidas.
DROP POLICY IF EXISTS "host read gift reservations"   ON public.gift_reservations;
DROP POLICY IF EXISTS "host update gift reservations" ON public.gift_reservations;
DROP POLICY IF EXISTS "host delete gift reservations" ON public.gift_reservations;

DROP POLICY IF EXISTS reservas_ver    ON public.gift_reservations;
DROP POLICY IF EXISTS reservas_editar ON public.gift_reservations;
DROP POLICY IF EXISTS reservas_borrar ON public.gift_reservations;

CREATE POLICY reservas_ver ON public.gift_reservations FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'regalos') );

CREATE POLICY reservas_editar ON public.gift_reservations FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'regalos') )
  WITH CHECK ( public.puede_editar(event_id, 'regalos') );

CREATE POLICY reservas_borrar ON public.gift_reservations FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'regalos') );

-- No se crea policy de INSERT a proposito: hoy no existe, y el unico camino que
-- inserta reservas es el del invitado por service role. Agregarla seria abrir
-- algo que nadie usa.

-- ============================================================
-- 3. Playlist
-- ============================================================
DROP POLICY IF EXISTS songs_editor_write  ON public.song_recommendations;
DROP POLICY IF EXISTS songs_member_select ON public.song_recommendations;

DROP POLICY IF EXISTS playlist_ver    ON public.song_recommendations;
DROP POLICY IF EXISTS playlist_crear  ON public.song_recommendations;
DROP POLICY IF EXISTS playlist_editar ON public.song_recommendations;
DROP POLICY IF EXISTS playlist_borrar ON public.song_recommendations;

CREATE POLICY playlist_ver ON public.song_recommendations FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'playlist') );

CREATE POLICY playlist_crear ON public.song_recommendations FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'playlist') );

CREATE POLICY playlist_editar ON public.song_recommendations FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'playlist') )
  WITH CHECK ( public.puede_editar(event_id, 'playlist') );

CREATE POLICY playlist_borrar ON public.song_recommendations FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'playlist') );

-- songs_anon_select y songs_anon_insert NO se tocan. Son la puerta del invitado.

-- ============================================================
-- 4. La configuracion compartida
-- ============================================================
-- Los tokens publicos, los metodos de pago, la direccion de envio y las etapas
-- viven en event_settings, que es de toda la boda y se gobierna con
-- is_event_editor. Sin esto, alguien con regalos en 'ver' puede generar el link
-- publico o borrar un metodo de pago desde la puerta de atras.
--
-- Mismo parche consciente que budget_categories: la solucion de fondo es partir
-- event_settings por columna, y eso es el tramo de Configuracion.
--
-- ESTE BLOQUE REEMPLAZA guard_event_config OTRA VEZ, e incluye las dos guardas
-- de 2026-09-06-accesos-event-settings.sql. Correr ese archivo primero.
CREATE OR REPLACE FUNCTION public.guard_event_config()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  viejo jsonb := to_jsonb(OLD);
  nuevo jsonb := to_jsonb(NEW);
  eid uuid := (nuevo ->> TG_ARGV[0])::uuid;
  col text;
  i int;
  -- columna -> modulo que la gobierna
  por_modulo text[][] := ARRAY[
    ['budget_categories',         'presupuesto'],
    ['registry_token',            'regalos'],
    ['registry_payment_info',     'regalos'],
    ['registry_external_links',   'regalos'],
    ['registry_shipping_address', 'regalos'],
    ['playlist_token',            'playlist'],
    ['playlist_categories',       'playlist'],
    ['playlist_max_songs',        'playlist']
  ];
BEGIN
  -- Sin sesion de usuario final no hay rol que aplicar: service role, cron y el
  -- editor SQL pasan derecho.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- El dueno se comprueba ANTES que nada y no lo salta ni el admin: cambiar
  -- user_id no es configurar el evento, es quedarselo.
  IF TG_TABLE_NAME = 'events'
     AND (viejo -> 'user_id') IS DISTINCT FROM (nuevo -> 'user_id')
     AND (viejo ->> 'user_id')::uuid IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Solo el dueno del evento puede transferirlo'
      USING ERRCODE = '42501';
  END IF;

  -- Cada columna de configuracion que pertenece a una herramienta pide el
  -- permiso de ESA herramienta, no el de admin del evento.
  IF TG_TABLE_NAME = 'event_settings' THEN
    FOR i IN 1 .. array_length(por_modulo, 1) LOOP
      IF (viejo -> por_modulo[i][1]) IS DISTINCT FROM (nuevo -> por_modulo[i][1])
         AND NOT public.puede_editar(eid, por_modulo[i][2])
      THEN
        RAISE EXCEPTION 'No tienes acceso para cambiar la configuracion de %', por_modulo[i][2]
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  IF public.is_event_admin(eid) THEN RETURN NEW; END IF;

  FOR i IN 1 .. TG_NARGS - 1 LOOP
    col := TG_ARGV[i];
    IF (viejo -> col) IS DISTINCT FROM (nuevo -> col) THEN
      RAISE EXCEPTION 'Solo el administrador del evento puede cambiar %', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

-- ============================================================
-- 5. La bitacora de borrados
-- ============================================================
DROP TRIGGER IF EXISTS log_borrado_regalo ON public.gift_registry_items;
CREATE TRIGGER log_borrado_regalo
  AFTER DELETE ON public.gift_registry_items
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('regalos', 'gift_item', 'title');

DROP TRIGGER IF EXISTS log_borrado_cancion ON public.song_recommendations;
CREATE TRIGGER log_borrado_cancion
  AFTER DELETE ON public.song_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('playlist', 'song', 'song_title');

-- OJO: si gift_registry_items no tiene columna `title`, el disparador guarda la
-- fila completa igual y solo deja la etiqueta vacia. Comprobar con:
-- select column_name from information_schema.columns
--  where table_name = 'gift_registry_items' order by 1;

COMMIT;

-- ============ Verificacion ============
-- 1) Cuatro policies en regalos, tres en reservas, y en playlist SEIS
--    (las cuatro nuevas mas las dos anon, que siguen vivas):
SELECT tablename, count(*) AS policies FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('gift_registry_items', 'gift_reservations', 'song_recommendations')
 GROUP BY tablename ORDER BY tablename;

-- 2) LO MAS IMPORTANTE: las dos policies del invitado siguen ahi. Debe dar 2.
SELECT count(*) AS puerta_del_invitado FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'song_recommendations'
   AND policyname IN ('songs_anon_select', 'songs_anon_insert');

-- 3) Ninguna policy vieja sobrevivio (cero filas):
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname = 'public'
   AND (policyname LIKE 'host %gift%' OR policyname IN ('songs_editor_write', 'songs_member_select'));

-- 4) La funcion trae las tres guardas:
SELECT prosrc LIKE '%Solo el dueno del evento puede transferirlo%' AS guarda_dueno,
       prosrc LIKE '%la configuracion de%'                         AS guarda_por_modulo
  FROM pg_proc WHERE proname = 'guard_event_config';

-- 5) Los dos disparadores:
SELECT tgrelid::regclass AS tabla, tgname FROM pg_trigger
 WHERE tgname IN ('log_borrado_regalo', 'log_borrado_cancion') ORDER BY 1;

-- ============ Marcha atras ============
-- BEGIN;
-- DROP TRIGGER IF EXISTS log_borrado_regalo ON public.gift_registry_items;
-- DROP TRIGGER IF EXISTS log_borrado_cancion ON public.song_recommendations;
--
-- DROP POLICY IF EXISTS regalos_ver ON public.gift_registry_items;
-- DROP POLICY IF EXISTS regalos_crear ON public.gift_registry_items;
-- DROP POLICY IF EXISTS regalos_editar ON public.gift_registry_items;
-- DROP POLICY IF EXISTS regalos_borrar ON public.gift_registry_items;
-- CREATE POLICY "host read gift items" ON public.gift_registry_items FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active'));
-- CREATE POLICY "host insert gift items" ON public.gift_registry_items FOR INSERT
--   WITH CHECK (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
-- CREATE POLICY "host update gift items" ON public.gift_registry_items FOR UPDATE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
-- CREATE POLICY "host delete gift items" ON public.gift_registry_items FOR DELETE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
--
-- DROP POLICY IF EXISTS reservas_ver ON public.gift_reservations;
-- DROP POLICY IF EXISTS reservas_editar ON public.gift_reservations;
-- DROP POLICY IF EXISTS reservas_borrar ON public.gift_reservations;
-- CREATE POLICY "host read gift reservations" ON public.gift_reservations FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active'));
-- CREATE POLICY "host update gift reservations" ON public.gift_reservations FOR UPDATE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
-- CREATE POLICY "host delete gift reservations" ON public.gift_reservations FOR DELETE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
--
-- DROP POLICY IF EXISTS playlist_ver ON public.song_recommendations;
-- DROP POLICY IF EXISTS playlist_crear ON public.song_recommendations;
-- DROP POLICY IF EXISTS playlist_editar ON public.song_recommendations;
-- DROP POLICY IF EXISTS playlist_borrar ON public.song_recommendations;
-- CREATE POLICY songs_editor_write ON public.song_recommendations FOR ALL
--   USING (is_event_editor(event_id)) WITH CHECK (is_event_editor(event_id));
-- CREATE POLICY songs_member_select ON public.song_recommendations FOR SELECT
--   USING (is_event_member(event_id));
--
-- Y para guard_event_config, reinstalar la version de
-- 2026-09-06-accesos-event-settings.sql.
-- COMMIT;
