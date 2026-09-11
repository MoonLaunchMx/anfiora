-- Tramo 5, el workspace — tanda 1: cimiento.
--
-- Spec: docs/superpowers/specs/2026-09-07-workspace-tramo5-design.md (§3)
--
-- REQUISITO: el codigo de la tanda 1 en main y desplegado. Antes de eso la app
-- ya tolera que nada de esto exista; despues, /admin escribe workspaces.plan.
--
-- QUE HACE: siete columnas en workspaces mas avatar_url en users, tres
-- funciones nuevas (es_admin_de,
-- asegurar_workspace, plan_del_evento), un disparador nuevo
-- (guard_workspace_members), dos disparadores existentes reescritos
-- (guard_events_workspace exige dueno/admin; set_event_workspace delega en
-- asegurar_workspace), y la migracion del plan de users a workspaces.
--
-- NO toca policies de RLS ni is_event_*: eso es la tanda 3.
-- RE-CORRIBLE: todo es IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
-- CORRERLO ENTERO DE UN JALON. La seccion 0 es solo lectura: mirala antes.

-- ============================================================
-- 0. PREVIO (solo lectura) — esperado el 7-sep: 18 free, 1 agency, 1 studio
-- ============================================================
SELECT u.email, u.plan AS plan_en_users,
       CASE lower(coalesce(u.plan,'free'))
         WHEN 'pro' THEN 'pro' WHEN 'agency' THEN 'agency' WHEN 'studio' THEN 'pro'
         ELSE 'free' END AS plan_que_quedara,
       w.name AS workspace
  FROM users u
  JOIN workspaces w ON w.primary_owner_id = u.id
 WHERE coalesce(u.plan,'free') <> 'free'
 ORDER BY u.email;

BEGIN;

-- ============================================================
-- 1. Las columnas: siete en workspaces y una en users
-- ============================================================
-- logo_url y avatar_url guardan la RUTA PUBLICA del bucket event-media,
-- nunca el archivo. Se agregan aqui, y no en una migracion aparte, porque
-- esta todavia no habia corrido: dos columnas de texto nulas no cambian
-- nada de lo que ya hacia este archivo.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan          text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS legal_name    text,
  ADD COLUMN IF NOT EXISTS rfc           text,
  ADD COLUMN IF NOT EXISTS tax_regime    text,
  ADD COLUMN IF NOT EXISTS postal_code   text,
  ADD COLUMN IF NOT EXISTS logo_url      text,
  ADD COLUMN IF NOT EXISTS tagline       text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_valido;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_valido CHECK (plan IN ('free', 'pro', 'agency'));

