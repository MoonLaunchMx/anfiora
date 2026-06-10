-- ANF-049 Mesa de regalos — schema (Path A, sin pagos).
-- 2 tablas nuevas + 1 columna aditiva. Inerte en prod hasta shippear el feature.
-- Lo corre Diego en Supabase. Atomico (BEGIN/COMMIT).
-- NOTA: las policies RLS van en un archivo aparte (anf-049-mesa-regalos-rls.sql),
-- replicando el patron de song_recommendations. Correr ESTE primero.

BEGIN;

-- Regalos que arma el anfitrion
CREATE TABLE IF NOT EXISTS gift_registry_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'external',   -- external | fund | cash
  title         text NOT NULL,
  description   text,
  category      text,
  image_url     text,
  external_url  text,                               -- solo type='external'
  store         text,                               -- solo type='external'
  price         numeric,                            -- referencia (external)
  target_amount numeric,                            -- meta (fund)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Intencion del invitado (apartar / aportar). Sin pagos.
CREATE TABLE IF NOT EXISTS gift_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES gift_registry_items(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id    uuid REFERENCES guests(id) ON DELETE SET NULL,
  guest_name  text NOT NULL,
  guest_phone text,
  amount      numeric,                              -- fund / cash
  message     text,
  purchased   boolean NOT NULL DEFAULT false,       -- "ya lo compre" (honor-system)
  thanked     boolean NOT NULL DEFAULT false,       -- anfitrion ya agradecio
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_items_event        ON gift_registry_items(event_id);
CREATE INDEX IF NOT EXISTS idx_gift_reservations_item  ON gift_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_gift_reservations_event ON gift_reservations(event_id);

-- Token del link publico de la mesa (mismo patron que playlist_token)
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS registry_token text;

COMMIT;
