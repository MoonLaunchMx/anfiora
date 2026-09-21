-- Seguridad, Tramo 1a. SE PUEDE CORRER YA, antes del deploy: nada del codigo
-- usa lo que se cierra aqui (grep en app/ y lib/ del 14-sep; asegurar_workspace
-- solo la llama /api/admin/update-plan con service role, que conserva permiso).
--
-- Cierra, segun el Paso 0 y 0b corridos en produccion:
--   1. Funciones SECURITY DEFINER que cualquiera sin cuenta puede ejecutar.
--      delete_party_members_by_guests e increment_party_size NO revisan quien
--      llama: con ids de invitado borran acompanantes o cambian party_size de
--      cualquier evento. Las demas si revisan, pero nadie las usa.
--   2. La vista user_last_seen: anon lee id y ultimo login de todas las cuentas.
--   3. forms y form_responses sin RLS: anon lee, escribe y borra.
--
-- Todo va en una transaccion. El candado del principio aborta SIN CAMBIAR NADA
-- si alguna policy o funcion de invocador usa lo que se va a cerrar.

BEGIN;

DO $$
DECLARE
  patron text := '(add_guests|add_party_members|create_event|set_event_status|delete_party_members_by_guests|increment_party_size|can_write_event|get_account_capacity|get_event_capacity|asegurar_workspace|plan_del_evento|user_last_seen)';
  en_policies text;
  en_funciones text;
BEGIN
  SELECT string_agg(schemaname || '.' || tablename || ' / ' || policyname, ', ') INTO en_policies
    FROM pg_policies
   WHERE coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ patron;

  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO en_funciones
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND NOT p.prosecdef
     AND p.prosrc ~ patron;

  IF en_policies IS NOT NULL OR en_funciones IS NOT NULL THEN
    RAISE EXCEPTION 'No se cambio nada. Usan algo que se iba a cerrar -> policies: % | funciones: %',
      coalesce(en_policies, '-'), coalesce(en_funciones, '-');
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION
  public.add_guests(uuid, jsonb),
  public.add_party_members(uuid, jsonb),
  public.create_event(jsonb, jsonb),
  public.set_event_status(uuid, text),
  public.delete_party_members_by_guests(uuid[]),
  public.increment_party_size(uuid[], integer),
  public.can_write_event(uuid, uuid),
  public.get_account_capacity(uuid),
  public.get_event_capacity(uuid),
  public.asegurar_workspace(uuid),
  public.plan_del_evento(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.asegurar_workspace(uuid) TO service_role;

-- Segundo candado. set_event_workspace (el trigger que corre al crear un
-- evento) llama asegurar_workspace con los permisos de SU dueno. Si alguna
-- funcion SECURITY DEFINER que usa lo revocado se quedo sin permiso, se
-- deshace todo: crear eventos no puede romperse por esto.
DO $$
DECLARE rotas text;
BEGIN
  SELECT string_agg(llamadora.oid::regprocedure::text || ' -> ' || llamada.oid::regprocedure::text, ', ')
    INTO rotas
    FROM pg_proc llamadora
    JOIN pg_proc llamada
      ON llamada.pronamespace = 'public'::regnamespace
     AND llamada.proname IN ('add_guests', 'add_party_members', 'create_event', 'set_event_status',
                             'delete_party_members_by_guests', 'increment_party_size', 'can_write_event',
                             'get_account_capacity', 'get_event_capacity', 'asegurar_workspace', 'plan_del_evento')
     AND llamadora.prosrc ~ ('\m' || llamada.proname || '\M')
   WHERE llamadora.pronamespace = 'public'::regnamespace
     AND llamadora.oid <> llamada.oid
     AND NOT has_function_privilege(llamadora.proowner, llamada.oid, 'EXECUTE');
  IF rotas IS NOT NULL THEN
    RAISE EXCEPTION 'No se cambio nada. Estas funciones perderian permiso: %', rotas;
  END IF;
END $$;

REVOKE ALL ON public.user_last_seen FROM anon, authenticated;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificacion: todo debe salir false, salvo service_role_asegurar = true.
SELECT jsonb_build_object(
  'anon_delete_party_members', has_function_privilege('anon', 'public.delete_party_members_by_guests(uuid[])', 'EXECUTE'),
  'auth_delete_party_members', has_function_privilege('authenticated', 'public.delete_party_members_by_guests(uuid[])', 'EXECUTE'),
  'anon_increment_party_size', has_function_privilege('anon', 'public.increment_party_size(uuid[],integer)', 'EXECUTE'),
  'anon_asegurar_workspace', has_function_privilege('anon', 'public.asegurar_workspace(uuid)', 'EXECUTE'),
  'auth_asegurar_workspace', has_function_privilege('authenticated', 'public.asegurar_workspace(uuid)', 'EXECUTE'),
  'service_role_asegurar', has_function_privilege('service_role', 'public.asegurar_workspace(uuid)', 'EXECUTE'),
  'anon_plan_del_evento', has_function_privilege('anon', 'public.plan_del_evento(uuid)', 'EXECUTE'),
  'anon_user_last_seen', has_table_privilege('anon', 'public.user_last_seen', 'SELECT'),
  'auth_user_last_seen', has_table_privilege('authenticated', 'public.user_last_seen', 'SELECT'),
  'forms_sin_rls', NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.forms'::regclass),
  'form_responses_sin_rls', NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.form_responses'::regclass)
) AS resultado;

-- COMO REVERTIR (solo si algo se rompe; regresa el hueco):
-- GRANT EXECUTE ON FUNCTION public.add_guests(uuid, jsonb), public.add_party_members(uuid, jsonb),
--   public.create_event(jsonb, jsonb), public.set_event_status(uuid, text),
--   public.delete_party_members_by_guests(uuid[]), public.increment_party_size(uuid[], integer),
--   public.can_write_event(uuid, uuid), public.get_account_capacity(uuid), public.get_event_capacity(uuid),
--   public.asegurar_workspace(uuid), public.plan_del_evento(uuid) TO anon, authenticated;
-- GRANT SELECT ON public.user_last_seen TO anon, authenticated;
-- ALTER TABLE public.forms DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.form_responses DISABLE ROW LEVEL SECURITY;
