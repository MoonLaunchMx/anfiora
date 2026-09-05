-- Tramo 3, parte 2: Invitados y Mesas pasan a permisos por herramienta.
--
-- QUE CAMBIA. Estas cuatro tablas SI dejaban entrar a los colaboradores, pero
-- con el modelo viejo: la condicion venia escrita a mano en cada policy, con un
-- UNION contra event_collaborators y `role IN ('admin','editor')`. O sea, quien
-- podia editar invitados podia editar TODO, y borrar venia de regalo con editar.
--
-- Ademas estaban duplicadas: `guests` tenia SIETE policies -- las viejas de solo
-- dueno (`Users can *`) conviviendo con las de colaborador. Como las policies
-- permisivas se suman con OR, no rompian nada, pero cada cambio habia que
-- hacerlo dos veces. Aqui se quedan cuatro por tabla y ya.
--
-- REQUISITOS, en este orden:
--   1. El codigo de esta tanda esta en produccion.
--   2. Ya corrio el cimiento del Tramo 2 (puede_ver / puede_editar /
--      puede_borrar y log_borrado existen).
--
-- Estado leido de pg_policies el 5-sep-2026:
--   guests       7 policies (4 viejas de dueno + 3 de colaborador). Los dos
--                UPDATE **sin WITH CHECK**.
--   party_members 2: `collaborators can write` (ALL) + `collaborators can read`.
--   tables       3: owner_tables (ALL) + collaborators write (ALL) + read.
--   table_seats  3: iguales.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Invitados
-- ============================================================
DROP POLICY IF EXISTS "Users can view guests of their events"   ON public.guests;
DROP POLICY IF EXISTS "Users can insert guests to their events" ON public.guests;
DROP POLICY IF EXISTS "Users can update guests of their events" ON public.guests;
DROP POLICY IF EXISTS "Users can delete guests of their events" ON public.guests;
DROP POLICY IF EXISTS "collaborators can read guests"           ON public.guests;
DROP POLICY IF EXISTS "collaborators can insert guests"         ON public.guests;
DROP POLICY IF EXISTS "collaborators can update guests"         ON public.guests;
DROP POLICY IF EXISTS "collaborators can delete guests"         ON public.guests;

DROP POLICY IF EXISTS invitados_ver    ON public.guests;
DROP POLICY IF EXISTS invitados_crear  ON public.guests;
DROP POLICY IF EXISTS invitados_editar ON public.guests;
DROP POLICY IF EXISTS invitados_borrar ON public.guests;

CREATE POLICY invitados_ver ON public.guests FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'invitados') );

CREATE POLICY invitados_crear ON public.guests FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'invitados') );

-- El WITH CHECK es nuevo. Sin el se le puede reescribir el event_id a un
-- invitado y mudarlo a una boda ajena.
CREATE POLICY invitados_editar ON public.guests FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'invitados') )
  WITH CHECK ( public.puede_editar(event_id, 'invitados') );

CREATE POLICY invitados_borrar ON public.guests FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'invitados') );

-- VERIFICADO antes de escribir esto: la puerta publica NO depende de estas
-- policies. Tanto `/api/invitacion/[token]/registro` como la pagina publica
-- entran con service role (`admin()`), que se salta RLS. Y las policies viejas,
-- aunque tenian rol {public}, comparaban contra auth.uid(), que para un anonimo
-- es NULL: nunca le concedieron nada. Pasar a `TO authenticated` no le quita
-- acceso a nadie que hoy lo tenga.

-- ============================================================
-- 2. Acompanantes
-- ============================================================
DROP POLICY IF EXISTS "collaborators can read party_members"  ON public.party_members;
DROP POLICY IF EXISTS "collaborators can write party_members" ON public.party_members;

DROP POLICY IF EXISTS acompanantes_ver    ON public.party_members;
DROP POLICY IF EXISTS acompanantes_crear  ON public.party_members;
DROP POLICY IF EXISTS acompanantes_editar ON public.party_members;
DROP POLICY IF EXISTS acompanantes_borrar ON public.party_members;

-- Los acompanantes son del mismo modulo que su invitado: quien entra a
-- Invitados los ve, y quien puede editarlos es porque puede editar la lista.
CREATE POLICY acompanantes_ver ON public.party_members FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'invitados') );

