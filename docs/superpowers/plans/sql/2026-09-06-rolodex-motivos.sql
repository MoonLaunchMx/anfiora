-- Rolodex, paso 2: por que se cayo / por que se quedo
-- Corrido en Supabase el 6-sep-2026 (verificado: 2 filas, text, nullable).
-- Sin CHECK a proposito: los valores validos viven en lib/types.ts como el
-- resto de los enums. Un CHECK en la base fue lo que dejo roto el default de status.

alter table public.event_suppliers
  add column if not exists discard_reason text;

alter table public.event_suppliers
  add column if not exists win_reason text;

-- Verificacion (debe dar 2 filas):
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'event_suppliers'
--   and column_name in ('discard_reason', 'win_reason')
-- order by column_name;
