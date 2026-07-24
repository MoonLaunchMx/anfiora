-- Notificaciones push - Fase 1
-- Aplicar en Supabase SOLO despues de pushear el codigo a origin (regla prod-safety).

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- El usuario solo ve/gestiona sus propias suscripciones desde el cliente.
-- El envio (lib/push.ts) usa service role, que bypassa RLS.
create policy "push_own_select" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_own_insert" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_own_update" on push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push_own_delete" on push_subscriptions
  for delete using (auth.uid() = user_id);
