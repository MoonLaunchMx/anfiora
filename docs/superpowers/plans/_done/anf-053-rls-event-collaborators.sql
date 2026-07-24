-- ANF-053: cierre del hueco de seguridad de event_collaborators.
--
-- Sintoma: la tabla NO tenia RLS. Cualquier anon podia leer email + invite_token
-- de TODOS los colaboradores (la pagina /invite/[token] leia la tabla directo
-- como anon). La escritura anon ya se habia revocado como parche en
-- anf-052-fix-rls-playlist.sql; esto cierra la lectura y activa RLS.
--
-- Pre-requisito de deploy (regla sync Supabase <-> Vercel): el codigo nuevo de
-- /invite/[token] (que ya pasa por /api/invite/[token] con service role) DEBE
-- estar pusheado a origin/main ANTES de correr este SQL. Si se activa RLS antes,
-- el /invite viejo (lee como anon) se rompe para los invitados pendientes.
--
-- Tras activar RLS, los flujos autenticados que SI deben seguir funcionando:
--   - event-access-context: lee mi propia fila (rol en el evento)
--   - dashboard: lee mis eventos compartidos
--   - timeline/TaskModal: un miembro lee los colaboradores del evento
--   - configuracion: owner/admin lee todos, invita (INSERT) y revoca (UPDATE)
--   - aceptar invitacion: pasa por service role en la API route -> bypasea RLS
--
-- is_event_member ya existe (SECURITY DEFINER, creada en
-- anf-052-fix-rls-playlist.sql). Las funciones SECURITY DEFINER evaluan sin RLS,
-- por lo que las policies que las usan NO recursan sobre event_collaborators.

BEGIN;

-- owner del evento, o colaborador activo con rol admin
CREATE OR REPLACE FUNCTION public.is_event_admin(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role = 'admin');
$$;

ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- SELECT: leo mi propia fila (incluye filas pending donde aun no soy miembro),
-- o cualquier fila de un evento del que soy miembro (owner o colaborador activo).
DROP POLICY IF EXISTS "members read collaborators" ON public.event_collaborators;
CREATE POLICY "members read collaborators" ON public.event_collaborators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_event_member(event_id));

-- INSERT: solo owner/admin del evento puede crear invitaciones.
DROP POLICY IF EXISTS "admins create collaborators" ON public.event_collaborators;
CREATE POLICY "admins create collaborators" ON public.event_collaborators
  FOR INSERT TO authenticated
  WITH CHECK (public.is_event_admin(event_id));

-- UPDATE: solo owner/admin (revocar, cambiar rol). La aceptacion de invitacion
-- NO entra por aqui: corre por service role en /api/invite/[token].
DROP POLICY IF EXISTS "admins update collaborators" ON public.event_collaborators;
CREATE POLICY "admins update collaborators" ON public.event_collaborators
  FOR UPDATE TO authenticated
  USING (public.is_event_admin(event_id))
  WITH CHECK (public.is_event_admin(event_id));

-- Sin policy de DELETE -> nadie borra via cliente (RLS lo deniega por defecto).

-- Defensa en profundidad: anon ya no necesita NINGUN acceso a la tabla
-- (todo el flujo publico pasa por la API con service role).
REVOKE SELECT ON public.event_collaborators FROM anon;

COMMIT;
