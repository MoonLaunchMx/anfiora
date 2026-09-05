-- La fuga por la puerta de atras del presupuesto.
--
-- EL AGUJERO. La lista de secciones del presupuesto (las categorias visibles de
-- esa boda y su orden) no vive en event_budgets: vive en
-- event_settings.budget_categories. Y event_settings se gobierna con
-- is_event_editor, que todavia lee event_collaborators.role.
--
-- Efecto: alguien con `presupuesto: 'ver'` pero con un `role = 'editor'` de
-- antes de la migracion puede reordenar y borrar secciones del presupuesto,
-- aunque la policy de event_budgets lo tenga bloqueado. Un modulo de Finanzas
-- escribiendo en una tabla que obedece al sistema viejo.
--
-- EL ARREGLO, y su limite. Se agrega budget_categories a la lista de columnas
-- que vigila guard_event_config, pero con su propia regla: para esa columna
-- manda puede_editar(event_id, 'presupuesto'), no is_event_admin.
--
-- Esto es UN PARCHE CONSCIENTE, no la solucion de fondo. La solucion de fondo
-- es que cada columna de event_settings responda al modulo que le toca
-- -- invitacion, playlist, mesa de regalos, acceso, agente... son veintitantas
-- de modulos distintos -- y eso es un tramo entero, el de Configuracion.
-- Diego lo decidio asi el 5-sep: cerrar hoy lo que ya esta abierto, y dejar el
-- trabajo grande para su momento.
--
-- REQUISITOS: puede_editar() existe (cimiento del Tramo 2, ya corrido).
-- Independiente del resto de este tramo; se puede correr cuando sea.

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
  -- (Ver 2026-09-06-guard-user-id.sql, que es donde se explica.)
  IF TG_TABLE_NAME = 'events'
     AND (viejo -> 'user_id') IS DISTINCT FROM (nuevo -> 'user_id')
     AND (viejo ->> 'user_id')::uuid IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Solo el dueno del evento puede transferirlo'
      USING ERRCODE = '42501';
  END IF;

  -- Las secciones del presupuesto son del presupuesto, no de la configuracion
  -- del evento: piden el permiso de esa herramienta y no el de admin. Va antes
  -- de la salida por admin para que tambien aplique a quien SI es admin pero no
  -- tiene la herramienta -- que es raro, pero es la regla del modelo nuevo.
  IF TG_TABLE_NAME = 'event_settings'
     AND (viejo -> 'budget_categories') IS DISTINCT FROM (nuevo -> 'budget_categories')
     AND NOT public.puede_editar(eid, 'presupuesto')
  THEN
    RAISE EXCEPTION 'No tienes acceso para cambiar las secciones del presupuesto'
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

-- ============ OJO: este archivo REEMPLAZA guard_event_config ============
-- Trae dentro la guarda de user_id de 2026-09-06-guard-user-id.sql. Si corres
-- los dos, corre ESTE AL FINAL: es el que deja la funcion completa. Si corres
-- solo este, quedan las dos guardas y el otro archivo sale sobrando.

-- ============ Verificacion ============
-- 1) La funcion trae las dos guardas nuevas:
SELECT prosrc LIKE '%Solo el dueno del evento puede transferirlo%' AS guarda_dueno,
       prosrc LIKE '%secciones del presupuesto%'                   AS guarda_presupuesto
  FROM pg_proc WHERE proname = 'guard_event_config';

-- 2) Los dos disparadores siguen activos ('O' = enabled):
SELECT tgrelid::regclass AS tabla, tgname, tgenabled
  FROM pg_trigger WHERE tgname LIKE 'guard_%config';

-- 3) La prueba real, con la sesion del DUENO: abrir el presupuesto, entrar a
--    Categorias, agregar una y reordenar arrastrando. Debe funcionar igual.
--    Contra-prueba, con un colaborador en `presupuesto: 'ver'`: el boton de
--    Categorias ni siquiera se le dibuja; una peticion cruda debe dar 42501.

-- ============ Marcha atras ============
-- Quita la guarda del presupuesto y deja solo la del dueno.
-- (Para volver del todo al 4-ago, usa el bloque de 2026-09-06-guard-user-id.sql.)
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
--   IF TG_TABLE_NAME = 'events'
--      AND (viejo -> 'user_id') IS DISTINCT FROM (nuevo -> 'user_id')
--      AND (viejo ->> 'user_id')::uuid IS DISTINCT FROM auth.uid()
--   THEN
--     RAISE EXCEPTION 'Solo el dueno del evento puede transferirlo' USING ERRCODE = '42501';
--   END IF;
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
