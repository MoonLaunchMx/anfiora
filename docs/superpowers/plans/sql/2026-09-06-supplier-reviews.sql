-- Reviews de proveedores: una tabla, tres tipos, dos autores.
-- Correr DESPUES de que el codigo este en origin/main.
-- Los valores validos de motivo_descarte y razones_seleccion viven en
-- lib/types.ts, NO como CHECK: un CHECK fue lo que dejo roto el default de status.

create type review_type as enum ('contratacion', 'descarte', 'post_evento');
create type review_autor as enum ('planner', 'cliente');

create table supplier_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  event_supplier_id uuid not null references event_suppliers(id) on delete cascade,

  review_type review_type not null,
  autor review_autor not null default 'planner',

  precio_valor smallint check (precio_valor between 1 and 5),
  calidad smallint check (calidad between 1 and 5),
  comunicacion smallint check (comunicacion between 1 and 5),
  servicio_trato smallint check (servicio_trato between 1 and 5),
  manejo_imprevistos smallint check (manejo_imprevistos between 1 and 5),

  razones_seleccion text[],
  motivo_descarte text,
  recontratacion smallint check (recontratacion between 1 and 5),
  cobros_extra boolean,
  monto_cobros_extra numeric,

  comentarios text check (char_length(comentarios) <= 500),

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_supplier_id, review_type, autor)
);

create index supplier_reviews_supplier_idx on supplier_reviews (supplier_id);
create index supplier_reviews_event_idx on supplier_reviews (event_id);

alter table supplier_reviews enable row level security;

create policy supplier_reviews_select_own on supplier_reviews
  for select to authenticated
  using (user_id = auth.uid());

create policy supplier_reviews_insert_own on supplier_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

create policy supplier_reviews_update_own on supplier_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy supplier_reviews_delete_own on supplier_reviews
  for delete to authenticated
  using (user_id = auth.uid());

-- Verificacion (deben salir 4 filas, todas {authenticated}):
-- select policyname, roles from pg_policies where tablename = 'supplier_reviews';
