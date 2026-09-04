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

BEGIN;

CREATE OR REPLACE FUNCTION public.log_borrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_evento := NULLIF(v_fila ->> 'event_id', '')::uuid;
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
