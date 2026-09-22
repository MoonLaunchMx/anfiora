-- Asientos por persona, paso 2 de 2. Se corre DESPUES de que el deploy este
-- arriba. Expande cada familia "legado" (una fila con party_size = N) a una
-- fila por acompanante en la misma mesa y deja al titular en party_size = 1.
-- Es lo mismo que hace la app al primer movimiento individual: aqui de golpe.
--
-- Idempotente: un acompanante que ya tiene fila no se duplica (indice unico).

BEGIN;

DO $$
DECLARE
  fila record;
  m record;
  siguiente int;
BEGIN
  FOR fila IN
    SELECT s.id, s.table_id, s.event_id, s.guest_id
      FROM public.table_seats s
     WHERE s.party_member_id IS NULL
       AND s.guest_id IS NOT NULL
       AND s.party_size > 1
       AND NOT EXISTS (SELECT 1 FROM public.table_seats x
                        WHERE x.guest_id = s.guest_id AND x.party_member_id IS NOT NULL)
  LOOP
    SELECT coalesce(max(seat_number), 0) INTO siguiente
      FROM public.table_seats WHERE table_id = fila.table_id;
    FOR m IN SELECT id FROM public.party_members WHERE guest_id = fila.guest_id ORDER BY created_at, id
    LOOP
      siguiente := siguiente + 1;
      INSERT INTO public.table_seats (table_id, event_id, guest_id, party_member_id, seat_number, party_size)
      VALUES (fila.table_id, fila.event_id, fila.guest_id, m.id, siguiente, 1)
      ON CONFLICT DO NOTHING;
    END LOOP;
    -- Crear antes de sobrescribir: el titular baja a 1 solo despues de los inserts.
    UPDATE public.table_seats SET party_size = 1 WHERE id = fila.id;
  END LOOP;
END $$;

COMMIT;

-- Verificacion: cero filas legado.
-- SELECT count(*) AS legado FROM public.table_seats
--  WHERE party_member_id IS NULL AND party_size > 1;
