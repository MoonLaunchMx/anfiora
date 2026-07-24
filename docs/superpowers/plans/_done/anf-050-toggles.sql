-- ANF-050: herramientas por evento (toggles)
-- ORDEN: correr DESPUES de que el codigo este en origin/main y deployado (regla de sincronia Supabase-Vercel).
-- La columna es nullable y aditiva: inerte para el codigo viejo, y el codigo nuevo tolera su ausencia.

-- ── PASO 0 (read-only, correr primero y revisar): grants actuales de event_settings ──
-- Si 'authenticated' tiene SELECT/INSERT/UPDATE a nivel de TABLA, no se necesita ningun grant extra.
-- Si los grants son por COLUMNA (como se hizo con 'anon' en ANF-049), agregar enabled_features
-- al grant de authenticated (NUNCA al de anon — la pagina publica no necesita esta columna).
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'event_settings'
order by grantee, privilege_type;

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'event_settings'
order by grantee, column_name, privilege_type;

-- ── PASO 1: columna nueva ──
alter table public.event_settings
  add column if not exists enabled_features jsonb;

-- ── PASO 2 (SOLO si el paso 0 mostro grants por columna para authenticated): ──
-- grant select (enabled_features), insert (enabled_features), update (enabled_features)
--   on public.event_settings to authenticated;

-- ── Verificacion ──
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'event_settings' and column_name = 'enabled_features';
