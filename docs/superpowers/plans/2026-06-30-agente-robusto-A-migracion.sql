-- Sub-proyecto A: separacion asistencia / atencion + paridad de acompanantes.
-- 100% aditivo. No toca el CHECK constraint de rsvp_status. Seguro en prod
-- (el codigo viejo ignora estas columnas).

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_reason TEXT;

ALTER TABLE party_members
  ADD COLUMN IF NOT EXISTS allergies JSONB,
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT;
