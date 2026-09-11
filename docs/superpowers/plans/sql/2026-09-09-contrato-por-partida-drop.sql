-- Un precio por partida. PASO 2 de 2: BORRA. Correr SOLO DESPUES de que el
-- codigo nuevo este desplegado en produccion (main), porque el codigo viejo
-- todavia escribe estas dos columnas.
--
-- Requisito: ya corrio 2026-09-09-contrato-por-partida.sql.

BEGIN;

-- Por si produccion siguio escribiendo mientras tanto: se vuelve a bajar lo
-- que falte (misma regla que el paso 1, solo partidas que sigan sin contrato).
UPDATE public.event_budgets b
   SET event_supplier_id = es.id
  FROM public.event_suppliers es
 WHERE es.event_budget_id = b.id
   AND b.event_supplier_id IS NULL;

WITH cuenta AS (
  SELECT event_supplier_id, COUNT(*) AS n, SUM(GREATEST(budget_amount, 0)) AS base
    FROM public.event_budgets
   WHERE event_supplier_id IS NOT NULL
   GROUP BY event_supplier_id
)
UPDATE public.event_budgets b
   SET contract_amount = CASE
         WHEN c.n = 1      THEN es.contract_amount
         WHEN c.base > 0   THEN ROUND(es.contract_amount * GREATEST(b.budget_amount, 0) / c.base, 2)
         ELSE                   ROUND(es.contract_amount / c.n, 2)
       END
  FROM public.event_suppliers es
  JOIN cuenta c ON c.event_supplier_id = es.id
 WHERE b.event_supplier_id = es.id
   AND es.contract_amount IS NOT NULL
   AND b.contract_amount IS NULL;

-- Un contratado con monto pero SIN ninguna partida perderia su numero al
-- borrar la columna. Se le crea su partida, con la categoria del proveedor y
-- el nombre de su concepto (o el del proveedor), para que el dinero siga
-- existiendo donde ahora vive: en el presupuesto.
INSERT INTO public.event_budgets (event_id, category_id, subcategory, budget_amount, event_supplier_id, contract_amount, notes)
SELECT es.event_id,
       s.category_id,
       COALESCE(NULLIF(TRIM(s.subcategory), ''), s.name),
       es.contract_amount,
       es.id,
       es.contract_amount,
       'Creada al migrar: el contrato vivia en el proveedor y no tenia partida.'
  FROM public.event_suppliers es
  JOIN public.suppliers s ON s.id = es.supplier_id
 WHERE es.contract_amount IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.event_budgets b WHERE b.event_supplier_id = es.id);

ALTER TABLE public.event_suppliers
  DROP COLUMN IF EXISTS event_budget_id,
  DROP COLUMN IF EXISTS contract_amount;

COMMIT;

-- ============ Verificacion ============
-- select column_name from information_schema.columns
--  where table_name = 'event_suppliers' and column_name in ('event_budget_id','contract_amount');  -- 0 filas
-- select count(*) from event_budgets where notes like 'Creada al migrar%';  -- las partidas que hubo que crear
