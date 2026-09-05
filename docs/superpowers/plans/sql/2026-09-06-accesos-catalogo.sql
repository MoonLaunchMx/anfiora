-- Tramo 3, parte 1b: el catalogo del despacho se abre a los colaboradores.
--
-- POR QUE VA APARTE. Las otras tres tablas de Finanzas traen event_id y se
-- resuelven con puede_*(event_id, modulo). Estas dos NO: `suppliers` y
-- `categories` cuelgan de user_id porque son el catalogo del DESPACHO -- la
-- misma ficha de florista sirve en veinte bodas. Un colaborador tiene permisos
-- POR BODA, asi que hay que traducir "puede editar Proveedores en alguna boda
-- de este dueno" a un permiso sobre el catalogo de ese dueno.
--
-- REQUISITOS: 2026-09-06-accesos-finanzas-policies.sql ya corrio. La policy de
-- suppliers se apoya en un EXISTS sobre event_suppliers, y hasta que esa tabla
-- se abre no devuelve nada util para un colaborador.
--
-- Estado leido el 5-sep-2026: suppliers tiene 4 policies contra
-- auth.uid() = user_id, con rol {public}; categories otras 4 iguales, con rol
-- {authenticated}. Aqui las dos quedan en {authenticated}, que es lo correcto:
-- ningun anonimo tiene nada que hacer en el catalogo.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Las dos puertas del catalogo
-- ============================================================

