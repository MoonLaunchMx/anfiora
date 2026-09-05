-- Tramo 3, parte 1: Finanzas pasa a gobernarse por permisos por herramienta.
--
-- QUE ARREGLA: el hueco numero uno del spec. Hoy event_budgets, event_suppliers
-- y supplier_payments tienen la policy de junio -- events.user_id = auth.uid() --
-- escrita antes de que existieran los colaboradores. Devuelven cero filas SIN
-- error, asi que las tres pantallas se ven igual que una boda sin datos aunque
-- le hayas dado permiso a la persona.
--
-- REQUISITOS, en este orden:
--   1. El codigo del Tramo 3 esta en produccion (rama feat/accesos-finanzas).
--      Sin el, las pantallas se abririan con todos sus botones para gente que
--      la base ya rechaza: el defecto contrario y peor.
--   2. Ya corrieron el cimiento y las policies del Tramo 2 (puede_ver /
--      puede_editar / puede_borrar y log_borrado existen).
--
-- DESPUES de este archivo va 2026-09-06-accesos-catalogo.sql. Ese orden importa:
-- el catalogo se apoya en un EXISTS sobre event_suppliers, que hasta aqui no
-- devuelve nada para un colaborador.
--
-- Estado leido de pg_policies el 5-sep-2026: las tres tablas tienen cuatro
-- policies <tabla>_{select,insert,update,delete}_own, todas contra
-- events.user_id = auth.uid(), y NINGUNO de los UPDATE tiene WITH CHECK.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Partidas del presupuesto
-- ============================================================
DROP POLICY IF EXISTS event_budgets_select_own ON public.event_budgets;
DROP POLICY IF EXISTS event_budgets_insert_own ON public.event_budgets;
DROP POLICY IF EXISTS event_budgets_update_own ON public.event_budgets;
DROP POLICY IF EXISTS event_budgets_delete_own ON public.event_budgets;

DROP POLICY IF EXISTS presupuesto_ver    ON public.event_budgets;
DROP POLICY IF EXISTS presupuesto_crear  ON public.event_budgets;
DROP POLICY IF EXISTS presupuesto_editar ON public.event_budgets;
DROP POLICY IF EXISTS presupuesto_borrar ON public.event_budgets;

CREATE POLICY presupuesto_ver ON public.event_budgets FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'presupuesto') );

CREATE POLICY presupuesto_crear ON public.event_budgets FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'presupuesto') );

-- El WITH CHECK es nuevo. Sin el, cualquiera que pueda editar una partida puede
-- reescribirle el event_id y meterla en una boda ajena.
CREATE POLICY presupuesto_editar ON public.event_budgets FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'presupuesto') )
  WITH CHECK ( public.puede_editar(event_id, 'presupuesto') );

CREATE POLICY presupuesto_borrar ON public.event_budgets FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'presupuesto') );

-- ============================================================
-- 2. Proveedores del evento
-- ============================================================
DROP POLICY IF EXISTS event_suppliers_select_own ON public.event_suppliers;
DROP POLICY IF EXISTS event_suppliers_insert_own ON public.event_suppliers;
DROP POLICY IF EXISTS event_suppliers_update_own ON public.event_suppliers;
DROP POLICY IF EXISTS event_suppliers_delete_own ON public.event_suppliers;

DROP POLICY IF EXISTS proveedores_ver    ON public.event_suppliers;
DROP POLICY IF EXISTS proveedores_crear  ON public.event_suppliers;
DROP POLICY IF EXISTS proveedores_editar ON public.event_suppliers;
DROP POLICY IF EXISTS proveedores_borrar ON public.event_suppliers;

CREATE POLICY proveedores_ver ON public.event_suppliers FOR SELECT TO authenticated
  USING ( public.puede_ver(event_id, 'proveedores') );

CREATE POLICY proveedores_crear ON public.event_suppliers FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar(event_id, 'proveedores') );

CREATE POLICY proveedores_editar ON public.event_suppliers FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'proveedores') )
  WITH CHECK ( public.puede_editar(event_id, 'proveedores') );

CREATE POLICY proveedores_borrar ON public.event_suppliers FOR DELETE TO authenticated
  USING ( public.puede_borrar(event_id, 'proveedores') );

-- ============================================================
-- 3. Pagos
-- ============================================================
-- Cuelgan del proveedor del evento, que es quien trae el event_id.
DROP POLICY IF EXISTS supplier_payments_select_own ON public.supplier_payments;
DROP POLICY IF EXISTS supplier_payments_insert_own ON public.supplier_payments;
DROP POLICY IF EXISTS supplier_payments_update_own ON public.supplier_payments;
DROP POLICY IF EXISTS supplier_payments_delete_own ON public.supplier_payments;

DROP POLICY IF EXISTS pagos_ver    ON public.supplier_payments;
DROP POLICY IF EXISTS pagos_crear  ON public.supplier_payments;
DROP POLICY IF EXISTS pagos_editar ON public.supplier_payments;
DROP POLICY IF EXISTS pagos_borrar ON public.supplier_payments;

