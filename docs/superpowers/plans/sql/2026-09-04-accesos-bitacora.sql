-- Bitacora de borrados — la funcion generica.
--
-- Spec §5.4. El registro de borrados NO se llama desde la interfaz: hoy
-- logAction() vive en el codigo de pantalla y esta escrito para fallar en
-- silencio, lo cual esta bien para "cambio un nombre" y es inaceptable para
-- "desaparecio la lista". Con disparador, si la fila se fue, la bitacora lo
-- supo, venga de donde venga el borrado.
--
-- Guarda la fila COMPLETA en old_value: restaurar es volver a insertarla.
-- Los borrados en cascada comparten batch_id y se regresan juntos, padre primero.
--
-- Este script solo crea la funcion. Colgarla de cada tabla pasa en el tramo de
-- su modulo.
--
-- ANTES DE COLGAR ESTE DISPARADOR DE CUALQUIER TABLA: el riesgo no es solo
-- events. Al borrar un evento, la cascada dispara los triggers de CADA tabla
-- hija, y cada uno intenta insertar una fila que apunta al evento que se esta
-- borrando. Asi que el problema aparece con el primer disparador que se cuelgue
-- de cualquier tabla que cuelgue de events. Tres comprobaciones antes:
--   1. La accion de la llave foranea event_audit_log.event_id -> events.id. Con
--      CASCADE, el registro del borrado se autodestruye en el mismo statement;
--      con RESTRICT, el borrado del evento falla.
--   2. Si event_audit_log.action o entity_type tienen CHECK. El disparador
--      escribe valores como 'budget.deleted' que hoy ni siquiera existen en el
--      tipo AuditAction de lib/audit.ts; un CHECK los rebota y tumba el borrado.
--   3. Si event_audit_log.user_id o user_name son NOT NULL. Los borrados por
--      service role corren con auth.uid() nulo, y ahi no hay usuario que poner.
-- Hay que resolverlo en el tramo que lo cuelgue.
--
-- AL RESTAURAR UN BORRADO EN CASCADA el orden correcto es padre primero: la
-- fila hija no entra si su padre todavia no existe. Pero los disparadores
-- AFTER DELETE de una cascada se ejecutan hijos-primero, asi que las filas de
-- la bitacora quedan en el orden inverso al de restauracion. Leer el batch por
-- created_at DESCENDENTE da el orden bueno.

BEGIN;

CREATE OR REPLACE FUNCTION public.log_borrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_modulo   text := TG_ARGV[0];
  v_entidad  text := TG_ARGV[1];
  v_col      text := TG_ARGV[2];
  v_fila     jsonb := to_jsonb(OLD);
  v_evento   uuid;
  v_email    text;
  v_nombre   text;
BEGIN
  -- El evento sale de la fila cuando la trae; si no, el disparador no se cuelga
  -- de esa tabla (se resuelve en el tramo de su modulo).
  v_evento := COALESCE(
    NULLIF(v_fila ->> 'event_id', ''),
    CASE WHEN TG_TABLE_NAME = 'events' THEN v_fila ->> 'id' END
  )::uuid;
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
    v_entidad || '.deleted',
    v_entidad,
    NULLIF(v_fila ->> 'id', '')::uuid,
    v_fila ->> v_col,
    v_fila,
    NULL,
    v_modulo,
    -- Un mismo statement (y por lo tanto una cascada completa) comparte
    -- transaccion; el id de transaccion agrupa el borrado entero.
    (('00000000-0000-4000-8000-' || lpad(to_hex(txid_current()), 12, '0'))::uuid)
  );

  RETURN OLD;
END;
$$;

COMMIT;
