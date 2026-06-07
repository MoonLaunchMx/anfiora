-- event_settings: config del agente
alter table event_settings add column if not exists agent_config jsonb;

-- guests: opt-out + handoff
alter table guests add column if not exists wa_opt_out boolean not null default false;
alter table guests add column if not exists wa_opt_out_at timestamptz;
alter table guests add column if not exists wa_needs_human boolean not null default false;
alter table guests add column if not exists wa_needs_human_reason text;

-- wa_messages: idempotencia + estado + autor
alter table wa_messages add column if not exists twilio_sid text;
alter table wa_messages add column if not exists status text;
alter table wa_messages add column if not exists author text;

-- idempotencia: un MessageSid de Twilio no se inserta dos veces
create unique index if not exists wa_messages_twilio_sid_uniq
  on wa_messages (twilio_sid) where twilio_sid is not null;