CREATE POLICY pagos_ver ON public.supplier_payments FOR SELECT TO authenticated
  USING ( EXISTS (SELECT 1 FROM public.event_suppliers es
                  WHERE es.id = supplier_payments.event_supplier_id
                    AND public.puede_ver(es.event_id, 'pagos')) );

CREATE POLICY pagos_crear ON public.supplier_payments FOR INSERT TO authenticated
  WITH CHECK ( EXISTS (SELECT 1 FROM public.event_suppliers es
                       WHERE es.id = supplier_payments.event_supplier_id
                         AND public.puede_editar(es.event_id, 'pagos')) );

CREATE POLICY pagos_editar ON public.supplier_payments FOR UPDATE TO authenticated
  USING      ( EXISTS (SELECT 1 FROM public.event_suppliers es
                       WHERE es.id = supplier_payments.event_supplier_id
                         AND public.puede_editar(es.event_id, 'pagos')) )
  WITH CHECK ( EXISTS (SELECT 1 FROM public.event_suppliers es
                       WHERE es.id = supplier_payments.event_supplier_id
                         AND public.puede_editar(es.event_id, 'pagos')) );

CREATE POLICY pagos_borrar ON public.supplier_payments FOR DELETE TO authenticated
  USING ( EXISTS (SELECT 1 FROM public.event_suppliers es
                  WHERE es.id = supplier_payments.event_supplier_id
                    AND public.puede_borrar(es.event_id, 'pagos')) );

-- OJO, decision consciente: el modal de proveedores tambien registra pagos, y
-- desde ahi el permiso que manda es 'pagos', no 'proveedores'. Es lo correcto:
-- quien solo administra proveedores no toca dinero. Efecto practico: la seccion
-- de pagos dentro del detalle del proveedor puede quedarse vacia para alguien
-- con proveedores en total y pagos en ninguno. La pantalla ya lo tolera.

-- ============================================================
-- 4. La bitacora de borrados
-- ============================================================
-- event_budgets y event_suppliers traen event_id, asi que les sirve la funcion
-- generica. supplier_payments NO lo trae: cuelga de event_supplier_id, y
-- log_borrado() se sale sin registrar cuando no encuentra el evento en la fila.
-- Por eso lleva su propia funcion.
CREATE OR REPLACE FUNCTION public.log_borrado_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fila   jsonb := to_jsonb(OLD);
  v_evento uuid;
  v_email  text;
  v_nombre text;
BEGIN
  SELECT es.event_id INTO v_evento
  FROM event_suppliers es
  WHERE es.id = OLD.event_supplier_id;

  -- Sin evento no hay donde registrar. Pasa solo si el proveedor ya se fue, y
  -- ese camino lo cubre el disparador de abajo borrando los pagos primero.
  IF v_evento IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT u.email, u.full_name INTO v_email, v_nombre
  FROM users u WHERE u.id = auth.uid();

  INSERT INTO event_audit_log (
    event_id, user_id, user_email, user_name,
    action, entity_type, entity_id, entity_label,
    old_value, new_value, modulo, batch_id
  ) VALUES (
    v_evento,
    auth.uid(),
    COALESCE(v_email, ''),
    v_nombre,
    'payment.deleted',
    'payment',
    OLD.id,
    -- El monto es la etiqueta legible: es lo que se busca en la bitacora.
    OLD.amount::text,
    v_fila,
    NULL,
    'pagos',
    (('00000000-0000-4000-8000-' || lpad(to_hex(txid_current()), 12, '0'))::uuid)
  );

  RETURN OLD;
END;
$$;

-- Quitar un proveedor del evento se lleva sus pagos por la llave foranea. En una
-- cascada, cuando el disparador del hijo corre, el padre ya no existe y el pago
-- se iria sin registrar -- justo lo que no se vale con dinero.
--
-- Se resuelve borrando los pagos a mano ANTES de que el proveedor se vaya: cada
-- uno pasa por su propio disparador con el padre todavia visible, y la cascada
-- se queda sin nada que hacer. Comparten transaccion, asi que comparten
-- batch_id y se restauran juntos.
CREATE OR REPLACE FUNCTION public.borrar_pagos_del_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM supplier_payments WHERE event_supplier_id = OLD.id;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_borrado_pago()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.borrar_pagos_del_proveedor()   FROM PUBLIC;

DROP TRIGGER IF EXISTS log_borrado_presupuesto ON public.event_budgets;
CREATE TRIGGER log_borrado_presupuesto
  AFTER DELETE ON public.event_budgets
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('presupuesto', 'budget', 'subcategory');

DROP TRIGGER IF EXISTS log_borrado_proveedor ON public.event_suppliers;
CREATE TRIGGER log_borrado_proveedor
  AFTER DELETE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('proveedores', 'event_supplier', 'event_notes');

DROP TRIGGER IF EXISTS log_borrado_pago ON public.supplier_payments;
CREATE TRIGGER log_borrado_pago
  BEFORE DELETE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado_pago();

