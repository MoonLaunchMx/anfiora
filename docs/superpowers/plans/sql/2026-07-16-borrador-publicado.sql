-- Borrador vs publicado en la invitacion. Correr ANTES de desplegar el codigo.
-- invite_config se queda siendo LO PUBLICADO (las rutas publicas no cambian);
-- invite_draft es el borrador que edita el anfitrion.

alter table event_settings add column if not exists invite_draft jsonb;

-- El editor arranca con lo que ya hay. Los eventos ya publicados quedan con
-- draft == config, o sea sin cambios pendientes al inicio (correcto).
update event_settings set invite_draft = invite_config where invite_config is not null;

-- Verificacion:
-- select count(*) filter (where invite_draft is not null) as con_borrador,
--        count(*) filter (where invite_config is not null) as con_publicado
-- from event_settings;
-- Esperado: con_borrador == con_publicado.
