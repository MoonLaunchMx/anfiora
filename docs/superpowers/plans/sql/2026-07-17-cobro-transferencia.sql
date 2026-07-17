-- Fase 4 v1: cobro por transferencia. Dos columnas de ESTADO en guests.
-- Correr ANTES de desplegar el codigo: el cliente de Supabase no esta tipado,
-- asi que tsc no valida nombres de columna y el fallo saldria en runtime.

alter table guests add column if not exists amount_due numeric;
alter table guests add column if not exists paid_at timestamptz;

-- Verificacion:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'guests'
--   and column_name in ('amount_due', 'paid_at');
-- Esperado: 2 filas, ambas is_nullable = YES.
