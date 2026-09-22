-- Asientos por persona, paso 1 de 2. SOLO AGREGA: el codigo en produccion
-- ignora la columna nueva y sigue leyendo party_size. Se corre ANTES del
-- deploy del PR "asientos por persona".
--
-- Una fila de table_seats pasa a ser UNA persona:
--   titular      guest_id = X, party_member_id = null
--   acompanante  guest_id = X, party_member_id = M
-- Las filas de hoy (party_member_id null, party_size = N) quedan como
-- "legado" y las expande el paso 2, despues del deploy.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- 0. Candado: hoy no debe haber dos filas para el mismo invitado.
DO $$
DECLARE dup int;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT guest_id FROM public.table_seats WHERE guest_id IS NOT NULL
    GROUP BY guest_id HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'Hay % invitados con mas de un asiento. Revisar antes: SELECT guest_id, count(*) FROM table_seats GROUP BY 1 HAVING count(*) > 1', dup;
  END IF;
END $$;

-- 1. La columna
ALTER TABLE public.table_seats
  ADD COLUMN IF NOT EXISTS party_member_id uuid NULL
  REFERENCES public.party_members(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS table_seats_party_member_idx
  ON public.table_seats(party_member_id);

-- 2. Un lugar por persona
CREATE UNIQUE INDEX IF NOT EXISTS table_seats_titular_unico
  ON public.table_seats(guest_id) WHERE party_member_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS table_seats_acompanante_unico
  ON public.table_seats(party_member_id) WHERE party_member_id IS NOT NULL;

COMMIT;

-- Verificacion (una fila con party_member_id y dos indices):
-- SELECT column_name, is_nullable FROM information_schema.columns
--  WHERE table_name = 'table_seats' AND column_name = 'party_member_id';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'table_seats'
--    AND indexname IN ('table_seats_titular_unico','table_seats_acompanante_unico');
