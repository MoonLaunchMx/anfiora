-- Cimiento de accesos por herramienta — Tramo 1.
--
-- Spec: docs/superpowers/specs/2026-09-04-accesos-por-herramienta-design.md
--
-- QUE CREA: dos tablas nuevas (workspaces, workspace_members), cinco columnas
-- nuevas (events.workspace_id; event_collaborators.permisos y tipo;
-- event_audit_log.modulo y batch_id), siete funciones (es_miembro_de,
-- guard_events_workspace, set_event_workspace, nivel_en, puede_ver,
-- puede_editar, puede_borrar), cinco indices y dos policies SELECT sobre las
-- dos tablas nuevas.
--
-- QUE TOCA DE LO QUE YA EXISTE: no modifica ninguna policy, ninguna funcion ni
-- ningun dato que ya exista. Lo unico que cambia el comportamiento actual son
-- dos triggers NUEVOS sobre events, la tabla mas usada de la app:
--   - guard_events_workspace (BEFORE INSERT OR UPDATE): solo gobierna la
--     columna nueva workspace_id. Si nadie la manda, no estorba.
--   - set_event_workspace (BEFORE INSERT): rellena el despacho al crear un
--     evento, y si el dueno no tiene despacho se lo crea.
-- Ningun otro campo de events se lee ni se escribe. Aun asi, esto NO es
-- inocuo: son dos triggers en el camino de alta y edicion de todo evento.
-- Las policies se mueven modulo por modulo a partir del Tramo 2.
--
-- ORDEN OBLIGATORIO: ninguna policy puede llamar a puede_ver/puede_editar/
-- puede_borrar antes de correr -migracion-aplicar.sql. Antes de la migracion
-- permisos es NULL y nivel_en devuelve 'ninguno' para todos los colaboradores;
-- cablearlas antes deja a todo el equipo fuera de golpe. La app usa mientras
-- tanto permisosDesdeRolLegado() en lib/permisos/resolver.ts.
--
-- RE-CORRER ESTE ARCHIVO: las tablas, columnas e indices son IF NOT EXISTS, y
-- las funciones, triggers y policies se reemplazan solas. Dos salvedades:
--   1. Las acciones ON DELETE de las llaves foraneas NO se reaplican si las
--      tablas ya existen. Si corriste una version anterior, revisalas a mano.
--   2. Si alguien creo despachos a mano y quedaron dos con el mismo dueno, el
--      indice unico workspaces_un_dueno aborta el script entero. Hay que
--      limpiar el duplicado antes. (Este archivo por si solo no puede producir
--      ese estado: la tabla y su indice nacen en la misma transaccion.)
-- NO borres las tablas para re-correr si -migracion-aplicar.sql ya corrio: eso
-- tira membresias reales, y ademas DROP TABLE workspaces CASCADE elimina la
-- llave foranea en vez de disparar su ON DELETE SET NULL, asi que
-- events.workspace_id queda con UUID que ya no apuntan a nada. Eso es peor que
-- NULL: la verificacion final de -migracion-aplicar.sql busca workspace_id IS
-- NULL y no lo detecta.
--
-- Modelo (ver §2 del spec):
--   Arriba, el despacho: dueno / admin / colaborador.
--   Abajo, cada boda: por modulo, ninguno / ver / editar / total.
--   'total' es el unico que borra.
--
-- Correr DESPUES de que el codigo del Tramo 1 este en produccion.

BEGIN;

-- ============================================================
-- 1. El despacho
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  primary_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_un_dueno
  ON public.workspaces (primary_owner_id);

-- El plan, los datos fiscales y los asientos aterrizan aqui cuando llegue el
-- chat de precios. Este script NO los agrega a proposito.

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES public.users(id) ON DELETE CASCADE,
  email              text NOT NULL,
  rol                text NOT NULL CHECK (rol IN ('dueno', 'admin', 'colaborador')),
  es_dueno_principal boolean NOT NULL DEFAULT false,
  kit_habitual       jsonb,
  permisos_cuenta    jsonb,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'active', 'revoked')),
  invite_token       text UNIQUE,
  invited_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at         timestamptz NOT NULL DEFAULT now(),
  accepted_at        timestamptz,
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx
  ON public.workspace_members (user_id) WHERE status = 'active';

