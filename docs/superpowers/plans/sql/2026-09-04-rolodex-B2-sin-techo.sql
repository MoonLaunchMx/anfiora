-- Antes de correr, ver que restricciones existen de verdad:
-- select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where contype = 'c'
--   and conrelid in ('public.suppliers'::regclass, 'public.event_budgets'::regclass);
-- event_budgets.category tambien tenia una restriccion asi (confirmado en
-- produccion con este mismo select) — este script ya la quita mas abajo,
-- junto con la de suppliers.

-- Rolodex, cimiento B2: se cae el techo de las categorias.
--
-- El CHECK de suppliers.category encierra al Rolodex en catorce cajones que
-- eligio Anfiora. Con el vocabulario del planner ya sembrado (script B1) y el
-- codigo desplegado, deja de tener sentido.
--
-- ORDEN: este script va DESPUES de desplegar el codigo de la tarea 4. Al reves,
-- el codigo viejo escribe una categoria que la base acepta y el tipo rechaza.
--
-- El diagnostico de arriba se corrio en produccion y confirmo que las DOS
-- tablas tenian el mismo techo de catorce categorias: suppliers_category_check
-- y event_budgets_category_check. El de event_budgets significa que HOY, en
-- produccion, crear una partida de presupuesto con una categoria inventada
-- falla, aunque la lista de categorias del evento (event_settings) si deje
-- agregarla — el feature de categorias libres del presupuesto esta a medias.
-- Por eso este script quita los dos.

BEGIN;

-- suppliers_category_check y event_budgets_category_check son los nombres
-- que Postgres pone por convencion. Si el select del diagnostico de arriba
-- muestra otro nombre para cualquiera de las dos tablas, usar ese nombre en
-- el DROP correspondiente: un DROP ... IF EXISTS con el nombre equivocado no
-- falla, simplemente no hace nada, y la restriccion se queda.
ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_category_check;

ALTER TABLE public.event_budgets
  DROP CONSTRAINT IF EXISTS event_budgets_category_check;

COMMIT;

-- Confirmar que se fueron las dos:
-- select conrelid::regclass, conname from pg_constraint
-- where contype = 'c'
--   and conrelid in ('public.suppliers'::regclass, 'public.event_budgets'::regclass);

-- ============ Marcha atras ============
-- Esto solo funciona si nadie ha guardado todavia una categoria inventada.
-- Si ya hay filas de suppliers o event_budgets con una categoria fuera de
-- las catorce, el ADD CONSTRAINT de abajo va a fallar — eso es correcto,
-- no un error del script.
-- BEGIN;
-- ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_category_check
--   CHECK (category = ANY (ARRAY['Planeacion','Venue','Banquete','Bebidas','Audio y Video','Imagen','Decoracion','Ceremonia','Entretenimiento','Papeleria','Logistica','Recuerdos','Digital','Otro']));
-- ALTER TABLE public.event_budgets ADD CONSTRAINT event_budgets_category_check
--   CHECK (category = ANY (ARRAY['Planeacion','Venue','Banquete','Bebidas','Audio y Video','Imagen','Decoracion','Ceremonia','Entretenimiento','Papeleria','Logistica','Recuerdos','Digital','Otro']));
-- COMMIT;
