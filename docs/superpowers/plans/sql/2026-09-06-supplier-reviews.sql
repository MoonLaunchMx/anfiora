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

-- LAS POLICIES NO SE ESCRIBEN CONTRA auth.uid() = user_id, A PROPOSITO.
--
-- user_id aqui es el DUENO DE LA CUENTA (events.user_id), la misma llave que
-- usan suppliers y categories: el catalogo y su historial son del despacho, no
-- de quien teclea. Una policy user_id = auth.uid() dejaria fuera a todo
-- colaborador con permiso de editar Proveedores -- que es un rol real -- y de
-- paso partiria el score historico del proveedor por persona.
--
-- Este mismo archivo lleva las policies de 2026-09-06-supplier-reviews-policies.sql.
-- Estan repetidas a proposito: aquel sirve para una base donde la tabla ya se
-- creo con las policies viejas; este, para crearla bien de una vez.
--
-- Requisito: ya corrieron 2026-09-04-accesos-cimiento.sql (puede_ver /
-- puede_editar) y 2026-09-06-accesos-finanzas-policies.sql.

-- Ver: el dueno siempre; los demas, si pueden ver Proveedores en esa boda.
create policy reviews_ver on supplier_reviews for select to authenticated
  using ( user_id = auth.uid() or public.puede_ver(event_id, 'proveedores') );

-- Escribir: quien edita Proveedores en esa boda. El EXISTS sobre events es lo
-- que hace cumplir el significado de la columna: la review nace colgada del
-- dueno de la boda y de nadie mas, venga de quien venga.
create policy reviews_crear on supplier_reviews for insert to authenticated
  with check (
    public.puede_editar(event_id, 'proveedores')
    and exists (select 1 from public.events e
                 where e.id = supplier_reviews.event_id
                   and e.user_id = supplier_reviews.user_id)
  );

-- El WITH CHECK no es opcional: sin el, quien puede corregir una review puede
-- reescribirle el event_id o el user_id y mudarla a una boda ajena.
create policy reviews_editar on supplier_reviews for update to authenticated
  using      ( public.puede_editar(event_id, 'proveedores') )
  with check (
    public.puede_editar(event_id, 'proveedores')
    and exists (select 1 from public.events e
                 where e.id = supplier_reviews.event_id
                   and e.user_id = supplier_reviews.user_id)
  );

-- Borrar se queda con el dueno, igual que en suppliers: una review es el
-- historial del despacho y ninguna pantalla la borra hoy.
create policy reviews_borrar on supplier_reviews for delete to authenticated
  using ( user_id = auth.uid() );

-- Verificacion (deben salir 4 filas, todas {authenticated}):
-- select policyname, cmd, roles from pg_policies where tablename = 'supplier_reviews';
