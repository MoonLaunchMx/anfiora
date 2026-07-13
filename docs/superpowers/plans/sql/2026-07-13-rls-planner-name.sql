-- FASE 1 / additive: nombre del planner denormalizado en el evento.
-- Es una columna nullable nueva: NO rompe codigo viejo, se puede correr ANTES del deploy.
BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS planner_name text;

UPDATE public.events e
   SET planner_name = u.full_name
  FROM public.users u
 WHERE u.id = e.user_id
   AND e.planner_name IS DISTINCT FROM u.full_name;

COMMIT;
