-- Auditoria de seguridad, Paso 0b. SOLO LECTURA: no cambia nada.
-- El Paso 0 mostro 10 funciones SECURITY DEFINER que anon puede ejecutar y
-- cuyo SQL no esta en el repo. Antes de revocar nada hay que leer que hacen:
-- si alguna no revisa auth.uid(), cualquiera la puede llamar sobre cualquier
-- evento. Tambien la vista user_last_seen, que anon lee (23 filas).

select p.oid::regprocedure::text as que, pg_get_functiondef(p.oid) as detalle
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in (
    'add_guests', 'add_party_members', 'create_event', 'set_event_status',
    'delete_party_members_by_guests', 'increment_party_size', 'can_write_event',
    'get_account_capacity', 'get_event_capacity', 'handle_new_user')

union all
select 'VISTA user_last_seen', pg_get_viewdef('public.user_last_seen'::regclass, true)

union all
select 'GRANTS user_last_seen',
  jsonb_build_object(
    'anon', has_table_privilege('anon', 'public.user_last_seen', 'SELECT'),
    'authenticated', has_table_privilege('authenticated', 'public.user_last_seen', 'SELECT'))::text

union all
select 'authenticated: SELECT de tabla completa en events / event_settings',
  jsonb_build_object(
    'events', has_table_privilege('authenticated', 'public.events', 'SELECT'),
    'event_settings', has_table_privilege('authenticated', 'public.event_settings', 'SELECT'))::text

union all
select 'anon: escritura en forms',
  jsonb_build_object(
    'insert', has_table_privilege('anon', 'public.forms', 'INSERT'),
    'update', has_table_privilege('anon', 'public.forms', 'UPDATE'),
    'delete', has_table_privilege('anon', 'public.forms', 'DELETE'))::text

union all
select 'forms: la fila que existe',
  (select jsonb_agg(jsonb_build_object('event_id', event_id, 'type', type, 'title', title, 'created_at', created_at))
   from public.forms)::text;
