-- Puerta publica fase 2: el link publico del evento y el tope de acompanantes.
-- Correr ANTES de desplegar el codigo: el cliente de Supabase no esta tipado,
-- asi que tsc no valida nombres de columna y el fallo saldria en runtime.

alter table event_settings add column if not exists shared_token text;
alter table event_settings add column if not exists max_companions integer;

-- El token es la llave de la puerta: unico y buscado en cada carga del link.
create unique index if not exists event_settings_shared_token_key
  on event_settings (shared_token)
  where shared_token is not null;

-- Verificacion:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'event_settings'
--   and column_name in ('shared_token', 'max_companions');
-- Esperado: 2 filas, ambas is_nullable = YES.
