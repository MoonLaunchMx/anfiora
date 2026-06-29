-- =============================================================================
-- anfiora.sql  ·  Acoplamiento de dominio (SOLO Anfiora)
-- -----------------------------------------------------------------------------
-- Aqui vive TODO lo que ata el nucleo agnostico al dominio de eventos:
--   - FKs reales (workspace, operador, evento, invitado, proveedor)
--   - columnas de vinculo de dominio en conversations
--   - CHECK de exclusividad invitado/proveedor
--   - indices que dependen del dominio
--   - politicas RLS (dueno del evento + colaborador)
--
-- En la app de ventas este archivo se REESCRIBE (customer_id, store_id, ...).
-- core.sql NO cambia. Esa es la promesa de portabilidad.
-- Se aplica DESPUES de core.sql.
--
-- NOTA: en este repo el estado aceptado de event_collaborators es 'active'
-- (no 'accepted'). Las politicas de colaborador usan 'active'.
-- =============================================================================

-- 1) FKs de las columnas intrinsecas del nucleo -------------------------------
alter table channel_accounts
  add constraint fk_ca_workspace foreign key (workspace_id) references users(id) on delete cascade;
alter table channel_participants
  add constraint fk_cp_workspace foreign key (workspace_id) references users(id) on delete cascade;
alter table conversations
  add constraint fk_cv_workspace foreign key (workspace_id)     references users(id) on delete cascade,
  add constraint fk_cv_assignee  foreign key (assigned_user_id) references users(id) on delete set null;
alter table messages
  add constraint fk_ms_workspace foreign key (workspace_id)   references users(id) on delete cascade,
  add constraint fk_ms_author    foreign key (author_user_id) references users(id) on delete set null;

-- 2) Vinculos de dominio en la conversacion -----------------------------------
-- tenant_id (evento), contact_guest_id (invitado), contact_supplier_id (proveedor).
-- Los TRES nullable: una conversacion nueva de un numero desconocido (prospecto
-- o spam) entra con los tres en NULL y vive en el inbox general hasta clasificarse.
alter table conversations
  add column tenant_id           uuid,
  add column contact_guest_id    uuid,
  add column contact_supplier_id uuid;

-- ON DELETE: NUNCA destruir un hilo por borrar una entidad de dominio.
-- TODO es SET NULL: al borrar el evento/invitado/proveedor, la conversacion se
-- DESVINCULA y cae al inbox general, pero su historial sobrevive.
alter table conversations
  add constraint fk_cv_tenant   foreign key (tenant_id)           references events(id)    on delete set null,
  add constraint fk_cv_guest    foreign key (contact_guest_id)    references guests(id)    on delete set null,
  add constraint fk_cv_supplier foreign key (contact_supplier_id) references suppliers(id) on delete set null;

-- CHECK: como MAXIMO uno de los dos vinculos de contacto. Ambos NULL es valido.
alter table conversations
  add constraint chk_cv_contact_xor
  check (not (contact_guest_id is not null and contact_supplier_id is not null));

-- 3) Indices de dominio --------------------------------------------------------
create index on conversations (tenant_id, status, last_message_at desc);  -- inbox por evento
create index on conversations (contact_supplier_id) where contact_supplier_id is not null;
create index on conversations (contact_guest_id)    where contact_guest_id    is not null;

-- 4) RLS de dominio: dueno del evento + colaborador ---------------------------
-- Frontera de seguridad de DOS niveles:
--   - Inbox general   -> el DUENO del workspace ve TODO lo de sus canales.
--   - Inbox de evento -> un COLABORADOR ve solo conversaciones de SU evento
--                        (invitados por tenant_id + proveedores por event_suppliers).
--   - Sin clasificar  -> solo el dueno.
-- (auth.uid() = users.id en Anfiora. status aceptado = 'active' en este repo.)

create policy ca_owner on channel_accounts     for all using (workspace_id = auth.uid());
create policy cp_owner on channel_participants for all using (workspace_id = auth.uid());
create policy ms_owner on messages             for all using (workspace_id = auth.uid());

create policy cv_owner on conversations for all
  using (workspace_id = auth.uid());

create policy cv_collaborator on conversations for select
  using (
    tenant_id in (
      select event_id from event_collaborators
      where user_id = auth.uid() and status = 'active'
    )
    or contact_supplier_id in (
      select es.supplier_id
      from event_suppliers es
      join event_collaborators ec on ec.event_id = es.event_id
      where ec.user_id = auth.uid() and ec.status = 'active'
    )
  );

-- Lectura de mensajes por colaboradores: via la conversacion visible.
create policy ms_collaborator on messages for select
  using (
    conversation_id in (
      select id from conversations
      where tenant_id in (
        select event_id from event_collaborators
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- webhook_events: sin politica -> solo service_role. Correcto: el cliente nunca
-- toca payloads crudos ni credenciales.
