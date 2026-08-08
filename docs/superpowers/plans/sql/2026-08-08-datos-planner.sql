-- Datos del planner: el contacto que ve el invitado al terminar de responder.
-- Spec: docs/superpowers/specs/2026-08-08-post-confirmacion-invitacion-design.md
--
-- ORDEN OBLIGATORIO (regla de sincronia Supabase-Vercel):
--   1) El codigo que lee estas columnas ya debe estar en origin/main.
--   2) Recien entonces correr este archivo.
-- Al reves, la app en produccion pediria columnas que no existen.

-- ============ Verificacion previa (solo lectura) ============
-- Confirmar que planner_name existe y que las dos nuevas NO:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'events'
--   and column_name in ('planner_name', 'planner_phone', 'planner_email');
-- Esperado antes de correr: una sola fila, planner_name.

BEGIN;

-- ============ 1) Las columnas ============
-- Ambas opcionales: un evento sin datos del planner simplemente no muestra
-- tarjeta de contacto. planner_phone se guarda en E.164 (con '+'), igual que
-- users.phone y guests.phone — lo garantiza PhoneInput en la captura.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS planner_phone text,
  ADD COLUMN IF NOT EXISTS planner_email text;

-- ============ 2) El candado de configuracion ============
-- guard_event_config recibe las columnas protegidas como argumentos del
-- trigger, asi que agregar columnas obliga a RECREARLO: sin esto, un
-- colaborador editor podria cambiar el contacto del evento.
-- La funcion no cambia; solo su lista de argumentos. Definicion vigente:
-- docs/superpowers/plans/sql/2026-08-04-rls-colaborador-editor.sql
DROP TRIGGER IF EXISTS guard_events_config ON public.events;
CREATE TRIGGER guard_events_config
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_config(
    'id',
    'user_id', 'name', 'event_type', 'event_category', 'event_date', 'event_end_date',
    'event_time', 'venue', 'address', 'host_name', 'host_name_2', 'organization',
    'currency', 'event_status', 'planner_name', 'planner_phone', 'planner_email',
    'plan_tier', 'over_limit', 'locked'
  );

COMMIT;

-- ============ Verificacion posterior ============
-- 1) Las tres columnas existen:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'events'
--   and column_name in ('planner_name', 'planner_phone', 'planner_email');
--
-- 2) El trigger quedo activo ('O' = enabled) y con los nombres nuevos:
-- select tgname, tgenabled, pg_get_triggerdef(oid) as definicion
-- from pg_trigger
-- where tgrelid = 'public.events'::regclass and tgname = 'guard_events_config';
--
-- 3) Prueba viva del candado: con la sesion de un colaborador EDITOR,
--    un update de planner_phone debe fallar con 42501.
