-- Cimiento del Tramo 2: lo que hay que dejar sano antes de mover una policy.
--
-- QUE HACE: (1) impide que una persona tenga dos accesos vivos a la misma boda,
-- (2) le agrega pg_temp al search_path de los cuatro helpers que ya existian.
-- No toca ninguna policy: eso es el archivo -policies.
--
-- CORRERLO ENTERO DE UN JALON. Va todo en una transaccion.

BEGIN;

-- ============================================================
-- 1. Un solo acceso vivo por persona y por boda
-- ============================================================
-- Verificado en produccion el 4-sep: hay tres pares con filas repetidas, pero
-- en los tres solo una esta 'active' y el resto 'revoked'. Por eso el indice va
-- PARCIAL: conserva el historial de invitaciones revocadas —que dice quien fue
-- que cosa y cuando— y garantiza lo unico que importa, que no haya dos accesos
-- vivos. Un indice total obligaria a borrar ese historial sin ganar nada.
--
-- Importa porque nivel_en() resuelve con LIMIT 1: con dos filas activas el
-- permiso de esa persona dependeria de cual le toque a la base.
CREATE UNIQUE INDEX IF NOT EXISTS event_collaborators_un_activo
  ON public.event_collaborators (event_id, user_id)
  WHERE user_id IS NOT NULL AND status = 'active';

-- ============================================================
-- 2. pg_temp en los cuatro helpers que ya existian
-- ============================================================
-- Sin pg_temp en el search_path, Postgres lo busca primero para nombres de
-- relacion: es el secuestro clasico de search_path sobre SECURITY DEFINER, y lo
-- marca el linter de Supabase. Los cuerpos NO cambian, se copian tal cual del
-- estado leido en produccion el 4-sep; lo unico que se agrega es pg_temp.
CREATE OR REPLACE FUNCTION public.is_event_owner(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.is_event_member(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid() AND status = 'active');
$function$;

CREATE OR REPLACE FUNCTION public.is_event_editor(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role IN ('admin','editor'));
$function$;

CREATE OR REPLACE FUNCTION public.is_event_admin(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role = 'admin');
$function$;

COMMIT;

-- Verificacion. Debe dar cero: nadie con dos accesos vivos a la misma boda.
SELECT count(*) AS pares_con_dos_activos FROM (
  SELECT event_id, user_id FROM event_collaborators
   WHERE user_id IS NOT NULL AND status = 'active'
   GROUP BY event_id, user_id HAVING count(*) > 1
) t;
