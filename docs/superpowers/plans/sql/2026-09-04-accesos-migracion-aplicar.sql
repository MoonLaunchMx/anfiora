-- APLICAR la migracion de accesos.
--
-- Requisitos, en este orden:
--   1. 2026-09-04-accesos-cimiento.sql ya corrio
--   2. El codigo del Tramo 1 ya esta en produccion
--   3. La salida de -previo.sql ya la reviso y aprobo Diego
--
-- CORRERLO DESDE EL EDITOR SQL DE SUPABASE (o con service role), no con una
-- sesion de usuario: el paso 3 escribe events.workspace_id y el trigger
-- guard_events_workspace solo deja pasar al dueno de cada evento. Con auth.uid()
-- nulo el trigger no estorba, que es como esta pensado.
--
-- Es idempotente: se puede correr dos veces sin duplicar nada.
-- Es reversible: no borra ni modifica event_collaborators.role, solo agrega.

BEGIN;

-- Se aborta si el previo no daba cero.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM event_collaborators
   WHERE status IS DISTINCT FROM 'revoked'
     AND (role IS NULL OR role NOT IN ('admin', 'editor', 'viewer'));
  IF n > 0 THEN
    RAISE EXCEPTION 'Hay % colaboradores con un rol que la migracion no sabe mapear. Correr el previo.', n;
  END IF;

  SELECT count(*) INTO n
    FROM events e LEFT JOIN users u ON u.id = e.user_id WHERE u.id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Hay % eventos cuyo dueno no existe en users. Correr el previo.', n;
  END IF;
END $$;

-- 1. Un despacho por cada dueno de eventos
INSERT INTO workspaces (name, primary_owner_id)
SELECT COALESCE(u.full_name, u.email), u.id
FROM users u
WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.primary_owner_id = u.id);

-- 2. El dueno principal como miembro de su propio despacho
INSERT INTO workspace_members (workspace_id, user_id, email, rol, es_dueno_principal, status, accepted_at)
SELECT w.id, u.id, u.email, 'dueno', true, 'active', now()
FROM workspaces w
JOIN users u ON u.id = w.primary_owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members m
   WHERE m.workspace_id = w.id AND m.user_id = u.id
);

-- 3. Cada boda apunta a su despacho
UPDATE events e
   SET workspace_id = w.id
  FROM workspaces w
 WHERE w.primary_owner_id = e.user_id
   AND e.workspace_id IS DISTINCT FROM w.id;

-- 4. Los permisos de cada colaborador, derivados de su rol de hoy
UPDATE event_collaborators c
   SET permisos = (
         SELECT jsonb_object_agg(m, CASE c.role
                                      WHEN 'admin'  THEN 'total'
                                      WHEN 'editor' THEN 'editar'
                                      ELSE 'ver'
                                    END)
         FROM unnest(ARRAY[
           'invitados','invitacion','mensajes','mesas','timeline',
           'regalos','album','playlist','vestimenta',
           'presupuesto','proveedores','pagos'
         ]) AS m
       ),
       tipo = COALESCE(c.tipo, 'equipo')
 WHERE c.status IS DISTINCT FROM 'revoked'
   AND c.permisos IS NULL;

COMMIT;

-- Verificacion posterior: las tres deben dar cero.
SELECT count(*) AS eventos_sin_despacho     FROM events WHERE workspace_id IS NULL;
SELECT count(*) AS colaboradores_sin_permisos
  FROM event_collaborators WHERE status IS DISTINCT FROM 'revoked' AND permisos IS NULL;
SELECT count(*) AS despachos_sin_dueno
  FROM workspaces w WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = w.id AND m.es_dueno_principal);
