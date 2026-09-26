-- Asientos por persona, paso 1b. Se corre despues del 1, tambien ANTES del
-- deploy. Quita el candado de "una fila por invitado" que traia la tabla
-- desde el principio: UNIQUE (event_id, guest_id). Con el, un acompanante
-- nunca puede tener fila, porque comparte guest_id con su titular.
--
-- Lo sustituyen los dos indices parciales del paso 1: un titular tiene a lo
-- mas una fila (guest_id unico donde party_member_id es null) y un acompanante
-- tiene a lo mas una (party_member_id unico). El codigo en produccion sigue
-- insertando una fila por invitado, asi que no le afecta.
--
-- El otro candado, UNIQUE (table_id, seat_number), se queda: el codigo nuevo
-- da un numero correlativo por mesa a cada fila que crea.

BEGIN;

ALTER TABLE public.table_seats
  DROP CONSTRAINT IF EXISTS table_seats_event_id_guest_id_key;

COMMIT;

-- Verificacion: no debe salir ninguna fila.
-- SELECT conname FROM pg_constraint
--  WHERE conrelid = 'public.table_seats'::regclass
--    AND conname = 'table_seats_event_id_guest_id_key';
