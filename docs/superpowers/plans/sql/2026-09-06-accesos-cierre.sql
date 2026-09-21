-- Tramo 3, cierre: Dress code, Invitacion y Mensajes.
--
-- Con esto los doce modulos del catalogo quedan gobernados por permiso de
-- herramienta, tanto en la pantalla como en la base.
--
-- REQUISITOS: los archivos anteriores del tramo ya corrieron. Este vuelve a
-- reemplazar guard_event_config y da por hecho todo lo que le agregaron
-- -accesos-event-settings.sql y -accesos-regalos-playlist.sql.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Mensajes (historial legacy)
-- ============================================================
-- wa_messages solo tenia dos policies, las dos contra events.user_id: ni de
-- colaborador, ni de UPDATE, ni de DELETE. Era el segundo hueco del tamano de
-- Finanzas; no se noto porque el inbox esta gateado al correo de Diego.
DROP POLICY IF EXISTS wa_messages_select_own ON public.wa_messages;
DROP POLICY IF EXISTS wa_messages_insert_own ON public.wa_messages;

DROP POLICY IF EXISTS mensajes_ver   ON public.wa_messages;
DROP POLICY IF EXISTS mensajes_crear ON public.wa_messages;

CREATE POLICY mensajes_ver ON public.wa_messages FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'mensajes') );

CREATE POLICY mensajes_crear ON public.wa_messages FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'mensajes') );

-- No se agregan UPDATE ni DELETE: hoy no existen y ninguna pantalla los usa.
-- Un historial de conversacion no se edita ni se borra a mano.
--
-- PENDIENTE, y hay que decirlo: el inbox de verdad no vive aqui. Vive en
-- `conversations` y `messages` del nucleo omnicanal, cuyas policies NO se han
-- leido. Enviar un mensaje entra por /api/omnichannel/send con service role, y
-- prender el agente escribe `conversations.ai_enabled` directo desde el cliente.
-- Ese UPDATE sigue gobernado por lo que sea que tenga `conversations` hoy.
-- Cerrarlo pide leer esas policies primero.

-- ============================================================
-- 2. La configuracion compartida, ahora completa
-- ============================================================
-- Se agregan las columnas de dress code y de invitacion al mapa columna ->
-- modulo. Con esto quedan las once columnas de event_settings que pertenecen a
-- una herramienta concreta.
CREATE OR REPLACE FUNCTION public.guard_event_config()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  viejo jsonb := to_jsonb(OLD);
  nuevo jsonb := to_jsonb(NEW);
  eid uuid := (nuevo ->> TG_ARGV[0])::uuid;
  col text;
  i int;
  por_modulo text[][] := ARRAY[
    ['budget_categories',         'presupuesto'],
    ['registry_token',            'regalos'],
    ['registry_payment_info',     'regalos'],
    ['registry_external_links',   'regalos'],
    ['registry_shipping_address', 'regalos'],
    ['playlist_token',            'playlist'],
    ['playlist_categories',       'playlist'],
    ['playlist_max_songs',        'playlist'],
    ['dress_code',                'vestimenta'],
    ['invite_config',             'invitacion'],
    ['invite_draft',              'invitacion']
  ];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'events'
     AND (viejo -> 'user_id') IS DISTINCT FROM (nuevo -> 'user_id')
     AND (viejo ->> 'user_id')::uuid IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Solo el dueno del evento puede transferirlo'
      USING ERRCODE = '42501';
  END IF;

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

COMMIT;

-- ============ Verificacion ============
-- 1) Las dos policies de wa_messages, y ninguna vieja:
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'wa_messages' ORDER BY cmd;
-- Esperado: mensajes_crear (INSERT) y mensajes_ver (SELECT). Nada mas.

-- 2) La funcion trae las once columnas mapeadas:
SELECT prosrc LIKE '%dress_code%'    AS tiene_vestimenta,
       prosrc LIKE '%invite_draft%'  AS tiene_invitacion,
       prosrc LIKE '%playlist_token%' AS tiene_playlist
  FROM pg_proc WHERE proname = 'guard_event_config';
-- Esperado: true / true / true

-- 3) Los dos disparadores siguen activos:
SELECT tgrelid::regclass AS tabla, tgname, tgenabled
  FROM pg_trigger WHERE tgname LIKE 'guard_%config';

-- 4) La prueba real, con la sesion del DUENO: abrir el dress code, cambiar algo
--    y guardar; abrir la invitacion, editar y publicar. Deben funcionar igual.

-- ============ Marcha atras ============
-- BEGIN;
-- DROP POLICY IF EXISTS mensajes_ver ON public.wa_messages;
-- DROP POLICY IF EXISTS mensajes_crear ON public.wa_messages;
-- CREATE POLICY wa_messages_select_own ON public.wa_messages FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- CREATE POLICY wa_messages_insert_own ON public.wa_messages FOR INSERT
--   WITH CHECK (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- Y para guard_event_config, reinstalar la version de
-- 2026-09-06-accesos-regalos-playlist.sql (sin las tres columnas nuevas).
-- COMMIT;
