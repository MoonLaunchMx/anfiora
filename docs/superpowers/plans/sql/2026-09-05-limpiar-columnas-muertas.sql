-- Quitar dos columnas que nacieron muertas: event_suppliers.external_files_url
-- y event_suppliers.has_pro_files.
--
-- POR QUE: se declararon el 5-may-2026 en el commit 666a9d1, el que creo todo
-- el modulo de proveedores, y NUNCA se conectaron a nada. Verificado el
-- 5-sep-2026 en las 24 ramas locales y remotas: aparecen solo en la
-- declaracion de tipo de lib/types.ts y en el bloque de esquema de CLAUDE.md.
-- Cero select, cero insert, cero render. El unico insert a event_suppliers
-- (proveedores/page.tsx) usa un literal de cinco campos y no las menciona.
--
-- Eran la primera idea de "archivos del proveedor". Las reemplaza
-- event_suppliers.quote_files (JSONB), porque un TEXT suelto no puede guardar
-- varias cotizaciones con su fecha y su dueño, y "tiene archivos" es un dato
-- derivado que se calcula contando la lista.
--
-- ESTE ARCHIVO SON DOS PASOS Y SE CORREN POR SEPARADO.

-- ============================================================
-- PASO 1 — SOLO LECTURA. Correr esto primero, y leer el resultado.
-- ============================================================
-- Si CUALQUIERA de las cuatro consultas devuelve filas, NO correr el paso 2:
-- hay algo dentro de Postgres que depende de esas columnas y hay que verlo
-- antes de tocar nada.

-- 1.1 Vistas y vistas materializadas que las lean
SELECT 'vista' AS que, dependiente.relname AS nombre
FROM pg_depend d
JOIN pg_rewrite r        ON r.oid = d.objid
JOIN pg_class dependiente ON dependiente.oid = r.ev_class
JOIN pg_class origen     ON origen.oid = d.refobjid
JOIN pg_attribute a      ON a.attrelid = origen.oid AND a.attnum = d.refobjsubid
WHERE origen.relname = 'event_suppliers'
  AND a.attname IN ('external_files_url', 'has_pro_files')
  AND dependiente.relname <> 'event_suppliers';

-- 1.2 Indices y restricciones (check, unique, foreign key) sobre ellas
SELECT 'indice o restriccion' AS que, c.conname AS nombre
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.conrelid = 'public.event_suppliers'::regclass
  AND a.attname IN ('external_files_url', 'has_pro_files')
UNION ALL
SELECT 'indice', i.indexname
FROM pg_indexes i
WHERE i.tablename = 'event_suppliers'
  AND (i.indexdef ILIKE '%external_files_url%' OR i.indexdef ILIKE '%has_pro_files%');

-- 1.3 Politicas de RLS que las nombren
SELECT 'policy' AS que, policyname AS nombre
FROM pg_policies
WHERE tablename = 'event_suppliers'
  AND (coalesce(qual, '')       ILIKE '%external_files_url%'
    OR coalesce(qual, '')       ILIKE '%has_pro_files%'
    OR coalesce(with_check, '') ILIKE '%external_files_url%'
    OR coalesce(with_check, '') ILIKE '%has_pro_files%');

-- 1.4 Funciones y triggers cuyo cuerpo las mencione
SELECT 'funcion' AS que, p.proname AS nombre
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'storage')
  AND (p.prosrc ILIKE '%external_files_url%' OR p.prosrc ILIKE '%has_pro_files%');

-- 1.5 Y por curiosidad, cuantas filas tienen algo guardado ahi.
-- Si sale distinto de cero, alguien escribio esos datos por fuera de la app
-- y hay que mirarlos antes de tirarlos.
SELECT count(*) FILTER (WHERE external_files_url IS NOT NULL) AS con_url,
       count(*) FILTER (WHERE has_pro_files IS TRUE)          AS con_pro
FROM public.event_suppliers;


-- ============================================================
-- PASO 2 — el borrado. Solo si el paso 1 salio limpio.
-- ============================================================
-- ANTES de correrlo: el codigo que quita las dos columnas de lib/types.ts y de
-- CLAUDE.md tiene que estar ya en origin/main y desplegado. Para QUITAR una
-- columna el orden es codigo primero, base despues; es al reves que para
-- agregarla.
--
-- Sin CASCADE a proposito: si algo dependiera de las columnas, este ALTER
-- FALLA en vez de arrastrarlo. Es el cinturon por si el paso 1 se paso algo.

-- BEGIN;
--
-- ALTER TABLE public.event_suppliers DROP COLUMN external_files_url;
-- ALTER TABLE public.event_suppliers DROP COLUMN has_pro_files;
--
-- COMMIT;


-- ============================================================
-- Marcha atras
-- ============================================================
-- Se recuperan las columnas, NO su contenido. Por eso el paso 1.5: si tenian
-- datos, lo que se va no vuelve.
--
-- BEGIN;
-- ALTER TABLE public.event_suppliers ADD COLUMN external_files_url TEXT;
-- ALTER TABLE public.event_suppliers ADD COLUMN has_pro_files BOOLEAN;
-- COMMIT;
