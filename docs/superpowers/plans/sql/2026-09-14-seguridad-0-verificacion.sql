-- Auditoria de seguridad, Paso 0. SOLO LECTURA: no cambia nada.
-- Correr completo en el SQL Editor de produccion. Regresa UNA tabla
-- (chequeo, resultado). Copiar el resultado entero y pegarlo en el chat.
--
-- Confirma lo que la auditoria del 14-sep infirio de los .sql del repo y que
-- no se puede ver con la llave publica: policies reales, que funciones puede
-- llamar cualquiera, si el candado de la CLABE perdio el mapa por herramienta,
-- si un usuario puede editarse el plan, y storage.

with
tablas as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
columnas_anon as (
  select t.relname, jsonb_agg(a.attname order by a.attname) cols
  from tablas t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  where not has_table_privilege('anon', t.oid, 'SELECT')
    and has_column_privilege('anon', t.oid, a.attnum, 'SELECT')
  group by t.relname
),
guard as (
  select prosrc from pg_proc
  where proname = 'guard_event_config' and pronamespace = 'public'::regnamespace
)

select '01 tablas SIN RLS' as chequeo,
  coalesce(jsonb_agg(relname order by relname), '[]'::jsonb) as resultado
from tablas where not relrowsecurity

union all
select '02 anon: SELECT de tabla completa',
  coalesce(jsonb_agg(relname order by relname), '[]'::jsonb)
from tablas where has_table_privilege('anon', oid, 'SELECT')

union all
select '03 anon: SELECT solo por columnas',
  coalesce(jsonb_object_agg(relname, cols), '{}'::jsonb)
from columnas_anon

union all
select '04 policies que alcanzan a anon (roles anon o public)',
  coalesce(jsonb_agg(jsonb_build_object(
    'tabla', schemaname || '.' || tablename, 'policy', policyname, 'cmd', cmd,
    'roles', roles, 'using', qual, 'check', with_check) order by tablename, policyname), '[]'::jsonb)
from pg_policies
where schemaname in ('public', 'storage') and roles && array['anon', 'public']::name[]

union all
select '05 policies de las tablas del Tramo 1 y 2',
  coalesce(jsonb_agg(jsonb_build_object(
    'tabla', tablename, 'policy', policyname, 'cmd', cmd,
    'roles', roles, 'using', qual, 'check', with_check) order by tablename, policyname), '[]'::jsonb)
from pg_policies
where schemaname = 'public' and tablename in (
  'events', 'event_settings', 'song_recommendations', 'users', 'forms', 'form_responses',
  'event_audit_log', 'event_collaborators', 'workspace_members', 'workspaces',
  'conversations', 'messages', 'channel_accounts', 'channel_participants',
  'terms_acceptances')

union all
select '06 funciones SECURITY DEFINER y quien las ejecuta',
  coalesce(jsonb_agg(jsonb_build_object(
    'fn', p.oid::regprocedure::text,
    'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'config', p.proconfig) order by p.proname), '[]'::jsonb)
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef

union all
select '07 increment/decrement_guests',
  coalesce(jsonb_agg(jsonb_build_object(
    'fn', p.oid::regprocedure::text, 'definer', p.prosecdef,
    'anon', has_function_privilege('anon', p.oid, 'EXECUTE')) order by p.proname), '[]'::jsonb)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('increment_guests', 'decrement_guests', 'increment_guests_by')

union all
select '08 guard_event_config: que columnas vigila',
  coalesce(jsonb_agg(jsonb_build_object(
    'mapa_por_herramienta', prosrc like '%por_modulo%',
    'registry_payment_info', prosrc like '%registry_payment_info%',
    'invite_config', prosrc like '%invite_config%',
    'review_token', prosrc like '%review_token%',
    'shared_token', prosrc like '%shared_token%')), '[]'::jsonb)
from guard

union all
select '09 triggers en public (tabla -> definicion)',
  coalesce(jsonb_agg(jsonb_build_object(
    'tabla', tgrelid::regclass::text, 'trigger', tgname,
    'def', pg_get_triggerdef(t.oid)) order by tgrelid::regclass::text, tgname), '[]'::jsonb)
from pg_trigger t
where not tgisinternal
  and tgrelid in (select oid from tablas)

union all
select '10 users: authenticated puede editar plan?',
  jsonb_build_object(
    'update_plan', has_column_privilege('authenticated', 'public.users', 'plan', 'UPDATE'),
    'insert_plan', has_column_privilege('authenticated', 'public.users', 'plan', 'INSERT'))

union all
select '11 planes distintos de free (revisar que TU los hayas puesto)',
  jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'plan', plan)), '[]'::jsonb)
              from public.users where plan is not null and plan <> 'free'),
    'workspaces', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'plan', plan)), '[]'::jsonb)
                   from public.workspaces where plan is not null and plan <> 'free'))

union all
select '12 invite_token visible para authenticated',
  jsonb_build_object(
    'event_collaborators', has_column_privilege('authenticated', 'public.event_collaborators', 'invite_token', 'SELECT'),
    'workspace_members', has_column_privilege('authenticated', 'public.workspace_members', 'invite_token', 'SELECT'))

union all
select '13 vistas en public',
  coalesce(jsonb_agg(jsonb_build_object('vista', c.relname, 'tipo', c.relkind, 'opciones', c.reloptions)), '[]'::jsonb)
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')

union all
select '14 storage: buckets',
  coalesce(jsonb_agg(jsonb_build_object('bucket', id, 'publico', public, 'limite', file_size_limit)), '[]'::jsonb)
from storage.buckets

union all
select '15 storage: policies',
  coalesce(jsonb_agg(jsonb_build_object(
    'policy', policyname, 'cmd', cmd, 'roles', roles, 'using', qual, 'check', with_check)
    order by policyname), '[]'::jsonb)
from pg_policies where schemaname = 'storage'

union all
select '16 forms: filas',
  jsonb_build_object(
    'forms', (select count(*) from public.forms),
    'form_responses', (select count(*) from public.form_responses))

union all
select '17 cuentas sin correo confirmado',
  jsonb_build_object(
    'sin_confirmar', (select count(*) from auth.users where email_confirmed_at is null),
    'total', (select count(*) from auth.users));