-- Ver una ficha: soy el dueno, o esa ficha ya trabaja en una boda mia donde
-- puedo ver Proveedores.
--
-- El spec (§5.3) lo pide asi con todas sus letras: un colaborador ve SOLO las
-- fichas ligadas a eventos donde ya es miembro, NUNCA el directorio completo.
-- Por eso la condicion pasa por event_suppliers y no por "es de tu dueno".
CREATE OR REPLACE FUNCTION public.puede_ver_ficha(p_supplier uuid, p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT p_owner = auth.uid()
      OR EXISTS (SELECT 1 FROM event_suppliers es
                 WHERE es.supplier_id = p_supplier
                   AND public.puede_ver(es.event_id, 'proveedores'));
$$;

-- Crear o cambiar una ficha del catalogo de p_owner: soy el dueno, o soy
-- editor de Proveedores en alguna de sus bodas.
--
-- Al dar de alta, la ficha todavia no esta ligada a ninguna boda, asi que la
-- condicion de arriba no sirve todavia: hay que preguntar por el dueno.
CREATE OR REPLACE FUNCTION public.puede_editar_catalogo(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT p_owner = auth.uid()
      OR EXISTS (SELECT 1 FROM events e
                 WHERE e.user_id = p_owner
                   AND public.puede_editar(e.id, 'proveedores'));
$$;

-- Las categorias las leen DOS pantallas -- Presupuesto y Proveedores -- asi que
-- cualquiera de los dos permisos abre la lista.
--
-- LIMITE CONSCIENTE, y hay que decirlo en voz alta: a diferencia de suppliers,
-- la lista de categorias se abre ENTERA, no filtrada por boda. No hay por donde
-- filtrarla: una categoria no esta ligada a ningun evento. Son etiquetas
-- ("Venue", "Banquete"), no datos de un cliente, y sin ellas la pantalla del
-- presupuesto no se puede dibujar -- las partidas guardan category_id y sin la
-- lista no resuelven su nombre ni caen en su seccion.
CREATE OR REPLACE FUNCTION public.puede_ver_categorias(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT p_owner = auth.uid()
      OR EXISTS (SELECT 1 FROM events e
                 WHERE e.user_id = p_owner
                   AND (public.puede_ver(e.id, 'presupuesto')
                     OR public.puede_ver(e.id, 'proveedores')));
$$;

CREATE OR REPLACE FUNCTION public.puede_editar_categorias(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT p_owner = auth.uid()
      OR EXISTS (SELECT 1 FROM events e
                 WHERE e.user_id = p_owner
                   AND (public.puede_editar(e.id, 'presupuesto')
                     OR public.puede_editar(e.id, 'proveedores')));
$$;

REVOKE EXECUTE ON FUNCTION public.puede_ver_ficha(uuid, uuid)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.puede_editar_catalogo(uuid)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.puede_ver_categorias(uuid)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.puede_editar_categorias(uuid)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.puede_ver_ficha(uuid, uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_editar_catalogo(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_categorias(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_editar_categorias(uuid)     TO authenticated;

-- ============================================================
-- 2. suppliers
-- ============================================================
DROP POLICY IF EXISTS suppliers_select_own ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_own ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_own ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete_own ON public.suppliers;

CREATE POLICY suppliers_select_own ON public.suppliers FOR SELECT TO authenticated
  USING ( public.puede_ver_ficha(id, user_id) );

CREATE POLICY suppliers_insert_own ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar_catalogo(user_id) );

CREATE POLICY suppliers_update_own ON public.suppliers FOR UPDATE TO authenticated
  USING      ( public.puede_editar_catalogo(user_id) )
  WITH CHECK ( public.puede_editar_catalogo(user_id) );

-- BORRAR NO SE ABRE: se queda solo con el dueno, a proposito.
-- Ninguna pantalla borra fichas del catalogo -- "Quitar del evento" borra el
-- event_suppliers, no el suppliers -- y borrar una se llevaria su historial en
-- TODAS las bodas del despacho, no solo en la que estas viendo. No se abre lo
-- que nadie usa y que ademas seria el borrado mas caro de la app.
DROP POLICY IF EXISTS suppliers_delete_dueno ON public.suppliers;
CREATE POLICY suppliers_delete_dueno ON public.suppliers FOR DELETE TO authenticated
  USING ( user_id = auth.uid() );

-- ============================================================
-- 3. categories
-- ============================================================
DROP POLICY IF EXISTS categories_select_own ON public.categories;
DROP POLICY IF EXISTS categories_insert_own ON public.categories;
DROP POLICY IF EXISTS categories_update_own ON public.categories;
DROP POLICY IF EXISTS categories_delete_own ON public.categories;

CREATE POLICY categories_select_own ON public.categories FOR SELECT TO authenticated
  USING ( public.puede_ver_categorias(user_id) );

CREATE POLICY categories_insert_own ON public.categories FOR INSERT TO authenticated
  WITH CHECK ( public.puede_editar_categorias(user_id) );

CREATE POLICY categories_update_own ON public.categories FOR UPDATE TO authenticated
  USING      ( public.puede_editar_categorias(user_id) )
  WITH CHECK ( public.puede_editar_categorias(user_id) );

-- Igual que arriba: renombrar y archivar una categoria afecta a todas las bodas
-- del despacho, asi que borrarla se queda con el dueno. Ojo, y es importante:
-- "eliminar categoria" desde el presupuesto NO borra de esta tabla -- mueve las
-- partidas a "Otro" y la quita de event_settings.budget_categories, que es solo
-- de esa boda. Esta policy no bloquea nada que la pantalla haga hoy.
DROP POLICY IF EXISTS categories_delete_dueno ON public.categories;
CREATE POLICY categories_delete_dueno ON public.categories FOR DELETE TO authenticated
  USING ( user_id = auth.uid() );

COMMIT;

-- ============ Verificacion ============
-- 1) Las cuatro funciones existen:
SELECT proname FROM pg_proc
 WHERE proname IN ('puede_ver_ficha', 'puede_editar_catalogo',
                   'puede_ver_categorias', 'puede_editar_categorias')
 ORDER BY 1;

-- 2) Cuatro policies por tabla, todas para authenticated:
SELECT tablename, policyname, cmd, roles FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('suppliers', 'categories')
 ORDER BY tablename, cmd;

-- 3) La prueba que importa, con la sesion del DUENO: sigue viendo su catalogo
--    completo. Debe dar el mismo numero que antes de correr esto.
-- SELECT count(*) FROM suppliers;
-- SELECT count(*) FROM categories;

-- ============ Marcha atras ============
-- BEGIN;
-- DROP POLICY IF EXISTS suppliers_select_own   ON public.suppliers;
-- DROP POLICY IF EXISTS suppliers_insert_own   ON public.suppliers;
-- DROP POLICY IF EXISTS suppliers_update_own   ON public.suppliers;
-- DROP POLICY IF EXISTS suppliers_delete_dueno ON public.suppliers;
-- CREATE POLICY suppliers_select_own ON public.suppliers FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY suppliers_insert_own ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY suppliers_update_own ON public.suppliers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY suppliers_delete_own ON public.suppliers FOR DELETE USING (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS categories_select_own   ON public.categories;
-- DROP POLICY IF EXISTS categories_insert_own   ON public.categories;
-- DROP POLICY IF EXISTS categories_update_own   ON public.categories;
-- DROP POLICY IF EXISTS categories_delete_dueno ON public.categories;
-- CREATE POLICY categories_select_own ON public.categories FOR SELECT TO authenticated USING (user_id = auth.uid());
-- CREATE POLICY categories_insert_own ON public.categories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- CREATE POLICY categories_update_own ON public.categories FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- CREATE POLICY categories_delete_own ON public.categories FOR DELETE TO authenticated USING (user_id = auth.uid());
-- COMMIT;
