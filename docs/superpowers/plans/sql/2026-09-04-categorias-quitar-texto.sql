-- ============ Pre-chequeo: correr ANTES de desplegar, no despues ============
--
-- El orden de este script protege contra "column does not exist" -- pero hay
-- una falla espejo: si category en suppliers o event_budgets es NOT NULL sin
-- default, entonces ENTRE que se despliega el codigo nuevo (que ya no escribe
-- category) y se corre este script, cada alta de proveedor y cada partida
-- nueva truenan con "null value in column category violates not-null
-- constraint". El codigo dejo de escribirla a proposito; si la columna la
-- exige, hay que soltarle esa restriccion antes de desplegar.
--
-- select table_name, is_nullable from information_schema.columns
-- where table_name in ('suppliers','event_budgets') and column_name = 'category';
--
-- Si alguna sale NO, correr esto antes de desplegar el codigo de este paso:
--
-- ALTER TABLE public.suppliers     ALTER COLUMN category DROP NOT NULL;
-- ALTER TABLE public.event_budgets ALTER COLUMN category DROP NOT NULL;
--
-- Si sale NO y se despliega sin correr eso, cada alta de proveedor y cada
-- partida nueva truenan hasta que se borre la columna con el script de abajo.
-- ================================================================================

-- Categorias por ID, paso final: se quita el texto.
--
-- Hasta hoy cada proveedor y cada partida cargaban el NOMBRE de su categoria
-- copiado, ademas del id. Esa copia era la red de seguridad de la migracion:
-- mientras existiera se podia revertir el codigo y la app seguia funcionando.
--
-- ESTE SCRIPT QUITA ESA RED. No hay marcha atras util: volver a crear las
-- columnas es trivial, pero volver a llenarlas no -- el nombre de cada fila se
-- deduciria de categories, que es justo lo que este paso vuelve la unica verdad.
--
-- ORDEN: va DESPUES de desplegar el codigo que ya no escribe el texto. Al reves,
-- cada alta de proveedor y cada partida nueva truenan con "column does not exist".
--
-- event_settings.budget_categories NO se toca: esa lista es que categorias
-- MUESTRA cada boda, no el dato. Convertirla a ids es otro trabajo.

BEGIN;

ALTER TABLE public.suppliers      DROP COLUMN IF EXISTS category;
ALTER TABLE public.event_budgets  DROP COLUMN IF EXISTS category;

-- El vocabulario viejo del planner. Ya no lo lee nadie: lo reemplazo la tabla
-- categories en el paso 1 (verificado, cero referencias en el codigo).
ALTER TABLE public.users          DROP COLUMN IF EXISTS categories;

COMMIT;

-- ============ Verificacion ============
-- select column_name from information_schema.columns
-- where (table_name = 'suppliers' and column_name = 'category')
--    or (table_name = 'event_budgets' and column_name = 'category')
--    or (table_name = 'users' and column_name = 'categories');
-- Esperado: cero filas.
