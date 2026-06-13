-- ANF-052 (pre-trabajo): fix de recursion RLS que rompia el link publico del playlist.
-- CORRIDO EN SUPABASE el 2026-06-12 por Diego. Queda aqui como registro versionado.
--
-- Sintoma: anon recibia 42P17 "infinite recursion detected in policy" en events
-- y event_settings → /playlist/[token] mostraba "link expirado" en navegadores
-- sin sesion. Tambien afectaba el join a events de /invite/[token].
--
-- Causa: la policy de events "Public can read events via playlist token" (anon)
-- consultaba event_settings, y las policies de host de event_settings (creadas
-- {public}, o sea tambien anon) consultaban events. Ciclo events ↔ event_settings.
--
-- Estrategia: subqueries movidos a funciones SECURITY DEFINER (evaluan sin RLS,
-- rompen el ciclo de raiz) y policies de host/colaborador acotadas a authenticated.
-- Semantica de acceso identica.
--
-- Extra: event_collaborators NO tiene RLS. Se revoco escritura a anon como parche.
-- El cierre completo (lectura anonima de emails/invite_tokens) requiere mover
-- /invite/[token] a un API route con service role y activar RLS — pendiente.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_event_owner(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_event_member(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid() AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.event_has_playlist_token(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM event_settings
                 WHERE event_id = eid AND playlist_token IS NOT NULL);
$$;

DROP POLICY IF EXISTS "Public can read events via playlist token" ON events;
CREATE POLICY "Public can read events via playlist token" ON events
  FOR SELECT TO anon, authenticated
  USING (public.event_has_playlist_token(id));

DROP POLICY IF EXISTS "collaborators can read events" ON events;
CREATE POLICY "collaborators can read events" ON events
  FOR SELECT TO authenticated
  USING (public.is_event_member(id));

DROP POLICY IF EXISTS "owner only" ON events;
CREATE POLICY "owner only" ON events
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "collaborators can read event_settings" ON event_settings;
CREATE POLICY "collaborators can read event_settings" ON event_settings
  FOR SELECT TO authenticated
  USING (public.is_event_member(event_id));

DROP POLICY IF EXISTS "event_settings_select_own" ON event_settings;
CREATE POLICY "event_settings_select_own" ON event_settings
  FOR SELECT TO authenticated
  USING (public.is_event_owner(event_id));

DROP POLICY IF EXISTS "event_settings_insert_own" ON event_settings;
CREATE POLICY "event_settings_insert_own" ON event_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_event_owner(event_id));

DROP POLICY IF EXISTS "event_settings_update_own" ON event_settings;
CREATE POLICY "event_settings_update_own" ON event_settings
  FOR UPDATE TO authenticated
  USING (public.is_event_owner(event_id));

REVOKE INSERT, UPDATE, DELETE ON event_collaborators FROM anon;

COMMIT;