DROP TRIGGER IF EXISTS pagos_antes_de_quitar_proveedor ON public.event_suppliers;
CREATE TRIGGER pagos_antes_de_quitar_proveedor
  BEFORE DELETE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.borrar_pagos_del_proveedor();

COMMIT;

-- ============ Verificacion ============
-- 1) Doce policies nuevas, cuatro por tabla:
SELECT tablename, count(*) AS policies FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('event_budgets', 'event_suppliers', 'supplier_payments')
 GROUP BY tablename ORDER BY tablename;

-- 2) Ninguna policy vieja sobrevivio:
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname = 'public' AND policyname LIKE '%\_own' ESCAPE '\'
   AND tablename IN ('event_budgets', 'event_suppliers', 'supplier_payments');
-- Esperado: cero filas.

-- 3) Los cuatro disparadores existen:
SELECT tgrelid::regclass AS tabla, tgname FROM pg_trigger
 WHERE tgname IN ('log_borrado_presupuesto', 'log_borrado_proveedor',
                  'log_borrado_pago', 'pagos_antes_de_quitar_proveedor')
 ORDER BY 1, 2;

-- 4) Los cuatro UPDATE ya tienen WITH CHECK (ninguno lo tenia):
SELECT tablename, policyname, with_check IS NOT NULL AS tiene_with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND cmd = 'UPDATE'
   AND tablename IN ('event_budgets', 'event_suppliers', 'supplier_payments');

-- ============ Marcha atras ============
-- Devuelve las tres tablas a como estaban el 5-sep-2026, leido de pg_policies.
-- Las policies nuevas y los disparadores se van; las funciones se pueden quedar.
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS log_borrado_presupuesto ON public.event_budgets;
-- DROP TRIGGER IF EXISTS log_borrado_proveedor ON public.event_suppliers;
-- DROP TRIGGER IF EXISTS log_borrado_pago ON public.supplier_payments;
-- DROP TRIGGER IF EXISTS pagos_antes_de_quitar_proveedor ON public.event_suppliers;
--
-- DROP POLICY IF EXISTS presupuesto_ver ON public.event_budgets;
-- DROP POLICY IF EXISTS presupuesto_crear ON public.event_budgets;
-- DROP POLICY IF EXISTS presupuesto_editar ON public.event_budgets;
-- DROP POLICY IF EXISTS presupuesto_borrar ON public.event_budgets;
-- CREATE POLICY event_budgets_select_own ON public.event_budgets FOR SELECT
--   USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_budgets.event_id AND events.user_id = auth.uid()));
-- CREATE POLICY event_budgets_insert_own ON public.event_budgets FOR INSERT
--   WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = event_budgets.event_id AND events.user_id = auth.uid()));
-- CREATE POLICY event_budgets_update_own ON public.event_budgets FOR UPDATE
--   USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_budgets.event_id AND events.user_id = auth.uid()));
-- CREATE POLICY event_budgets_delete_own ON public.event_budgets FOR DELETE
--   USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_budgets.event_id AND events.user_id = auth.uid()));
--
-- DROP POLICY IF EXISTS proveedores_ver ON public.event_suppliers;
-- DROP POLICY IF EXISTS proveedores_crear ON public.event_suppliers;
-- DROP POLICY IF EXISTS proveedores_editar ON public.event_suppliers;
-- DROP POLICY IF EXISTS proveedores_borrar ON public.event_suppliers;
-- CREATE POLICY event_suppliers_select_own ON public.event_suppliers FOR SELECT
--   USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
-- CREATE POLICY event_suppliers_insert_own ON public.event_suppliers FOR INSERT
--   WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
-- CREATE POLICY event_suppliers_update_own ON public.event_suppliers FOR UPDATE
--   USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
-- CREATE POLICY event_suppliers_delete_own ON public.event_suppliers FOR DELETE
--   USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
--
-- DROP POLICY IF EXISTS pagos_ver ON public.supplier_payments;
-- DROP POLICY IF EXISTS pagos_crear ON public.supplier_payments;
-- DROP POLICY IF EXISTS pagos_editar ON public.supplier_payments;
-- DROP POLICY IF EXISTS pagos_borrar ON public.supplier_payments;
-- CREATE POLICY supplier_payments_select_own ON public.supplier_payments FOR SELECT
--   USING (EXISTS (SELECT 1 FROM event_suppliers es JOIN events e ON e.id = es.event_id
--                  WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- CREATE POLICY supplier_payments_insert_own ON public.supplier_payments FOR INSERT
--   WITH CHECK (EXISTS (SELECT 1 FROM event_suppliers es JOIN events e ON e.id = es.event_id
--                       WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- CREATE POLICY supplier_payments_update_own ON public.supplier_payments FOR UPDATE
--   USING (EXISTS (SELECT 1 FROM event_suppliers es JOIN events e ON e.id = es.event_id
--                  WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- CREATE POLICY supplier_payments_delete_own ON public.supplier_payments FOR DELETE
--   USING (EXISTS (SELECT 1 FROM event_suppliers es JOIN events e ON e.id = es.event_id
--                  WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- COMMIT;
