-- FASE 1: cierre de los 4 hoyos de RLS.
-- PRERREQUISITO: el codigo de Task 2 (lee events.planner_name) YA en origin/main,
-- y el SQL additive 2026-07-13-rls-planner-name.sql YA corrido.
-- Idempotente. Correr completo en el SQL Editor de Supabase.
BEGIN;

-- ============ Helpers nuevos ============
-- owner o colaborador activo con rol admin/editor
CREATE OR REPLACE FUNCTION public.is_event_editor(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role IN ('admin','editor'));
$$;

-- admin de plataforma: espeja el gate por correo de /admin (ADMIN_EMAIL)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT (auth.jwt() ->> 'email') = 'diego.garza@moonlaunch.mx';
$$;

-- ============ 1) users: quitar la lectura total ============
-- El admin ya lee por service role (/api/admin/users). Queda solo fila propia
-- (users_select_own / users_update_own, que ya existen).
DROP POLICY IF EXISTS "Admin can read all users" ON public.users;

-- ============ 2) song_recommendations: token-scoping + dedupe 6->4 ============
DROP POLICY IF EXISTS "anon insert song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "authenticated insert song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "public can insert song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "anon select song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "authenticated select song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "public can read song_recommendations" ON public.song_recommendations;

CREATE POLICY songs_anon_select ON public.song_recommendations
  FOR SELECT TO anon USING (public.event_has_playlist_token(event_id));
CREATE POLICY songs_anon_insert ON public.song_recommendations
  FOR INSERT TO anon WITH CHECK (public.event_has_playlist_token(event_id));
CREATE POLICY songs_member_select ON public.song_recommendations
  FOR SELECT TO authenticated USING (public.is_event_member(event_id));
CREATE POLICY songs_editor_write ON public.song_recommendations
  FOR ALL TO authenticated
  USING (public.is_event_editor(event_id))
  WITH CHECK (public.is_event_editor(event_id));

-- ============ 3) event_audit_log: prender RLS ============
-- Escribe el usuario que actua (cliente del browser); lee solo el admin de plataforma.
ALTER TABLE public.event_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_member_insert ON public.event_audit_log;
DROP POLICY IF EXISTS audit_admin_select ON public.event_audit_log;
CREATE POLICY audit_member_insert ON public.event_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_event_member(event_id));
CREATE POLICY audit_admin_select ON public.event_audit_log
  FOR SELECT TO authenticated USING (public.is_platform_admin());
-- Sin UPDATE/DELETE -> bitacora inmutable desde el cliente.

-- ============ 4) event_itinerary_moments: prender RLS ============
-- En main solo se LEE via service role (/api/invitacion/[token]) -> bypassa RLS.
-- Las policies de miembro/editor cubren la escritura si el editor de itinerario aterriza.
ALTER TABLE public.event_itinerary_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itinerary_member_select ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerary_editor_write ON public.event_itinerary_moments;
CREATE POLICY itinerary_member_select ON public.event_itinerary_moments
  FOR SELECT TO authenticated USING (public.is_event_member(event_id));
CREATE POLICY itinerary_editor_write ON public.event_itinerary_moments
  FOR ALL TO authenticated
  USING (public.is_event_editor(event_id))
  WITH CHECK (public.is_event_editor(event_id));

COMMIT;