-- Exactamente un dueno principal por despacho.
CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_un_principal
  ON public.workspace_members (workspace_id) WHERE es_dueno_principal;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_un_usuario
  ON public.workspace_members (workspace_id, user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- 1.b La funcion que rompe la recursion de RLS
--     Va aqui, y no al principio: es LANGUAGE sql, asi que Postgres valida su
--     cuerpo al crearla y necesita que workspace_members ya exista. Y va antes
--     de la seccion 2 porque el trigger de esa seccion la llama: corrido por
--     secciones, definirla despues deja el trigger vivo sin la funcion y todo
--     INSERT en events muere con 42883.
-- ============================================================

-- SECURITY DEFINER evalua sin RLS: sin esto, una policy que consulta
-- workspace_members dentro de su propio USING recursa (42P17) y deja las dos
-- tablas ilegibles. Misma tecnica que is_event_member en anf-053.
CREATE OR REPLACE FUNCTION public.es_miembro_de(ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = ws
      AND m.user_id = auth.uid()
      AND m.status  = 'active'
  )
$$;

-- ============================================================
-- 2. Las columnas nuevas
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- La columna nueva no esta en la lista negra de guard_events_config, y la
-- policy events_editor_update deja escribir events a cualquier editor. Sin
-- este candado, un editor apunta la boda a un despacho suyo y nivel_en() le
-- regresa 'total' en los doce modulos. Va como trigger aparte para no tocar
-- guard_events_config: este archivo no modifica nada que ya exista.
CREATE OR REPLACE FUNCTION public.guard_events_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.workspace_id IS NOT NULL AND NOT public.es_miembro_de(NEW.workspace_id) THEN
      RAISE EXCEPTION 'No puedes crear un evento en un despacho al que no perteneces'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Solo el dueno del evento puede cambiar su despacho'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.workspace_id IS NOT NULL AND NOT public.es_miembro_de(NEW.workspace_id) THEN
      RAISE EXCEPTION 'No puedes mover un evento a un despacho al que no perteneces'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_events_workspace ON public.events;
CREATE TRIGGER guard_events_workspace
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_events_workspace();

-- Sin esto, cada evento creado despues de la migracion nace sin despacho: la
-- migracion solo crea despachos para quien ya tenia eventos, y nada en la app
-- escribe en workspaces. Se crea aqui la primera vez que hace falta, para que
-- el invariante se sostenga solo en vez de degradarse en silencio.
CREATE OR REPLACE FUNCTION public.set_event_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws uuid;
BEGIN
  IF NEW.workspace_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT w.id INTO v_ws FROM workspaces w WHERE w.primary_owner_id = NEW.user_id;

  IF v_ws IS NULL THEN
    INSERT INTO workspaces (name, primary_owner_id)
    SELECT COALESCE(u.full_name, u.email, 'Mi despacho'), u.id
      FROM users u WHERE u.id = NEW.user_id
    ON CONFLICT (primary_owner_id) DO NOTHING;

    INSERT INTO workspace_members (workspace_id, user_id, email, rol, es_dueno_principal, status, accepted_at)
    SELECT w.id, u.id, COALESCE(u.email, u.id::text), 'dueno', true, 'active', now()
      FROM workspaces w
      JOIN users u ON u.id = w.primary_owner_id
     WHERE w.primary_owner_id = NEW.user_id
       AND NOT EXISTS (
         SELECT 1 FROM workspace_members m
          WHERE m.workspace_id = w.id AND m.user_id = u.id
       )
    ON CONFLICT DO NOTHING;

    SELECT w.id INTO v_ws FROM workspaces w WHERE w.primary_owner_id = NEW.user_id;
  END IF;

  NEW.workspace_id := v_ws;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_event_workspace ON public.events;
CREATE TRIGGER set_event_workspace
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_event_workspace();

CREATE INDEX IF NOT EXISTS events_workspace_idx ON public.events (workspace_id);

ALTER TABLE public.event_collaborators
  ADD COLUMN IF NOT EXISTS permisos jsonb,
  ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('equipo', 'cliente'));

-- La bitacora necesita saber de que modulo fue el movimiento, y poder agrupar
-- un borrado en cascada para regresarlo completo.
ALTER TABLE public.event_audit_log
  ADD COLUMN IF NOT EXISTS modulo   text,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- ============================================================
-- 3. La unica funcion que decide un permiso
-- ============================================================

CREATE OR REPLACE FUNCTION public.nivel_en(evento uuid, modulo text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = evento AND e.user_id = auth.uid()
    ) THEN 'total'

    WHEN EXISTS (
      SELECT 1
      FROM events e
      JOIN workspace_members m ON m.workspace_id = e.workspace_id
      WHERE e.id = evento
        AND m.user_id = auth.uid()
        AND m.status  = 'active'
        AND m.rol IN ('dueno', 'admin')
    ) THEN 'total'

    ELSE COALESCE(
      (SELECT CASE WHEN c.permisos ->> modulo IN ('ver', 'editar', 'total')
                   THEN c.permisos ->> modulo END
         FROM event_collaborators c
        WHERE c.event_id = evento
          AND c.user_id  = auth.uid()
          AND c.status   = 'active'
        LIMIT 1),
      'ninguno'
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.puede_ver(evento uuid, modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.nivel_en(evento, modulo) <> 'ninguno' $$;

CREATE OR REPLACE FUNCTION public.puede_editar(evento uuid, modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.nivel_en(evento, modulo) IN ('editar', 'total') $$;

CREATE OR REPLACE FUNCTION public.puede_borrar(evento uuid, modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.nivel_en(evento, modulo) = 'total' $$;

-- ============================================================
-- 4. RLS de las tablas nuevas
-- ============================================================

ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver mi despacho" ON public.workspaces;
CREATE POLICY "ver mi despacho" ON public.workspaces FOR SELECT
  USING ( primary_owner_id = auth.uid() OR public.es_miembro_de(id) );

DROP POLICY IF EXISTS "ver a mis companeros" ON public.workspace_members;
CREATE POLICY "ver a mis companeros" ON public.workspace_members FOR SELECT
  USING ( user_id = auth.uid() OR public.es_miembro_de(workspace_id) );

-- La escritura de miembros llega en el Tramo 5, con la pantalla del despacho.
-- Mientras tanto solo escribe el service role, que se salta RLS.

COMMIT;
