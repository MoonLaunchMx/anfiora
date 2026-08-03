-- Dashboard v2: cifras del banner y acomodo del tablero, por evento.
-- Nullable y sin default a proposito: NULL = nunca lo personalizaron y la app
-- deriva todo al vuelo. Asi no hay que migrar las filas ya existentes.
alter table public.event_settings
  add column if not exists dashboard_layout jsonb;

-- Comprobacion (debe devolver 1):
select count(*) as existe
from information_schema.columns
where table_schema = 'public'
  and table_name = 'event_settings'
  and column_name = 'dashboard_layout';
