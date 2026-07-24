-- NO EJECUTAR hasta que el codigo este en main y con OK explicito de Diego.
create table event_itinerary_moments (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  title             text not null,
  start_time        time not null,
  duration_min      integer,
  location          text,
  phase             text not null default 'otro',
  event_supplier_id uuid references event_suppliers(id) on delete set null,
  assigned_to_name  text,
  notes             text,
  visible_to_guests boolean not null default false,
  position          integer not null default 0,
  created_at        timestamptz not null default now()
);
create index on event_itinerary_moments (event_id);
