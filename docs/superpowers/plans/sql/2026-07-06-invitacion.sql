-- Aditivo y nullable: no rompe prod. Aplicar en Supabase SOLO tras pushear la rama.
alter table guests add column if not exists rsvp_token text unique;
alter table event_settings add column if not exists invite_config jsonb;

-- Dependencias de OTROS agentes (NO las crea esta feature; referencia por si hace falta probar en local):
-- (agente C) alter table event_settings add column if not exists dress_code jsonb;
-- (agente B) create table event_itinerary_moments (... visible_to_guests boolean, start_time time, title text, location text ...);
