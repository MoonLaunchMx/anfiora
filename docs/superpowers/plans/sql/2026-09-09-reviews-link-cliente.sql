-- El link del cliente. Tres columnas en event_settings, sin tabla nueva.
-- Seguro de correr ANTES o DESPUES del deploy: son columnas nullable que el
-- codigo viejo no lee.
--
-- Quien puede tocarlas:
--   * review_token y review_event_supplier_ids: quien edita Proveedores en
--     ese evento (mandar el link es parte de la herramienta).
--   * review_expires_at: SOLO owner/admin (Dar mas tiempo / Reactivar).
--
-- ANTES DE CORRER, lee la definicion vigente del trigger y conserva TODAS las
-- columnas que ya vigila; aqui se agrega review_expires_at a esa lista:
--   select pg_get_triggerdef(oid) from pg_trigger where tgname = 'guard_event_settings_config';

BEGIN;

ALTER TABLE public.event_settings
  ADD COLUMN IF NOT EXISTS review_token text,
  ADD COLUMN IF NOT EXISTS review_expires_at date,
  ADD COLUMN IF NOT EXISTS review_event_supplier_ids uuid[];

CREATE UNIQUE INDEX IF NOT EXISTS event_settings_review_token_key
  ON public.event_settings (review_token) WHERE review_token IS NOT NULL;

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

  -- El dueno se comprueba ANTES que nada y no lo salta ni el admin: cambiar
  -- user_id no es configurar el evento, es quedarselo.
  IF TG_TABLE_NAME = 'events'
     AND (viejo -> 'user_id') IS DISTINCT FROM (nuevo -> 'user_id')
     AND (viejo ->> 'user_id')::uuid IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Solo el dueno del evento puede transferirlo'
      USING ERRCODE = '42501';
  END IF;

  -- Las secciones del presupuesto son del presupuesto, no de la configuracion
  -- del evento: piden el permiso de esa herramienta y no el de admin.
  IF TG_TABLE_NAME = 'event_settings'
     AND (viejo -> 'budget_categories') IS DISTINCT FROM (nuevo -> 'budget_categories')
     AND NOT public.puede_editar(eid, 'presupuesto')
  THEN
    RAISE EXCEPTION 'No tienes acceso para cambiar las secciones del presupuesto'
      USING ERRCODE = '42501';
  END IF;

  -- El link del cliente es parte de Proveedores: mandarlo pide esa herramienta.
  IF TG_TABLE_NAME = 'event_settings'
     AND ((viejo -> 'review_token') IS DISTINCT FROM (nuevo -> 'review_token')
       OR (viejo -> 'review_event_supplier_ids') IS DISTINCT FROM (nuevo -> 'review_event_supplier_ids'))
     AND NOT public.puede_editar(eid, 'proveedores')
  THEN
    RAISE EXCEPTION 'No tienes acceso para mandar el link del cliente'
      USING ERRCODE = '42501';
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

-- Lista de columnas de solo-admin: la vigente (del pg_get_triggerdef de arriba)
-- MAS review_expires_at. La de abajo es la conocida al 9-sep-2026.
DROP TRIGGER IF EXISTS guard_event_settings_config ON public.event_settings;
CREATE TRIGGER guard_event_settings_config
  BEFORE UPDATE ON public.event_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_config(
    'event_id',
    'event_id', 'message_templates', 'template_names', 'enabled_features', 'agent_config',
    'review_expires_at'
  );

COMMIT;

-- ============ Verificacion ============
-- select column_name from information_schema.columns
--  where table_name = 'event_settings' and column_name like 'review_%';   -- 3 filas
-- select pg_get_triggerdef(oid) from pg_trigger where tgname = 'guard_event_settings_config';  -- trae review_expires_at
