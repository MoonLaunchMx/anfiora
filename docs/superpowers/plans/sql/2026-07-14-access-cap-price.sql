-- ANF-054 — modo de acceso, cupo y precio del evento.
--
-- CORRER ESTO ANTES de deployar el codigo: el insert de NewEventModal escribe
-- estas tres columnas y revienta la creacion de eventos si no existen.
-- Anfiora tiene UNA sola base, asi que localhost tambien pega aqui: sin esto
-- no se puede ni verificar en local.
--
-- Las tres son nullable y nadie las lee todavia -> correrlas antes es inofensivo.
-- Sin tablas nuevas. Sin RLS nuevo.

alter table event_settings add column if not exists access_mode text;
alter table events        add column if not exists guest_cap int;
alter table events        add column if not exists ticket_price numeric;
