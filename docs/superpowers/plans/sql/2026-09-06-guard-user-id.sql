-- Cerrar el secuestro de events.user_id. Deuda abierta desde el Tramo 1.
--
-- EL AGUJERO. guard_event_config() protege una lista de columnas de events,
-- user_id incluida, pero su primera linea util es:
--
--     IF public.is_event_admin(eid) THEN RETURN NEW; END IF;
--
-- ...y is_event_admin lee event_collaborators.role = 'admin'. O sea: un admin
-- de BODA puede correr
--
--     update events set user_id = '<el suyo>' where id = '<la boda>';
--
-- y quedarse con el evento. Se lleva la boda entera: invitados, presupuesto,
-- proveedores, pagos y el catalogo que cuelga de ahi. El dueno original deja de
-- verla.
--
-- Que tan real es hoy: el rol de boda ya no se otorga desde la interfaz -- la
-- pantalla de Equipo del Tramo 2 escribe permisos por herramienta y 'admin'
-- desaparecio de la UI -- pero las filas viejas siguen en la base y el rol
-- sigue leyendose. Se cierra ahora porque este tramo abre justo las tablas que
-- mas caro costaria perder.
--
-- EL ARREGLO. El dueno no es configuracion del evento: es de quien es. Se
-- comprueba ANTES de la salida por admin, y solo el dueno actual puede cambiarlo.
-- Todo lo demas de la funcion queda igual.
--
-- REQUISITOS: ninguno. Es independiente del resto del tramo y se puede correr
-- en cualquier momento.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_event_config()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  viejo jsonb := to_jsonb(OLD);
  nuevo jsonb := to_jsonb(NEW);
  eid uuid := (nuevo ->> TG_ARGV[0])::uuid;
  col text;
  i int;
BEGIN
  -- Sin sesion de usuario final no hay rol que aplicar: service role, cron y el
  -- editor SQL pasan derecho. Ningun rol anonimo tiene policy de escritura aqui,
  -- asi que esto no abre nada.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- El dueno se comprueba ANTES que nada y no lo salta ni el admin: cambiar
  -- user_id no es configurar el evento, es quedarselo.
  IF TG_TABLE_NAME = 'events'
     AND (viejo -> 'user_id') IS DISTINCT FROM (nuevo -> 'user_id')
     AND (viejo ->> 'user_id')::uuid IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Solo el dueno del evento puede transferirlo'
      USING ERRCODE = '42501';
  END IF;

  IF public.is_event_admin(eid) THEN RETURN NEW; END IF;

  FOR i IN 1 .. TG_NARGS - 1 LOOP
    col := TG_ARGV[i];
    IF (viejo -> col) IS DISTINCT FROM (nuevo -> col) THEN
      RAISE EXCEPTION 'Solo el administrador del evento puede cambiar %', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

COMMIT;

-- ============ Verificacion ============
-- 1) La funcion trae la guarda nueva:
SELECT prosrc LIKE '%Solo el dueno del evento puede transferirlo%' AS tiene_guarda
  FROM pg_proc WHERE proname = 'guard_event_config';

-- 2) Los dos disparadores siguen activos ('O' = enabled):
SELECT tgrelid::regclass AS tabla, tgname, tgenabled
  FROM pg_trigger WHERE tgname LIKE 'guard_%config';

-- 3) La prueba real, con la sesion del DUENO: cambiar el nombre del evento
--    sigue funcionando (la guarda solo mira user_id).
--    Contra-prueba, con un colaborador que tenga role='admin' en esa boda:
--    update events set user_id = auth.uid() where id = '<la boda>';
--    -> debe fallar con 42501.

-- ============ Marcha atras ============
-- Reinstala la version del 4-ago-2026 (2026-08-04-rls-colaborador-editor.sql),
-- con el agujero abierto. Solo si algo legitimo dejo de poder transferir bodas.
--
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.guard_event_config()
-- RETURNS trigger LANGUAGE plpgsql AS $$
-- DECLARE
--   viejo jsonb := to_jsonb(OLD);
--   nuevo jsonb := to_jsonb(NEW);
--   eid uuid := (nuevo ->> TG_ARGV[0])::uuid;
--   col text;
--   i int;
-- BEGIN
--   IF auth.uid() IS NULL THEN RETURN NEW; END IF;
--   IF public.is_event_admin(eid) THEN RETURN NEW; END IF;
--   FOR i IN 1 .. TG_NARGS - 1 LOOP
--     col := TG_ARGV[i];
--     IF (viejo -> col) IS DISTINCT FROM (nuevo -> col) THEN
--       RAISE EXCEPTION 'Solo el administrador del evento puede cambiar %', col
--         USING ERRCODE = '42501';
--     END IF;
--   END LOOP;
--   RETURN NEW;
-- END $$;
-- COMMIT;