-- ============================================================
-- 2. Quien administra un workspace
-- ============================================================
CREATE OR REPLACE FUNCTION public.es_admin_de(ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = ws
      AND m.user_id = auth.uid()
      AND m.status  = 'active'
      AND m.rol IN ('dueno', 'admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.es_admin_de(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.es_admin_de(uuid) TO authenticated, service_role;

-- ============================================================
-- 3. El workspace propio, creado la primera vez que hace falta
--    (antes vivia inline en set_event_workspace; ahora tambien lo llama /admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.asegurar_workspace(uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ws uuid;
BEGIN
  SELECT w.id INTO v_ws FROM workspaces w WHERE w.primary_owner_id = uid;
  IF v_ws IS NOT NULL THEN
    RETURN v_ws;
  END IF;

  INSERT INTO workspaces (name, primary_owner_id, plan)
  SELECT COALESCE(u.full_name, u.email, 'Mi workspace'), u.id,
         CASE lower(coalesce(u.plan,'free'))
           WHEN 'pro' THEN 'pro' WHEN 'agency' THEN 'agency' WHEN 'studio' THEN 'pro'
           ELSE 'free' END
    FROM users u WHERE u.id = uid
  ON CONFLICT (primary_owner_id) DO NOTHING;

  INSERT INTO workspace_members (workspace_id, user_id, email, rol, es_dueno_principal, status, accepted_at)
  SELECT w.id, u.id, COALESCE(u.email, u.id::text), 'dueno', true, 'active', now()
    FROM workspaces w
    JOIN users u ON u.id = w.primary_owner_id
   WHERE w.primary_owner_id = uid
     AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = u.id)
  ON CONFLICT DO NOTHING;

  SELECT w.id INTO v_ws FROM workspaces w WHERE w.primary_owner_id = uid;
  RETURN v_ws;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asegurar_workspace(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.asegurar_workspace(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_event_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.workspace_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.workspace_id := public.asegurar_workspace(NEW.user_id);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Crear o mover una boda a un workspace es de dueno o admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_events_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.workspace_id IS NOT NULL AND NOT public.es_admin_de(NEW.workspace_id) THEN
      RAISE EXCEPTION 'Solo el dueno o un administrador del workspace puede crear bodas en el'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Solo el dueno del evento puede cambiar su workspace'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.workspace_id IS NOT NULL AND NOT public.es_admin_de(NEW.workspace_id) THEN
      RAISE EXCEPTION 'No puedes mover un evento a un workspace que no administras'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. El dueno principal no se toca, venga de donde venga la escritura
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_workspace_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.es_dueno_principal THEN
      RAISE EXCEPTION 'El dueno principal no se puede borrar del workspace' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.es_dueno_principal THEN
      IF NEW.status <> 'active' THEN
        RAISE EXCEPTION 'El dueno principal no se puede revocar' USING ERRCODE = '42501';
      END IF;
      IF NEW.rol <> 'dueno' THEN
        RAISE EXCEPTION 'El dueno principal siempre es dueno' USING ERRCODE = '42501';
      END IF;
    END IF;
    -- Transferir la propiedad es operacion de soporte (ver seccion 8): desde la
    -- app nunca cambia esta bandera.
    IF NEW.es_dueno_principal IS DISTINCT FROM OLD.es_dueno_principal THEN
      RAISE EXCEPTION 'La propiedad del workspace no se cambia desde aqui' USING ERRCODE = '42501';
    END IF;
    -- user_id se escribe una sola vez, al aceptar.
    IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'La membresia ya esta ligada a una cuenta' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_workspace_members ON public.workspace_members;
CREATE TRIGGER guard_workspace_members
  BEFORE UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_members();

-- ============================================================
-- 6. El plan que gobierna una boda (lo usara actividad_ver en su momento)
-- ============================================================
CREATE OR REPLACE FUNCTION public.plan_del_evento(evento uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT w.plan FROM events e JOIN workspaces w ON w.id = e.workspace_id WHERE e.id = evento),
    'free'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.plan_del_evento(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.plan_del_evento(uuid) TO authenticated, service_role;

-- ============================================================
-- 7. Migracion del plan: users.plan -> workspaces.plan (studio -> pro)
-- ============================================================
UPDATE workspaces w
   SET plan = CASE lower(coalesce(u.plan,'free'))
                WHEN 'pro' THEN 'pro' WHEN 'agency' THEN 'agency' WHEN 'studio' THEN 'pro'
                ELSE 'free' END
  FROM users u
 WHERE u.id = w.primary_owner_id;

COMMIT;

-- ============================================================
-- VERIFICACION (solo lectura)
-- ============================================================
SELECT plan, count(*) FROM workspaces GROUP BY plan ORDER BY plan;
-- esperado: agency 1, pro 1, free el resto

-- ============================================================
-- 8. SOPORTE: transferir la propiedad (NO correr; queda documentado)
-- ============================================================
-- El disparador de la seccion 5 lo impide a proposito. Para transferir, con el
-- nuevo dueno YA miembro activo del workspace:
--   ALTER TABLE workspace_members DISABLE TRIGGER guard_workspace_members;
--   UPDATE workspace_members SET es_dueno_principal = false WHERE workspace_id = :ws AND es_dueno_principal;
--   UPDATE workspace_members SET es_dueno_principal = true, rol = 'dueno' WHERE workspace_id = :ws AND user_id = :nuevo;
--   UPDATE workspaces SET primary_owner_id = :nuevo WHERE id = :ws;
--   ALTER TABLE workspace_members ENABLE TRIGGER guard_workspace_members;
-- Ojo con el indice unico workspaces_un_dueno: el nuevo dueno no puede ser ya
-- dueno principal de otro workspace.

-- ============================================================
-- DESHACER (solo si hace falta)
-- ============================================================
-- UPDATE workspaces SET plan = 'free';
-- DROP TRIGGER IF EXISTS guard_workspace_members ON workspace_members;
-- Las columnas y funciones nuevas se pueden dejar: son inertes sin el codigo.