CREATE POLICY acompanantes_crear ON public.party_members FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'invitados') );

CREATE POLICY acompanantes_editar ON public.party_members FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'invitados') )
  WITH CHECK ( public.puede_editar(event_id, 'invitados') );

CREATE POLICY acompanantes_borrar ON public.party_members FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'invitados') );

-- ============================================================
-- 3. Mesas
-- ============================================================
DROP POLICY IF EXISTS owner_tables                     ON public.tables;
DROP POLICY IF EXISTS "collaborators can read tables"  ON public.tables;
DROP POLICY IF EXISTS "collaborators can write tables" ON public.tables;

DROP POLICY IF EXISTS mesas_ver    ON public.tables;
DROP POLICY IF EXISTS mesas_crear  ON public.tables;
DROP POLICY IF EXISTS mesas_editar ON public.tables;
DROP POLICY IF EXISTS mesas_borrar ON public.tables;

CREATE POLICY mesas_ver ON public.tables FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'mesas') );

CREATE POLICY mesas_crear ON public.tables FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'mesas') );

CREATE POLICY mesas_editar ON public.tables FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'mesas') )
  WITH CHECK ( public.puede_editar(event_id, 'mesas') );

CREATE POLICY mesas_borrar ON public.tables FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'mesas') );

-- ============================================================
-- 4. Asientos
-- ============================================================
DROP POLICY IF EXISTS owner_table_seats                     ON public.table_seats;
DROP POLICY IF EXISTS "collaborators can read table_seats"  ON public.table_seats;
DROP POLICY IF EXISTS "collaborators can write table_seats" ON public.table_seats;

DROP POLICY IF EXISTS asientos_ver    ON public.table_seats;
DROP POLICY IF EXISTS asientos_crear  ON public.table_seats;
DROP POLICY IF EXISTS asientos_editar ON public.table_seats;
DROP POLICY IF EXISTS asientos_borrar ON public.table_seats;

CREATE POLICY asientos_ver ON public.table_seats FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'mesas') );

CREATE POLICY asientos_crear ON public.table_seats FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'mesas') );

CREATE POLICY asientos_editar ON public.table_seats FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'mesas') )
  WITH CHECK ( public.puede_editar(event_id, 'mesas') );

-- DECISION: quitar a alguien de su asiento se borra con permiso de EDITAR, no
-- de total. Un asiento no es un dato, es el acomodo: mover invitados de mesa es
-- la operacion normal de quien arma el plano, y pedirle 'total' para eso lo
-- dejaria sin poder trabajar. Lo que si pide total es borrar la MESA.
CREATE POLICY asientos_borrar ON public.table_seats FOR DELETE TO authenticated
  USING ( public.puede_editar(event_id, 'mesas') );

-- ============================================================
-- 5. La bitacora de borrados
-- ============================================================
-- Las cuatro traen event_id, asi que les sirve la funcion generica.
-- No se cuelga de table_seats: quitar a alguien de una mesa no es una perdida
-- -- el invitado sigue ahi -- y llenaria la bitacora de ruido cada vez que se
-- reacomoda el plano.
DROP TRIGGER IF EXISTS log_borrado_invitado ON public.guests;
CREATE TRIGGER log_borrado_invitado
  AFTER DELETE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('invitados', 'guest', 'name');

DROP TRIGGER IF EXISTS log_borrado_acompanante ON public.party_members;
CREATE TRIGGER log_borrado_acompanante
  AFTER DELETE ON public.party_members
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('invitados', 'party_member', 'name');

DROP TRIGGER IF EXISTS log_borrado_mesa ON public.tables;
CREATE TRIGGER log_borrado_mesa
  AFTER DELETE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('mesas', 'table', 'name');

COMMIT;

-- ============ Verificacion ============
-- 1) Cuatro policies por tabla, dieciseis en total:
SELECT tablename, count(*) AS policies FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('guests', 'party_members', 'tables', 'table_seats')
 GROUP BY tablename ORDER BY tablename;

