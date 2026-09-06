-- Tramo 4, Actividad: abrir la lectura de la bitacora y arreglar la etiqueta
-- del proveedor.
--
-- REQUISITO UNICO: el codigo del Tramo 4 en main y desplegado.
--
-- NO depende de 2026-09-06-accesos-cierre.sql. Solo se apoya en cosas que
-- existen desde hace tiempo (is_platform_admin, events, event_collaborators) y
-- en log_borrado_proveedor(), que llego con el SQL de finanzas y ya corrio.
-- Se puede correr antes o despues del cierre del Tramo 3, en cualquier orden.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Quien lee la bitacora
-- ============================================================
-- Hasta hoy la unica policy de SELECT era is_platform_admin(): la bitacora se
-- estaba llenando bien y nadie mas que Diego podia verla. La pantalla de
-- Actividad vive detras del candado de Configuracion, que es de duenos y
-- admins, asi que la policy dice exactamente eso y nada mas.
DROP POLICY IF EXISTS actividad_ver ON public.event_audit_log;

CREATE POLICY actividad_ver ON public.event_audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
       WHERE e.id = event_audit_log.event_id
         AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_collaborators c
       WHERE c.event_id = event_audit_log.event_id
         AND c.user_id  = auth.uid()
         AND c.status   = 'active'
         AND c.role     = 'admin'
    )
  );

-- audit_admin_select queda obsoleta: actividad_ver ya incluye su condicion.
DROP POLICY IF EXISTS audit_admin_select ON public.event_audit_log;

-- audit_member_insert se queda como esta: logAction() lo llama cualquier
-- miembro y eso sigue siendo correcto. Sin UPDATE ni DELETE -> la bitacora
-- sigue siendo inmutable desde el cliente, restaurar no la borra: le agrega
-- una fila de restauracion.

-- ============================================================
-- 2. La etiqueta del proveedor
-- ============================================================
-- El disparador del Tramo 3 se colgo con 'event_notes' como columna de
-- etiqueta. Ese campo es la nota libre del proveedor y casi siempre esta
-- vacio, asi que en la bitacora un proveedor borrado sale sin nombre. El
-- nombre vive en suppliers, otra tabla, y old_value si trae supplier_id --
-- pero la etiqueta hay que resolverla al momento del borrado, cuando el
-- proveedor todavia es visible.
CREATE OR REPLACE FUNCTION public.log_borrado_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fila   jsonb := to_jsonb(OLD);
  v_email  text;
  v_nombre text;
  v_label  text;
BEGIN
  SELECT s.name INTO v_label FROM suppliers s WHERE s.id = OLD.supplier_id;

  SELECT u.email, u.full_name INTO v_email, v_nombre
  FROM users u WHERE u.id = auth.uid();

  INSERT INTO event_audit_log (
    event_id, user_id, user_email, user_name,
    action, entity_type, entity_id, entity_label,
    old_value, new_value, modulo, batch_id
  ) VALUES (
    OLD.event_id,
    auth.uid(),
    COALESCE(v_email, ''),
    v_nombre,
    'event_supplier.deleted',
    'event_supplier',
    OLD.id,
    -- El nombre del catalogo; si el proveedor ya no existe, la nota del
    -- evento como ultimo recurso.
    COALESCE(NULLIF(v_label, ''), NULLIF(OLD.event_notes, '')),
    v_fila,
    NULL,
    'proveedores',
    (('00000000-0000-4000-8000-' || lpad(to_hex(txid_current()), 12, '0'))::uuid)
  );

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_borrado_proveedor() FROM PUBLIC;

DROP TRIGGER IF EXISTS log_borrado_proveedor ON public.event_suppliers;
CREATE TRIGGER log_borrado_proveedor
  AFTER DELETE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado_proveedor();

COMMIT;

-- ============================================================
-- Verificacion (correr aparte, despues del COMMIT)
-- ============================================================
-- Debe salir una sola policy de SELECT, llamada actividad_ver:
-- SELECT policyname, cmd FROM pg_policies
--  WHERE tablename = 'event_audit_log' ORDER BY policyname;
--
-- Debe salir el disparador colgado de event_suppliers:
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'public.event_suppliers'::regclass AND NOT tgisinternal;
--
-- Las filas viejas de proveedor siguen sin etiqueta: el arreglo es hacia
-- adelante. La pantalla las pinta como "Sin nombre guardado".

-- ============================================================
-- Para deshacer
-- ============================================================
-- DROP POLICY IF EXISTS actividad_ver ON public.event_audit_log;
-- CREATE POLICY audit_admin_select ON public.event_audit_log
--   FOR SELECT TO authenticated USING (public.is_platform_admin());
