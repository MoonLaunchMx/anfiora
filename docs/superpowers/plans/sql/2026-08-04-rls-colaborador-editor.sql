-- Colaborador editor: escritura real en events y event_settings.
--
-- Sintoma: un colaborador con rol editor edita y publica la invitacion, la app
-- confirma ("Publicada", sello verde) y la base no guarda nada. Los invitados
-- siguen viendo la version anterior.
--
-- Causa: las policies de escritura de ambas tablas son de ANF-052 (junio,
-- anterior a los colaboradores) y exigen is_event_owner. El RBAC de los 4 roles
-- solo existia en la interfaz (lib/event-access-context.tsx); Postgres nunca lo
-- supo. El cierre de RLS del 13-jul creo is_event_editor pero no lo aplico aqui.
--
-- Modelo que implementa este SQL (definido por Diego):
--   viewer  -> solo lectura
--   editor  -> edita y publica TODO el contenido del evento
--   admin   -> ademas configura (nombre, fecha, sede, plantillas, herramientas)
--   owner   -> todo, mas crear y borrar el evento
--
-- Como se separa "configurar" de "editar" dentro de la MISMA fila: una policy no
-- puede distinguir columnas, asi que la policy abre la escritura al editor y un
-- disparador rechaza los cambios a las columnas de configuracion.
--
-- Prerrequisitos (ya en prod, el script truena y revierte si faltan):
--   public.is_event_editor(uuid)  -- 2026-07-13-rls-holes.sql
--   public.is_event_admin(uuid)   -- anf-053-rls-event-collaborators.sql
--
-- Es permisivo: solo deja pasar escrituras que hoy fallan. No rompe el codigo
-- desplegado, por eso corre ANTES del arreglo de codigo (excepcion consciente a
-- la regla de sincronia Supabase <-> Vercel).

BEGIN;

-- ============ 1) Escritura por editor ============
-- is_event_editor = owner OR colaborador activo con rol admin/editor, asi que
-- estas policies subsumen a las de owner que reemplazan.

DROP POLICY IF EXISTS event_settings_editor_insert ON public.event_settings;
CREATE POLICY event_settings_editor_insert ON public.event_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_event_editor(event_id));

DROP POLICY IF EXISTS event_settings_editor_update ON public.event_settings;
CREATE POLICY event_settings_editor_update ON public.event_settings
  FOR UPDATE TO authenticated
  USING (public.is_event_editor(event_id))
  WITH CHECK (public.is_event_editor(event_id));

DROP POLICY IF EXISTS event_settings_insert_own ON public.event_settings;
DROP POLICY IF EXISTS event_settings_update_own ON public.event_settings;

-- events: se AGREGA el UPDATE del editor. La policy "owner only" (FOR ALL) se
-- queda intacta porque es la que cubre INSERT y DELETE del dueno.
DROP POLICY IF EXISTS events_editor_update ON public.events;
CREATE POLICY events_editor_update ON public.events
  FOR UPDATE TO authenticated
  USING (public.is_event_editor(id))
  WITH CHECK (public.is_event_editor(id));

-- ============ 2) El candado de configuracion ============
-- TG_ARGV[0] = nombre de la columna con el id del evento.
-- TG_ARGV[1..] = columnas que solo owner/admin pueden cambiar.
-- Comparar via to_jsonb permite recibir los nombres como argumentos del trigger
-- y hace inofensivo nombrar una columna que no exista (queda NULL en ambos lados).
CREATE OR REPLACE FUNCTION public.guard_event_config()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  viejo jsonb := to_jsonb(OLD);
  nuevo jsonb := to_jsonb(NEW);
  eid uuid := (nuevo ->> TG_ARGV[0])::uuid;
  col text;
  i int;
BEGIN
  -- Sin sesion de usuario final no hay rol que aplicar: service role, cron y el
  -- editor SQL pasan derecho. Ningun rol anonimo tiene policy de escritura aqui,
  -- asi que esto no abre nada.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
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

-- Solo BEFORE UPDATE: en un INSERT no hay OLD contra que comparar, y crear la
-- fila ya lo controlan las policies (events solo el dueno; event_settings nace
-- con el evento).
DROP TRIGGER IF EXISTS guard_events_config ON public.events;
CREATE TRIGGER guard_events_config
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_config(
    'id',
    'user_id', 'name', 'event_type', 'event_category', 'event_date', 'event_end_date',
    'event_time', 'venue', 'address', 'host_name', 'host_name_2', 'organization',
    'currency', 'event_status', 'planner_name', 'plan_tier', 'over_limit', 'locked'
  );

DROP TRIGGER IF EXISTS guard_event_settings_config ON public.event_settings;
CREATE TRIGGER guard_event_settings_config
  BEFORE UPDATE ON public.event_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_config(
    'event_id',
    'event_id', 'message_templates', 'template_names', 'enabled_features', 'agent_config'
  );

COMMIT;

-- ============ Verificacion ============
-- 1) Las policies de escritura ahora son de editor en ambas tablas:
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename in ('events','event_settings') and cmd in ('INSERT','UPDATE','ALL')
-- order by tablename, cmd;
--
-- 2) Los dos disparadores existen y estan activos ('O' = enabled):
-- select tgrelid::regclass as tabla, tgname, tgenabled
-- from pg_trigger where tgname like 'guard_%config';
--
-- 3) Prueba real (la que importa): la hermana de Diego, con rol editor en
--    "Elena's birthday", edita la invitacion, publica, RECARGA y sus cambios
--    siguen ahi; abre el link de invitado y ve la version nueva.
--    Contra-prueba: entra a /events/<id>/configuracion (no aparece en su nav) e
--    intenta cambiar el nombre del evento -> debe fallar con 42501.

-- ============ Rollback ============
-- BEGIN;
-- DROP TRIGGER IF EXISTS guard_events_config ON public.events;
-- DROP TRIGGER IF EXISTS guard_event_settings_config ON public.event_settings;
-- DROP FUNCTION IF EXISTS public.guard_event_config();
-- DROP POLICY IF EXISTS events_editor_update ON public.events;
-- DROP POLICY IF EXISTS event_settings_editor_insert ON public.event_settings;
-- DROP POLICY IF EXISTS event_settings_editor_update ON public.event_settings;
-- CREATE POLICY event_settings_insert_own ON public.event_settings
--   FOR INSERT TO authenticated WITH CHECK (public.is_event_owner(event_id));
-- CREATE POLICY event_settings_update_own ON public.event_settings
--   FOR UPDATE TO authenticated USING (public.is_event_owner(event_id));
-- COMMIT;
