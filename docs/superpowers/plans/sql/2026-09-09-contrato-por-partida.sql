-- Un precio por partida. PASO 1 de 2: solo AGREGA. Seguro de correr ANTES del
-- deploy: el codigo viejo no lee la columna nueva y sigue funcionando igual.
--
-- La regla nueva: lo que te cotizaron es del proveedor (event_suppliers.
-- quoted_amount, no cambia); lo que contrataste es de cada partida
-- (event_budgets.contract_amount, nueva). El contratado del proveedor pasa
-- a ser la suma de sus partidas. Y queda UNA sola liga, la de la partida
-- (event_budgets.event_supplier_id): la del lado del proveedor
-- (event_suppliers.event_budget_id) se deja de escribir y se borra en el
-- PASO 2, despues del deploy.
--
-- ============ ANTES DE CORRER: cuenta lo que va a mover (solo lectura) ============
-- select
--   (select count(*) from event_suppliers where event_budget_id is not null
--       and not exists (select 1 from event_budgets b where b.id = event_suppliers.event_budget_id and b.event_supplier_id is not null))
--     as ligas_solo_del_lado_del_proveedor,
--   (select count(*) from event_budgets where event_supplier_id is not null) as partidas_con_proveedor,
--   (select count(*) from event_suppliers where contract_amount is not null) as proveedores_con_contrato,
--   (select count(*) from event_suppliers es where es.contract_amount is not null
--       and not exists (select 1 from event_budgets b where b.event_supplier_id = es.id)
--       and not exists (select 1 from event_budgets b where b.id = es.event_budget_id))
--     as contratos_SIN_ninguna_partida;
-- La ultima cifra son proveedores cuyo contrato NO va a tener donde vivir: en
-- el PASO 2 se les crea su partida antes de borrar la columna.

BEGIN;

ALTER TABLE public.event_budgets
  ADD COLUMN IF NOT EXISTS contract_amount numeric;

-- 1) Ligas que solo existian del lado del proveedor: se copian a la partida,
--    siempre que la partida siga libre (una partida = un proveedor).
UPDATE public.event_budgets b
   SET event_supplier_id = es.id
  FROM public.event_suppliers es
 WHERE es.event_budget_id = b.id
   AND b.event_supplier_id IS NULL;

-- 2) El contrato del proveedor baja a sus partidas. Con UNA partida, el monto
--    entero. Con varias, en proporcion a lo estimado -- exactamente lo que la
--    pantalla ya pintaba, para no inventar nada nuevo -- y el planner lo
--    corrige desde la ficha cuando quiera.
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

COMMIT;

-- ============ Verificacion ============
-- select count(*) filter (where contract_amount is not null) as partidas_con_contrato,
--        count(*) filter (where event_supplier_id is not null) as partidas_con_proveedor
--   from event_budgets;
-- La primera debe ser >= proveedores_con_contrato menos contratos_SIN_ninguna_partida.
