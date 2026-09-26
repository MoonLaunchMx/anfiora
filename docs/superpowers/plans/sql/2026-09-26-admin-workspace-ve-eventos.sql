-- El admin del workspace ve y entra a todos los eventos de su agencia.
--
-- QUE HACE: las tres funciones viejas de acceso por evento (is_event_member,
-- is_event_editor, is_event_admin) ganan una pregunta mas: "o es admin del
-- workspace al que pertenece el evento". Usan es_admin_de, que ya existe y ya
-- es la que consulta nivel_en para las reglas nuevas.
--
-- NINGUNA POLICY CAMBIA DE TEXTO. Las 11 que llaman a estas funciones
-- (leidas en produccion el 26-sep) heredan la respuesta nueva:
--   events: collaborators can read events (SELECT), events_editor_update (UPDATE)
--   event_settings: collaborators can read event_settings, event_settings_editor_insert/update
--   event_collaborators: members read collaborators, admins create/update collaborators
--   event_audit_log: audit_member_insert
-- "owner only" (ALL, incluye DELETE) de events NO se toca: el admin no borra eventos.
--
-- CORRER DESPUES del deploy del PR (tablero + contexto del evento), nunca antes.
-- Todo va en una transaccion: entra completo o no entra nada.

BEGIN;

-- ============================================================
-- 0. Candados que abortan sin cambiar nada
-- ============================================================
DO $$
DECLARE faltan text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'es_admin_de'
                    AND pg_get_function_identity_arguments(p.oid) = 'ws uuid') THEN
    RAISE EXCEPTION 'ABORTA: falta public.es_admin_de(ws uuid). Correr antes 2026-09-08-workspace-cimiento.sql';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'workspace_id') THEN
    RAISE EXCEPTION 'ABORTA: events.workspace_id no existe';
  END IF;

  SELECT string_agg(f, ', ') INTO faltan
    FROM unnest(ARRAY['is_event_member', 'is_event_editor', 'is_event_admin']) f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = 'public' AND p.proname = f
                        AND pg_get_function_identity_arguments(p.oid) = 'eid uuid'
                        AND pg_get_function_result(p.oid) = 'boolean');
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: estas funciones no existen con la firma (eid uuid) -> boolean: %', faltan;
  END IF;
END $$;

-- ============================================================
-- 1. Las tres funciones, mismo cuerpo de hoy mas la tercera pregunta
-- ============================================================
-- Se copian tal cual de 2026-09-05-accesos-timeline-cimiento.sql y solo se
-- agrega el ultimo OR. Mismo tipo, misma firma, mismo search_path con pg_temp.
CREATE OR REPLACE FUNCTION public.is_event_member(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid() AND status = 'active')
      OR EXISTS (SELECT 1 FROM events e
                 WHERE e.id = eid AND e.workspace_id IS NOT NULL
                   AND public.es_admin_de(e.workspace_id));
$function$;

CREATE OR REPLACE FUNCTION public.is_event_editor(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role IN ('admin','editor'))
      OR EXISTS (SELECT 1 FROM events e
                 WHERE e.id = eid AND e.workspace_id IS NOT NULL
                   AND public.es_admin_de(e.workspace_id));
$function$;

CREATE OR REPLACE FUNCTION public.is_event_admin(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role = 'admin')
      OR EXISTS (SELECT 1 FROM events e
                 WHERE e.id = eid AND e.workspace_id IS NOT NULL
                   AND public.es_admin_de(e.workspace_id));
$function$;

COMMIT;


-- ============================================================
-- VERIFICACION (solo lectura, correr despues del COMMIT)
-- ============================================================
SELECT 'V1 las tres funciones ya preguntan por el workspace (esperado: 3)' AS chequeo,
  (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_event_member', 'is_event_editor', 'is_event_admin')
      AND p.prosrc LIKE '%es_admin_de%') AS resultado
UNION ALL
SELECT 'V2 policies que cuelgan de ellas (esperado: 11, las mismas de antes)',
  (SELECT count(*)::text FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%is_event_%' OR with_check LIKE '%is_event_%'))
UNION ALL
SELECT 'V3 owner only de events sigue intacta (esperado: (user_id = auth.uid()))',
  (SELECT qual FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'owner only')
UNION ALL
SELECT 'V4 anon sigue sin ejecutar las tres (esperado: ninguna)',
  (SELECT coalesce(string_agg(p.proname, ', '), 'ninguna') FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('is_event_member', 'is_event_editor', 'is_event_admin')
      AND has_function_privilege('anon', p.oid, 'EXECUTE'));


-- ============================================================
-- PRUEBA COMO ANDRES (se deshace sola, no deja rastro)
-- ============================================================
-- Con SET LOCAL ROLE authenticated el SQL Editor deja de ser postgres y las
-- policies SI aplican, igual que desde el navegador.

-- a) Cuantos eventos ve Andres. Esperado: los 45 de Moon Launch Events
--    (mas los suyos propios, si tiene).
BEGIN;
SELECT set_config('request.jwt.claims',
  (SELECT '{"sub":"' || id || '","role":"authenticated"}' FROM users WHERE email = 'andres@anfiora.com'),
  true);
SET LOCAL ROLE authenticated;
SELECT count(*) AS eventos_que_ve_andres FROM events;
ROLLBACK;

-- b) Andres NO puede borrar un evento ajeno. Esperado: 0 filas.
BEGIN;
SELECT set_config('request.jwt.claims',
  (SELECT '{"sub":"' || id || '","role":"authenticated"}' FROM users WHERE email = 'andres@anfiora.com'),
  true);
SET LOCAL ROLE authenticated;
DELETE FROM events WHERE user_id <> auth.uid() RETURNING id;
ROLLBACK;

-- c) Un colaborador del workspace (rol 'colaborador', sin fila por evento)
--    sigue sin ver nada. Cambia el correo por una cuenta de prueba con ese rol.
--    Esperado: 0 (o solo sus eventos propios y los que le hayan marcado).
-- BEGIN;
-- SELECT set_config('request.jwt.claims',
--   (SELECT '{"sub":"' || id || '","role":"authenticated"}' FROM users WHERE email = '<correo del colaborador de prueba>'),
--   true);
-- SET LOCAL ROLE authenticated;
-- SELECT count(*) AS eventos_que_ve_el_colaborador FROM events;
-- ROLLBACK;


-- ============================================================
-- VERIFICACION ADMIN (framework de seguridad del 24-sep)
-- ============================================================
-- /admin trabaja con service role: no pasa por estas policies. Se ensaya de
-- todos modos, como quedo acordado, para que ningun candado nuevo le estorbe.
-- Cambia el correo por una cuenta de PRUEBA en plan free. Todo se deshace.

-- Borrar usuario. Esperado: "DELETE 1" sin error.
-- BEGIN;
-- DELETE FROM users WHERE email = '<correo de una cuenta de prueba>';
-- ROLLBACK;

-- Cambiar plan. Esperado: una fila con plan = studio.
-- BEGIN;
-- UPDATE workspaces SET plan = 'studio'
--  WHERE primary_owner_id = (SELECT id FROM users WHERE email = '<correo de una cuenta de prueba>')
-- RETURNING id, plan;
-- ROLLBACK;
