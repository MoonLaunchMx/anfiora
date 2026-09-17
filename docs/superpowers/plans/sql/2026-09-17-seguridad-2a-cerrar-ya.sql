-- Seguridad, Tramo 2a. Cuatro candados que NO dependen de ningun deploy:
-- se puede correr ya, antes o despues de cualquier PR.
--
-- Sale del Paso 0 del Tramo 2 (2026-09-15-seguridad-2-0-verificacion.sql,
-- corrido en produccion el 17-sep):
--
--   1. Bitacora. audit_member_insert deja que cualquier miembro escriba
--      cualquier fila, incluido un "guest.deleted" inventado con old_value a
--      su gusto. /api/actividad/restaurar lo reinserta con service role. Los
--      borrados y restauraciones reales NO vienen del navegador: los escriben
--      log_borrado* (security definer, dueno postgres) y la ruta restaurar
--      (service role). Ninguno de los dos pasa por esta policy.
--   2. Mesa de regalos. guard_event_config de 2026-09-09-reviews-link-cliente
--      reemplazo al de 2026-09-06-accesos-cierre y perdio el mapa por_modulo:
--      hoy un editor de CUALQUIER herramienta cambia la CLABE, el token de la
--      playlist o la invitacion. Se restaura el mapa conservando lo del 9-sep.
--      Solo se reemplaza la funcion; los dos triggers y sus columnas no se tocan.
--   3. users.plan. users_update_own no tiene candado de columna: cualquier
--      cuenta se pone plan = 'agency' y asegurar_workspace se lo copia a su
--      workspace. Disparador que solo deja cambiar plan (y los wa_*) al
--      service role. La app solo escribe desde el navegador full_name, phone,
--      role, event_focus, avatar_url, settings y los utm_*.
--   4. Storage event-media. Cualquier cuenta con sesion borra o reemplaza
--      archivos de cualquier evento. La app nunca usa UPDATE (upsert: false en
--      todos lados) y solo borra el logo/avatar anterior, que subio ella misma.
--      Los 124 archivos tienen owner_id.
--
-- CORRERLO ENTERO DE UN JALON. Si un candado previo falla, aborta sin cambiar nada.

BEGIN;

-- ============================================================
-- 0. Candados previos
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.prosrc ILIKE '%event_audit_log%'
       AND p.proname LIKE 'log_borrado%'
       AND NOT p.prosecdef
  ) THEN
    RAISE EXCEPTION 'ABORTA: una funcion log_borrado* no es security definer; candar la policy romperia los borrados';
  END IF;

  IF (SELECT count(*) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE p.proname = 'guard_event_config' AND NOT t.tgisinternal) <> 2 THEN
    RAISE EXCEPTION 'ABORTA: guard_event_config no esta colgado de exactamente 2 triggers';
  END IF;

  IF EXISTS (SELECT 1 FROM storage.objects
              WHERE bucket_id = 'event-media' AND owner_id IS NULL) THEN
    RAISE EXCEPTION 'ABORTA: hay archivos de event-media sin owner_id; nadie podria borrarlos';
  END IF;
END $$;

-- ============================================================
-- 1. Bitacora: el navegador ya no escribe borrados ni restauraciones
-- ============================================================
DROP POLICY IF EXISTS audit_member_insert ON public.event_audit_log;
CREATE POLICY audit_member_insert ON public.event_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_event_member(event_id)
    AND action NOT LIKE '%.deleted'
    AND action NOT LIKE '%.restored'
  );

-- ============================================================
-- 2. guard_event_config con el mapa por herramienta de vuelta
-- ============================================================
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
    ['invite_draft',              'invitacion'],
    ['review_token',              'proveedores'],
    ['review_event_supplier_ids', 'proveedores']
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

-- ============================================================
-- 3. users: el plan solo lo mueve el service role (/admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_users_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.wa_sender_phone IS DISTINCT FROM OLD.wa_sender_phone
     OR NEW.wa_phone_number_id IS DISTINCT FROM OLD.wa_phone_number_id
     OR NEW.wa_waba_id IS DISTINCT FROM OLD.wa_waba_id
     OR NEW.wa_subaccount_sid IS DISTINCT FROM OLD.wa_subaccount_sid
     OR NEW.wa_sender_status IS DISTINCT FROM OLD.wa_sender_status
     OR NEW.wa_connected_at IS DISTINCT FROM OLD.wa_connected_at
  THEN
    RAISE EXCEPTION 'No puedes cambiar tu plan desde aqui'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_users_plan ON public.users;
CREATE TRIGGER guard_users_plan
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_plan();

-- ============================================================
-- 4. Storage event-media: cada quien borra lo suyo, nadie reemplaza
-- ============================================================
DROP POLICY IF EXISTS "event-media editar autenticados" ON storage.objects;

DROP POLICY IF EXISTS "event-media borrar autenticados" ON storage.objects;
CREATE POLICY "event-media borrar autenticados" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'event-media' AND owner_id = auth.uid()::text);

COMMIT;

-- ============ Verificacion (correr despues, solo lectura) ============
select 'V1 audit_member_insert' as chequeo,
  (select with_check from pg_policies
    where schemaname = 'public' and tablename = 'event_audit_log' and policyname = 'audit_member_insert') as resultado
union all
select 'V2 guard con CLABE',
  (select (prosrc ilike '%registry_payment_info%' and prosrc ilike '%review_token%')::text
     from pg_proc where proname = 'guard_event_config' and pronamespace = 'public'::regnamespace)
union all
select 'V3 trigger de users',
  (select string_agg(tgname, ', ') from pg_trigger
    where tgrelid = 'public.users'::regclass and not tgisinternal)
union all
select 'V4 policies event-media',
  (select string_agg(policyname || ' [' || cmd || ']', ', ' order by policyname) from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'event-media%')
union all
select 'V5 policies de workspaces que no son SELECT (esperado: vacio)',
  (select coalesce(string_agg(policyname || ' [' || cmd || ']', ', '), 'ninguna') from pg_policies
    where schemaname = 'public' and tablename = 'workspaces' and cmd <> 'SELECT')
union all
select 'V6 cuentas con plan pagado (users vs su workspace)',
  (select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'users', u.plan, 'workspace', w.plan))::text, 'ninguna')
     from users u left join workspaces w on w.primary_owner_id = u.id
    where coalesce(u.plan, 'free') <> 'free' or coalesce(w.plan, 'free') <> 'free');
-- Esperado: V1 trae los dos NOT LIKE, V2 true, V3 guard_users_plan,
-- V4 sin "editar autenticados", V5 ninguna, V6 solo cuentas que TU pusiste.

-- ============ Revertir (solo si algo se rompe) ============
-- BEGIN;
-- DROP POLICY IF EXISTS audit_member_insert ON public.event_audit_log;
-- CREATE POLICY audit_member_insert ON public.event_audit_log
--   FOR INSERT TO authenticated WITH CHECK (public.is_event_member(event_id));
-- DROP TRIGGER IF EXISTS guard_users_plan ON public.users;
-- DROP FUNCTION IF EXISTS public.guard_users_plan();
-- DROP POLICY IF EXISTS "event-media borrar autenticados" ON storage.objects;
-- CREATE POLICY "event-media borrar autenticados" ON storage.objects
--   FOR DELETE TO authenticated USING (bucket_id = 'event-media');
-- CREATE POLICY "event-media editar autenticados" ON storage.objects
--   FOR UPDATE TO authenticated USING (bucket_id = 'event-media');
-- -- guard_event_config: volver a correr la seccion CREATE FUNCTION de
-- -- 2026-09-09-reviews-link-cliente.sql
-- COMMIT;
