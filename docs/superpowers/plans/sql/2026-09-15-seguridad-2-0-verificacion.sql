-- Seguridad, Tramo 2, Paso 0. SOLO LECTURA: no cambia nada.
-- Correr completo en el SQL Editor de produccion y pegar el resultado.
--
-- Lo que necesito ver antes de escribir los candados del Tramo 2:
--   A. Candado de la CLABE: todas las columnas de event_settings y events, y la
--      definicion vigente de guard_event_config y puede_editar.
--   B. users.plan: columnas de users (para candar solo lo que es de admin).
--   C. Storage event-media: si existe owner_id y cuantos archivos hay por
--      carpeta y sin dueno (esos no los podria borrar nadie tras el candado).
--   D. Mover filas entre eventos: que tablas tienen event_id y las policies de
--      UPDATE de las tablas con llave a otro padre.
--   E. Bitacora: que acciones .deleted existen, quien las escribio, y si las
--      funciones que la llenan son security definer (si no, candar el INSERT
--      del cliente romperia los borrados).

select 'A1 columnas event_settings' as chequeo,
  (select jsonb_agg(column_name order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'event_settings')::text as resultado

union all
select 'A2 columnas events',
  (select jsonb_agg(column_name order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'events')::text

union all
select 'A3 guard_event_config vigente',
  (select pg_get_functiondef(p.oid) from pg_proc p
    where p.proname = 'guard_event_config' and p.pronamespace = 'public'::regnamespace)

union all
select 'A4 puede_editar vigente',
  (select pg_get_functiondef(p.oid) from pg_proc p
    where p.proname = 'puede_editar' and p.pronamespace = 'public'::regnamespace)

union all
select 'B1 columnas users',
  (select jsonb_agg(column_name order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'users')::text

union all
select 'C1 columnas storage.objects',
  (select jsonb_agg(column_name order by ordinal_position)
     from information_schema.columns
    where table_schema = 'storage' and table_name = 'objects')::text

union all
select 'C2 event-media por carpeta (total / sin owner_id)',
  (select jsonb_object_agg(carpeta, jsonb_build_object('total', total, 'sin_dueno', sin_dueno))
     from (select split_part(o.name, '/', 1) carpeta,
                  count(*) total,
                  count(*) filter (where coalesce(to_jsonb(o) ->> 'owner_id', to_jsonb(o) ->> 'owner') is null) sin_dueno
             from storage.objects o
            where o.bucket_id = 'event-media'
            group by 1) x)::text

union all
select 'D1 tablas con event_id',
  (select jsonb_agg(table_name order by table_name)
     from information_schema.columns
    where table_schema = 'public' and column_name = 'event_id'
      and table_name in (select tablename from pg_tables where schemaname = 'public'))::text

union all
select 'D2 policies de UPDATE (tablas del evento)',
  (select jsonb_agg(jsonb_build_object('tabla', tablename, 'policy', policyname, 'roles', roles,
                                       'using', qual, 'check', with_check) order by tablename)
     from pg_policies
    where schemaname = 'public' and cmd in ('UPDATE', 'ALL')
      and tablename in ('guests', 'party_members', 'tables', 'table_seats', 'event_budgets',
                        'event_suppliers', 'supplier_payments', 'gift_registry_items',
                        'gift_reservations', 'wa_messages', 'supplier_reviews'))::text

union all
select 'E1 bitacora: acciones .deleted (cuantas / con user_id)',
  (select jsonb_object_agg(action, jsonb_build_object('total', total, 'con_usuario', con_usuario))
     from (select action, count(*) total, count(user_id) con_usuario
             from public.event_audit_log
            where action like '%.deleted'
            group by action) x)::text

union all
select 'E2 funciones que escriben la bitacora (dueno / security definer)',
  (select jsonb_agg(jsonb_build_object('fn', p.proname, 'owner', pg_get_userbyid(p.proowner),
                                       'definer', p.prosecdef) order by p.proname)
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosrc ilike '%event_audit_log%')::text

union all
select 'E3 policies de event_audit_log',
  (select jsonb_agg(jsonb_build_object('policy', policyname, 'cmd', cmd, 'roles', roles,
                                       'using', qual, 'check', with_check))
     from pg_policies
    where schemaname = 'public' and tablename = 'event_audit_log')::text

union all
select 'B2 policies y triggers de users',
  jsonb_build_object(
    'policies', (select jsonb_agg(jsonb_build_object('policy', policyname, 'cmd', cmd, 'roles', roles,
                                                     'using', qual, 'check', with_check))
                   from pg_policies where schemaname = 'public' and tablename = 'users'),
    'triggers', (select jsonb_agg(tgname) from pg_trigger
                  where tgrelid = 'public.users'::regclass and not tgisinternal)
  )::text

union all
select 'C3 policies de storage.objects',
  (select jsonb_agg(jsonb_build_object('policy', policyname, 'cmd', cmd, 'roles', roles,
                                       'using', qual, 'check', with_check) order by policyname)
     from pg_policies
    where schemaname = 'storage' and tablename = 'objects')::text;