-- 2) Ninguna policy vieja sobrevivio (deberia dar cero filas):
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('guests', 'party_members', 'tables', 'table_seats')
   AND (policyname LIKE 'Users can%' OR policyname LIKE 'collaborators%' OR policyname LIKE 'owner_%');

-- 3) Los tres disparadores:
SELECT tgrelid::regclass AS tabla, tgname FROM pg_trigger
 WHERE tgname IN ('log_borrado_invitado', 'log_borrado_acompanante', 'log_borrado_mesa')
 ORDER BY 1;

-- 4) Con la sesion del DUENO, que los conteos no cambien:
-- SELECT (SELECT count(*) FROM guests) AS invitados,
--        (SELECT count(*) FROM party_members) AS acompanantes,
--        (SELECT count(*) FROM tables) AS mesas,
--        (SELECT count(*) FROM table_seats) AS asientos;

-- ============ Marcha atras ============
-- Devuelve las cuatro tablas a como estaban el 5-sep-2026, leido de pg_policies.
-- Incluye las duplicadas: revertir significa dejar produccion como estaba.
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS log_borrado_invitado ON public.guests;
-- DROP TRIGGER IF EXISTS log_borrado_acompanante ON public.party_members;
-- DROP TRIGGER IF EXISTS log_borrado_mesa ON public.tables;
--
-- DROP POLICY IF EXISTS invitados_ver ON public.guests;
-- DROP POLICY IF EXISTS invitados_crear ON public.guests;
-- DROP POLICY IF EXISTS invitados_editar ON public.guests;
-- DROP POLICY IF EXISTS invitados_borrar ON public.guests;
-- CREATE POLICY "Users can view guests of their events" ON public.guests FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- CREATE POLICY "Users can insert guests to their events" ON public.guests FOR INSERT
--   WITH CHECK (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- CREATE POLICY "Users can update guests of their events" ON public.guests FOR UPDATE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- CREATE POLICY "Users can delete guests of their events" ON public.guests FOR DELETE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- CREATE POLICY "collaborators can read guests" ON public.guests FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active'));
-- CREATE POLICY "collaborators can insert guests" ON public.guests FOR INSERT
--   WITH CHECK (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
-- CREATE POLICY "collaborators can update guests" ON public.guests FOR UPDATE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
-- CREATE POLICY "collaborators can delete guests" ON public.guests FOR DELETE
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
--
-- DROP POLICY IF EXISTS acompanantes_ver ON public.party_members;
-- DROP POLICY IF EXISTS acompanantes_crear ON public.party_members;
-- DROP POLICY IF EXISTS acompanantes_editar ON public.party_members;
-- DROP POLICY IF EXISTS acompanantes_borrar ON public.party_members;
-- CREATE POLICY "collaborators can read party_members" ON public.party_members FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active'));
-- CREATE POLICY "collaborators can write party_members" ON public.party_members FOR ALL
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
--
-- DROP POLICY IF EXISTS mesas_ver ON public.tables;
-- DROP POLICY IF EXISTS mesas_crear ON public.tables;
-- DROP POLICY IF EXISTS mesas_editar ON public.tables;
-- DROP POLICY IF EXISTS mesas_borrar ON public.tables;
-- CREATE POLICY owner_tables ON public.tables FOR ALL
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- CREATE POLICY "collaborators can read tables" ON public.tables FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active'));
-- CREATE POLICY "collaborators can write tables" ON public.tables FOR ALL
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
--
-- DROP POLICY IF EXISTS asientos_ver ON public.table_seats;
-- DROP POLICY IF EXISTS asientos_crear ON public.table_seats;
-- DROP POLICY IF EXISTS asientos_editar ON public.table_seats;
-- DROP POLICY IF EXISTS asientos_borrar ON public.table_seats;
-- CREATE POLICY owner_table_seats ON public.table_seats FOR ALL
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
-- CREATE POLICY "collaborators can read table_seats" ON public.table_seats FOR SELECT
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active'));
-- CREATE POLICY "collaborators can write table_seats" ON public.table_seats FOR ALL
--   USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()
--          UNION SELECT event_id FROM event_collaborators
--          WHERE user_id = auth.uid() AND status = 'active' AND role = ANY (ARRAY['admin','editor'])));
-- COMMIT;
