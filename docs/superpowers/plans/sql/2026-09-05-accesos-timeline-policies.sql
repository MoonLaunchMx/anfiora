-- Tramo 2: el Timeline pasa a gobernarse por permisos por herramienta.
--
-- ESTE ES EL PRIMER ARCHIVO QUE CAMBIA POLICIES QUE YA EXISTEN. Hasta hoy todo
-- el trabajo de accesos fue aditivo; a partir de aqui no.
--
-- REQUISITOS, en este orden:
--   1. -migracion-aplicar.sql ya corrio (todos los colaboradores tienen permisos)
--   2. El codigo del Tramo 2 esta en produccion, incluida la invitacion que
--      escribe permisos. Sin eso, cada persona invitada despues de la migracion
--      tendria permisos vacios y esta policy la dejaria fuera.
--   3. -accesos-timeline-cimiento.sql ya corrio
--
-- QUE ARREGLA: event_timeline_tasks tenia la escritura amarrada a
-- events.user_id — solo el dueno — y una lectura que si incluia colaboradores.
-- Ese es el "se ve normal y no guarda" del §1 del spec. event_itinerary_moments
-- ya usaba is_event_editor/is_event_member, que funciona pero es por evento
-- completo; pasa al mismo modelo por herramienta que las tareas.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Tareas del timeline
-- ============================================================
DROP POLICY IF EXISTS "Planners can manage their own timeline tasks" ON public.event_timeline_tasks;
DROP POLICY IF EXISTS "collaborators can read timeline_tasks"        ON public.event_timeline_tasks;

DROP POLICY IF EXISTS timeline_ver    ON public.event_timeline_tasks;
DROP POLICY IF EXISTS timeline_crear  ON public.event_timeline_tasks;
DROP POLICY IF EXISTS timeline_editar ON public.event_timeline_tasks;
DROP POLICY IF EXISTS timeline_borrar ON public.event_timeline_tasks;

CREATE POLICY timeline_ver ON public.event_timeline_tasks FOR SELECT
  USING ( public.puede_ver(event_id, 'timeline') );

CREATE POLICY timeline_crear ON public.event_timeline_tasks FOR INSERT
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY timeline_editar ON public.event_timeline_tasks FOR UPDATE
  USING      ( public.puede_editar(event_id, 'timeline') )
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY timeline_borrar ON public.event_timeline_tasks FOR DELETE
  USING ( public.puede_borrar(event_id, 'timeline') );

-- ============================================================
-- 2. Momentos del itinerario — mismo modulo, mismas reglas
-- ============================================================
DROP POLICY IF EXISTS itinerary_editor_write  ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerary_member_select ON public.event_itinerary_moments;

DROP POLICY IF EXISTS itinerario_ver    ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerario_crear  ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerario_editar ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerario_borrar ON public.event_itinerary_moments;

CREATE POLICY itinerario_ver ON public.event_itinerary_moments FOR SELECT
  USING ( public.puede_ver(event_id, 'timeline') );

CREATE POLICY itinerario_crear ON public.event_itinerary_moments FOR INSERT
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY itinerario_editar ON public.event_itinerary_moments FOR UPDATE
  USING      ( public.puede_editar(event_id, 'timeline') )
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY itinerario_borrar ON public.event_itinerary_moments FOR DELETE
  USING ( public.puede_borrar(event_id, 'timeline') );

-- ============================================================
-- 3. La bitacora de borrados, colgada de estas dos tablas
-- ============================================================
-- Verificado el 4-sep: event_audit_log.user_id y user_name aceptan NULL, no hay
-- ningun CHECK sobre action ni entity_type, y user_email lo cubre el COALESCE de
-- la funcion. Nada de esto puede tumbar un borrado.
--
-- OJO, y es la razon de que estos disparadores NO vayan sobre events: la llave
-- event_audit_log.event_id -> events(id) es ON DELETE CASCADE. Al borrar una
-- boda, su bitacora se va con ella. Para el borrado de una tarea o un momento
-- funciona perfecto; guardar el borrado de la boda entera exige cambiar esa
-- llave, y eso se decide en el tramo de Actividad.
DROP TRIGGER IF EXISTS log_borrado_timeline ON public.event_timeline_tasks;
CREATE TRIGGER log_borrado_timeline
  AFTER DELETE ON public.event_timeline_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('timeline', 'timeline_task', 'title');

DROP TRIGGER IF EXISTS log_borrado_itinerario ON public.event_itinerary_moments;
CREATE TRIGGER log_borrado_itinerario
  AFTER DELETE ON public.event_itinerary_moments
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('timeline', 'itinerary_moment', 'title');

COMMIT;

-- Verificacion. La primera debe dar 8 (cuatro policies por tabla) y la segunda 2.
SELECT count(*) AS policies_del_timeline FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('event_timeline_tasks', 'event_itinerary_moments');

SELECT count(*) AS disparadores_de_bitacora FROM pg_trigger
 WHERE tgname IN ('log_borrado_timeline', 'log_borrado_itinerario');
