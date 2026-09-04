-- Antes de correr, ver que restricciones existen de verdad:
-- select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where contype = 'c'
--   and conrelid in ('public.suppliers'::regclass, 'public.event_budgets'::regclass);
-- Si aparece una restriccion en event_budgets.category, hay que quitarla tambien
-- y eso no esta en este script.

-- Rolodex, cimiento B2: se cae el techo de las categorias.
--
-- El CHECK de suppliers.category encierra al Rolodex en catorce cajones que
-- eligio Anfiora. Con el vocabulario del planner ya sembrado (script B1) y el
-- codigo desplegado, deja de tener sentido.
--
-- ORDEN: este script va DESPUES de desplegar el codigo de la tarea 4. Al reves,
-- el codigo viejo escribe una categoria que la base acepta y el tipo rechaza.
--
-- event_budgets.category no tiene CHECK que quitar: las partidas ya aceptan
-- categorias libres. Este script solo empareja a suppliers con esa realidad.

BEGIN;

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_category_check;

COMMIT;

-- Confirmar que se fue:
-- select conname from pg_constraint
-- where conrelid = 'public.suppliers'::regclass and contype = 'c';
