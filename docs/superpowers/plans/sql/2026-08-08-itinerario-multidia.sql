-- NO EJECUTAR sin OK explicito de Diego.
-- Orden: correr los pasos 1 y 2, desplegar el codigo, y hasta entonces el paso 3.

-- 1. La columna, nullable para no romper las filas que ya existen
alter table event_itinerary_moments add column moment_date date;

-- 2. Backfill: todo lo que ya existe cae en la fecha de inicio del evento
update event_itinerary_moments m
   set moment_date = e.event_date
  from events e
 where e.id = m.event_id
   and m.moment_date is null;

create index on event_itinerary_moments (event_id, moment_date);

-- 3. Solo despues de que el codigo este en main
alter table event_itinerary_moments alter column moment_date set not null;
