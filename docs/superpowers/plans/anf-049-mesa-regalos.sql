-- ANF-049 Mesa de regalos — schema + RLS lado anfitrion (Path A, sin pagos).
-- 2 tablas nuevas + 1 columna aditiva. Inerte en prod (nada lo referencia hasta shippear).
-- RLS espejo de `guests`: dueno + colaboradores activos (admin/editor para escribir).
-- Las policies PUBLICAS (anon, acotadas por token) van en la fase de vista publica.
-- Lo corre Diego. Atomico (BEGIN/COMMIT). Re-ejecutable (DROP POLICY IF EXISTS).

BEGIN;

-- ── Tablas ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_registry_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'external',   -- external | fund | cash
  title         text NOT NULL,
  description   text,
  category      text,
  image_url     text,
  external_url  text,
  store         text,
  price         numeric,
  target_amount numeric,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gift_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES gift_registry_items(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id    uuid REFERENCES guests(id) ON DELETE SET NULL,
  guest_name  text NOT NULL,
  guest_phone text,
  amount      numeric,
  message     text,
  purchased   boolean NOT NULL DEFAULT false,
  thanked     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_items_event        ON gift_registry_items(event_id);
CREATE INDEX IF NOT EXISTS idx_gift_reservations_item  ON gift_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_gift_reservations_event ON gift_reservations(event_id);

ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS registry_token text;

-- ── RLS (lado anfitrion; espejo de guests) ───────────────────────────────────
ALTER TABLE gift_registry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_reservations   ENABLE ROW LEVEL SECURITY;

-- gift_registry_items
DROP POLICY IF EXISTS "host read gift items"   ON gift_registry_items;
DROP POLICY IF EXISTS "host insert gift items" ON gift_registry_items;
DROP POLICY IF EXISTS "host update gift items" ON gift_registry_items;
DROP POLICY IF EXISTS "host delete gift items" ON gift_registry_items;

CREATE POLICY "host read gift items" ON gift_registry_items
  FOR SELECT TO public
  USING (event_id IN (
    SELECT events.id FROM events WHERE events.user_id = auth.uid()
    UNION
    SELECT event_collaborators.event_id FROM event_collaborators
    WHERE event_collaborators.user_id = auth.uid()
      AND event_collaborators.status = 'active'
  ));

CREATE POLICY "host insert gift items" ON gift_registry_items
  FOR INSERT TO public
  WITH CHECK (event_id IN (
    SELECT events.id FROM events WHERE events.user_id = auth.uid()
    UNION
    SELECT event_collaborators.event_id FROM event_collaborators
    WHERE event_collaborators.user_id = auth.uid()
      AND event_collaborators.status = 'active'
      AND event_collaborators.role = ANY (ARRAY['admin','editor'])
  ));

CREATE POLICY "host update gift items" ON gift_registry_items
  FOR UPDATE TO public
  USING (event_id IN (
    SELECT events.id FROM events WHERE events.user_id = auth.uid()
    UNION
    SELECT event_collaborators.event_id FROM event_collaborators
    WHERE event_collaborators.user_id = auth.uid()
      AND event_collaborators.status = 'active'
      AND event_collaborators.role = ANY (ARRAY['admin','editor'])
  ));

CREATE POLICY "host delete gift items" ON gift_registry_items
  FOR DELETE TO public
  USING (event_id IN (
    SELECT events.id FROM events WHERE events.user_id = auth.uid()
    UNION
    SELECT event_collaborators.event_id FROM event_collaborators
    WHERE event_collaborators.user_id = auth.uid()
      AND event_collaborators.status = 'active'
      AND event_collaborators.role = ANY (ARRAY['admin','editor'])
  ));

-- gift_reservations
DROP POLICY IF EXISTS "host read gift reservations"   ON gift_reservations;
DROP POLICY IF EXISTS "host update gift reservations" ON gift_reservations;
DROP POLICY IF EXISTS "host delete gift reservations" ON gift_reservations;

CREATE POLICY "host read gift reservations" ON gift_reservations
  FOR SELECT TO public
  USING (event_id IN (
    SELECT events.id FROM events WHERE events.user_id = auth.uid()
    UNION
    SELECT event_collaborators.event_id FROM event_collaborators
    WHERE event_collaborators.user_id = auth.uid()
      AND event_collaborators.status = 'active'
  ));

CREATE POLICY "host update gift reservations" ON gift_reservations
  FOR UPDATE TO public
  USING (event_id IN (
    SELECT events.id FROM events WHERE events.user_id = auth.uid()
    UNION
    SELECT event_collaborators.event_id FROM event_collaborators
    WHERE event_collaborators.user_id = auth.uid()
      AND event_collaborators.status = 'active'
      AND event_collaborators.role = ANY (ARRAY['admin','editor'])
  ));

CREATE POLICY "host delete gift reservations" ON gift_reservations
  FOR DELETE TO public
  USING (event_id IN (
    SELECT events.id FROM events WHERE events.user_id = auth.uid()
    UNION
    SELECT event_collaborators.event_id FROM event_collaborators
    WHERE event_collaborators.user_id = auth.uid()
      AND event_collaborators.status = 'active'
      AND event_collaborators.role = ANY (ARRAY['admin','editor'])
  ));

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Incremento 2026-06-11: cuenta de los novios para transferencias.
-- Columna JSONB en event_settings: { bank, account_holder, clabe }.
-- La policy "public can read event_settings by token" (playlist_token IS NOT NULL)
-- expone la fila completa a anon, asi que se excluye la columna nueva del
-- privilegio SELECT de anon (privilegio a nivel columna). La vista publica de
-- mesa lee via API service-role y el anfitrion via sesion authenticated, asi
-- que nadie legitimo pierde acceso.

BEGIN;

ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS registry_payment_info JSONB;

REVOKE SELECT ON event_settings FROM anon;
GRANT SELECT (id, event_id, message_templates, template_names, album_url,
              playlist_token, playlist_categories, created_at, updated_at,
              budget_categories, agent_config, registry_token)
  ON event_settings TO anon;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Incremento 2026-06-11 (2): mesas de regalos externas (Liverpool, Amazon...).
-- Array JSONB de { id, store, url }. La vista publica lo lee via API service-role;
-- anon no tiene grant sobre la columna (la lista de columnas de arriba no la incluye).

ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS registry_external_links JSONB;
