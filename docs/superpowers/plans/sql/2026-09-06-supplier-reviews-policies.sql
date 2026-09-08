-- supplier_reviews pasa a gobernarse por permisos por herramienta.
--
-- QUE ARREGLA. 2026-09-06-supplier-reviews.sql nacio con cuatro policies contra
-- auth.uid() = user_id. Esa columna NO es la sesion: es el dueno de la cuenta
-- (events.user_id), la misma llave que usan suppliers y categories, porque el
-- catalogo y su historial son del despacho y no de quien teclea. Con la policy
-- vieja, para cualquier colaborador con permiso de editar Proveedores -- que es
-- un rol real:
--
--   * su review quedaba colgada de el y el dueno no la veia nunca, asi que el
--     score historico del proveedor se partia por persona;
--   * el nunca veia las del dueno: la cabecera decia "— —" para siempre y la
--     ficha ofrecia escribir una review post evento que ya existia;
--   * el conteo de "ya hay review" salia 0 por RLS aunque la fila existiera, el
--     modal se abria, y el upsert chocaba contra el indice unico con una fila
--     que su propio UPDATE no alcanzaba: error duro de Postgres, sin salida;
--   * y como la llave unica es global pero la visibilidad no, cualquier usuario
--     autenticado con un event_supplier_id en la mano podia pre-insertar
--     (ese id, 'contratacion', 'planner') bajo su propio user_id y dejar al
--     dueno legitimo bloqueado, de forma invisible y permanente.
--
-- CUAL ARCHIVO CORRER. Si la tabla TODAVIA no existe, corre
-- 2026-09-06-supplier-reviews.sql: ya trae estas mismas policies y este archivo
-- sobra. Este existe para la base donde la tabla ya se creo con las viejas.
--
-- REQUISITOS: ya corrieron 2026-09-04-accesos-cimiento.sql (puede_ver /
-- puede_editar existen y tienen GRANT a authenticated) y
-- 2026-09-06-accesos-finanzas-policies.sql (event_suppliers ya abierta).
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

DROP POLICY IF EXISTS supplier_reviews_select_own ON public.supplier_reviews;
DROP POLICY IF EXISTS supplier_reviews_insert_own ON public.supplier_reviews;
DROP POLICY IF EXISTS supplier_reviews_update_own ON public.supplier_reviews;
DROP POLICY IF EXISTS supplier_reviews_delete_own ON public.supplier_reviews;

DROP POLICY IF EXISTS reviews_ver    ON public.supplier_reviews;
DROP POLICY IF EXISTS reviews_crear  ON public.supplier_reviews;
DROP POLICY IF EXISTS reviews_editar ON public.supplier_reviews;
DROP POLICY IF EXISTS reviews_borrar ON public.supplier_reviews;

-- Ver: el dueno siempre; los demas, si pueden ver Proveedores en esa boda.
CREATE POLICY reviews_ver ON public.supplier_reviews FOR SELECT TO authenticated
  USING ( user_id = auth.uid() OR public.puede_ver(event_id, 'proveedores') );

-- Escribir: quien edita Proveedores en esa boda. El EXISTS sobre events es lo
-- que hace cumplir el significado de la columna -- la review nace colgada del
-- dueno de la boda y de nadie mas, venga de quien venga -- y es lo que cierra
-- el bloqueo invisible de arriba: sin permiso en esa boda no hay insert.
CREATE POLICY reviews_crear ON public.supplier_reviews FOR INSERT TO authenticated
  WITH CHECK (
    public.puede_editar(event_id, 'proveedores')
    AND EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = supplier_reviews.event_id
                   AND e.user_id = supplier_reviews.user_id)
  );

-- El WITH CHECK no es opcional: sin el, quien puede corregir una review puede
-- reescribirle el event_id o el user_id y mudarla a una boda ajena.
CREATE POLICY reviews_editar ON public.supplier_reviews FOR UPDATE TO authenticated
  USING      ( public.puede_editar(event_id, 'proveedores') )
  WITH CHECK (
    public.puede_editar(event_id, 'proveedores')
    AND EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = supplier_reviews.event_id
                   AND e.user_id = supplier_reviews.user_id)
  );

-- Borrar se queda con el dueno, igual que en suppliers: una review es el
-- historial del despacho, ninguna pantalla la borra hoy, y borrarla se lleva
-- una pieza del score historico del proveedor en TODAS las bodas.
CREATE POLICY reviews_borrar ON public.supplier_reviews FOR DELETE TO authenticated
  USING ( user_id = auth.uid() );

COMMIT;

-- ============ Verificacion ============
-- 1) Cuatro policies, todas para authenticated, ninguna vieja:
SELECT policyname, cmd, roles FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'supplier_reviews'
 ORDER BY cmd;
-- Esperado: reviews_borrar, reviews_crear, reviews_editar, reviews_ver.

-- 2) Los dos UPDATE/INSERT traen WITH CHECK:
SELECT policyname, with_check IS NOT NULL AS tiene_with_check FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'supplier_reviews'
   AND cmd IN ('INSERT', 'UPDATE');

-- 3) Con la sesion del DUENO: sigue viendo todas sus reviews.
-- SELECT count(*) FROM supplier_reviews;

-- 4) Si ya hay filas guardadas con el id de la sesion en vez del dueno, esta
--    consulta las encuentra. Deben ser cero; si no, hay que corregirlas antes
--    de que el EXISTS de arriba las deje sin poder actualizarse:
SELECT r.id, r.user_id AS guardado, e.user_id AS deberia_ser
  FROM supplier_reviews r
  JOIN events e ON e.id = r.event_id
 WHERE r.user_id <> e.user_id;
-- Correccion, solo si la de arriba devuelve filas:
-- UPDATE supplier_reviews r SET user_id = e.user_id
--   FROM events e WHERE e.id = r.event_id AND r.user_id <> e.user_id;

-- ============ Marcha atras ============
-- Devuelve la tabla a las policies con las que nacio. Ojo: eso vuelve a dejar
-- fuera a los colaboradores y reabre el bloqueo invisible.
--
-- BEGIN;
-- DROP POLICY IF EXISTS reviews_ver    ON public.supplier_reviews;
-- DROP POLICY IF EXISTS reviews_crear  ON public.supplier_reviews;
-- DROP POLICY IF EXISTS reviews_editar ON public.supplier_reviews;
-- DROP POLICY IF EXISTS reviews_borrar ON public.supplier_reviews;
-- CREATE POLICY supplier_reviews_select_own ON public.supplier_reviews FOR SELECT TO authenticated USING (user_id = auth.uid());
-- CREATE POLICY supplier_reviews_insert_own ON public.supplier_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- CREATE POLICY supplier_reviews_update_own ON public.supplier_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- CREATE POLICY supplier_reviews_delete_own ON public.supplier_reviews FOR DELETE TO authenticated USING (user_id = auth.uid());
-- COMMIT;
