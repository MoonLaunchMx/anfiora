-- =============================================================================
-- core.sql  ·  Nucleo omnicanal (AGNOSTICO DE DOMINIO)
-- -----------------------------------------------------------------------------
-- Copiable VERBATIM a cualquier app (eventos, ventas, etc.).
-- NO contiene una sola palabra de dominio: ni evento, ni invitado, ni proveedor.
--
-- Lo unico "de negocio" que vive aqui es workspace_id = quien conecto la
-- integracion. Eso es INTRINSECO a la mensajeria (sin dueno no hay canal) y es
-- justo lo que permite asegurar el nucleo por si solo via RLS, sin depender del
-- dominio. NO lo saques de aqui.
--
-- IDs: se recomienda UUIDv7 (mejor localidad en el indice B-tree + desempate por
-- tiempo de insercion). Si tu Postgres no lo tiene nativo (< v18) instala la
-- extension pg_uuidv7 y cambia el DEFAULT, o deja gen_random_uuid() (v4).
-- El UUIDv7 es para SALUD DEL INDICE, NO para ordenar el display (eso se hace
-- por provider_timestamp).
-- =============================================================================

-- channel_accounts: cuentas conectadas por canal (un numero WA, una pagina FB,
-- una cuenta IG, un bot de Telegram...). Pertenecen al WORKSPACE, no al evento:
-- una misma cuenta sirve a muchos eventos.
create table channel_accounts (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null,                  -- FK -> users, se agrega en anfiora.sql
  channel             text not null,                  -- enum ABIERTO: 'whatsapp'|'instagram'|'facebook'|'telegram'|'tiktok'|...
  external_account_id text,                           -- phone_number_id (WA), page id (FB), ig id, bot id
  display_label       text,
  credentials_ref     text,                           -- referencia a secreto cifrado (Vault) o blob cifrado; NUNCA texto plano
  status              text not null default 'active', -- 'active'|'disconnected'|'failing'
  last_error          text,
  token_expires_at    timestamptz,                    -- tokens long-lived de Meta caducan ~60d -> job de refresh
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (channel, external_account_id)
);

-- channel_participants: la persona-en-ese-canal, con identidad propia y perfil.
-- Se separa de conversations para no incrustar la identidad en cada hilo.
create table channel_participants (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null,                  -- denormalizado para RLS sin join
  channel_account_id  uuid not null references channel_accounts(id) on delete cascade,
  external_id         text not null,                  -- E.164 (WA), PSID (FB), IGSID (IG), chat_id (TG)
  display_name        text,
  profile             jsonb not null default '{}',    -- avatar, locale, metadata de la plataforma
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (channel_account_id, external_id)
);

-- conversations: un hilo por (cuenta de canal + participante). UNO solo: se
-- reusa, no se duplica al reabrir. tenant_id / contact_* NO viven aqui: son
-- dominio y se agregan en anfiora.sql.
create table conversations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null,                  -- denormalizado: RLS + inbox general sin join
  channel_account_id  uuid not null references channel_accounts(id) on delete cascade,
  participant_id      uuid not null references channel_participants(id) on delete restrict,
  status              text not null default 'open',   -- 'open'|'snoozed'|'closed'
  ai_enabled          boolean not null default true,  -- HANDOFF: en false el cerebro IA se calla
  assigned_user_id    uuid,                           -- operador humano; FK -> users en anfiora.sql
  last_message_at     timestamptz,
  last_inbound_at     timestamptz,                    -- ventana 24h: texto libre vs plantilla aprobada
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (channel_account_id, participant_id)
);

-- messages: mensaje canonico. Append-only. Ordenar SIEMPRE por provider_timestamp.
-- content_text para display/busqueda; payload para estructura rica.
create table messages (
  id                  uuid primary key default gen_random_uuid(),  -- UUIDv7 recomendado
  workspace_id        uuid not null,                  -- denormalizado para RLS
  conversation_id     uuid not null references conversations(id) on delete cascade,
  channel_account_id  uuid not null references channel_accounts(id) on delete cascade,
  direction           text not null,                  -- 'inbound'|'outbound'
  author_type         text not null,                  -- 'contact'|'ai'|'human' (fuente de verdad del autor)
  author_user_id      uuid,                           -- set si author_type='human'; FK -> users en anfiora.sql
  content_text        text,                           -- display + busqueda
  payload             jsonb not null default '{}',    -- botones, quotes, carruseles, meta de attachments
  status              text,                           -- entrega saliente: 'queued'|'sent'|'delivered'|'read'|'failed'
  provider_message_id text,                           -- id nativo (Twilio SID, Meta mid, TG message_id)
  provider_timestamp  timestamptz,                    -- ORDEN por aqui (no por orden de llegada)
  received_at         timestamptz not null default now(),
  unique (channel_account_id, provider_message_id)    -- red de seguridad de dedupe en la capa canonica
);

-- webhook_events: aterrizaje CRUDO de cada webhook. El handler inserta, responde
-- 200, y procesa async (after()/waitUntil) + un cron sweeper que drena
-- processed_at IS NULL (red de seguridad OBLIGATORIA). Primera capa de dedupe.
create table webhook_events (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,                  -- 'twilio'|'meta'|'telegram'
  provider_event_id   text not null,                  -- clave de dedupe (ver contratos por canal en el design)
  channel_account_id  uuid references channel_accounts(id) on delete set null,
  payload             jsonb not null,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  process_error       text,
  unique (provider, provider_event_id)
);

-- Indices del nucleo (no dependen de dominio)
create index on messages (conversation_id, provider_timestamp asc);
create index on conversations (workspace_id, status, last_message_at desc);  -- inbox general
create index on webhook_events (processed_at) where processed_at is null;     -- drenaje del sweeper

-- RLS: el nucleo se asegura por workspace_id. Aqui solo se ACTIVA (deny-all por
-- defecto; service_role hace bypass). Las POLITICAS concretas (auth.uid(),
-- colaboradores) viven en anfiora.sql porque dependen del modelo de auth de la app.
alter table channel_accounts     enable row level security;
alter table channel_participants enable row level security;
alter table conversations        enable row level security;
alter table messages             enable row level security;
alter table webhook_events       enable row level security;
