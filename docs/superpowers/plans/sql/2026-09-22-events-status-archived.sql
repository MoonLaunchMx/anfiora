-- Amplia el candado de estatus de evento para que acepte 'archived'.
-- Se puede correr YA, antes del deploy: solo agrega valores permitidos, no
-- quita ninguno, asi que el codigo en produccion sigue funcionando igual.
--
-- Por que: events_event_status_check solo conocia active, paused y cancelled
-- (confirmado en prod el 22-sep-2026). El muro archiva eventos con 'archived'
-- y la base los rechazaba en silencio.

BEGIN;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_status_check;

ALTER TABLE public.events ADD CONSTRAINT events_event_status_check
  CHECK (event_status = ANY (ARRAY['active', 'paused', 'cancelled', 'completed', 'archived']));

COMMIT;

-- Verificacion: debe mostrar los cinco valores.
select pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.events'::regclass
  and conname = 'events_event_status_check';

-- Revertir (solo si hiciera falta y NO hay eventos en 'archived' ni 'completed'):
-- ALTER TABLE public.events DROP CONSTRAINT events_event_status_check;
-- ALTER TABLE public.events ADD CONSTRAINT events_event_status_check
--   CHECK (event_status = ANY (ARRAY['active', 'paused', 'cancelled']));
