-- Cimiento de accesos por herramienta — Tramo 1.
--
-- Spec: docs/superpowers/specs/2026-09-04-accesos-por-herramienta-design.md
--
-- Es ADITIVO: crea dos tablas, cuatro columnas y cuatro funciones. No modifica
-- ninguna policy ni ninguna funcion existente, asi que no cambia el
-- comportamiento de nada que hoy este corriendo. Las policies se mueven modulo
-- por modulo a partir del Tramo 2.
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
  primary_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now()
);

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

-- ============================================================
-- 2. Las columnas nuevas
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

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
      (SELECT c.permisos ->> modulo
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

CREATE POLICY "ver mi despacho" ON public.workspaces FOR SELECT
  USING (
    primary_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = workspaces.id
        AND m.user_id = auth.uid()
        AND m.status  = 'active'
    )
  );

CREATE POLICY "ver a mis companeros" ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members yo
      WHERE yo.workspace_id = workspace_members.workspace_id
        AND yo.user_id = auth.uid()
        AND yo.status  = 'active'
    )
  );

-- La escritura de miembros llega en el Tramo 5, con la pantalla del despacho.
-- Mientras tanto solo escribe el service role, que se salta RLS.

COMMIT;
