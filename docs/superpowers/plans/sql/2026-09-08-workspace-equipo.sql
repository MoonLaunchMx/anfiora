-- Tramo 5, el workspace — tanda 2: equipo de boda sin asiento -> miembro.
--
-- REQUISITO: 2026-09-08-workspace-cimiento.sql corrido, y el codigo de la
-- tanda 2 en main y desplegado.
--
-- QUE HACE: a cada persona de equipo (tipo 'equipo' o NULL) que tiene acceso a
-- una boda y NO tiene fila en workspace_members del workspace de esa boda, le
-- crea una: colaborador, active si ya acepto (user_id), pending si no. Un
-- correo en varias bodas del mismo workspace produce UNA fila.
--
-- Medido el 7-sep: 9 filas de event_collaborators, ninguna de
-- bodasplanner@hotmail.com. Si alguna es en realidad un cliente (una novia),
-- marcala ANTES con: UPDATE event_collaborators SET tipo='cliente' WHERE id=...
-- RE-CORRIBLE: el NOT EXISTS lo hace idempotente.

-- ============================================================
-- 0. PREVIO (solo lectura): lo que va a crear
-- ============================================================
SELECT e.workspace_id, lower(c.email) AS email,
       bool_or(c.user_id IS NOT NULL) AS ya_acepto,
       count(*) AS bodas, string_agg(e.name, ' | ') AS cuales
  FROM event_collaborators c
  JOIN events e ON e.id = c.event_id
 WHERE c.status <> 'revoked'
   AND coalesce(c.tipo, 'equipo') = 'equipo'
   AND e.workspace_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM workspace_members m
                    WHERE m.workspace_id = e.workspace_id AND lower(m.email) = lower(c.email))
 GROUP BY e.workspace_id, lower(c.email)
 ORDER BY 1, 2;

BEGIN;

INSERT INTO workspace_members (workspace_id, user_id, email, rol, es_dueno_principal, status, invited_by, invite_token, accepted_at, kit_habitual)
SELECT e.workspace_id,
       max(c.user_id::text)::uuid,
       lower(c.email),
       'colaborador',
       false,
       CASE WHEN bool_or(c.user_id IS NOT NULL) THEN 'active' ELSE 'pending' END,
       max(c.invited_by::text)::uuid,
       gen_random_uuid()::text,
       CASE WHEN bool_or(c.user_id IS NOT NULL) THEN min(coalesce(c.accepted_at, c.invited_at)) END,
       NULL
  FROM event_collaborators c
  JOIN events e ON e.id = c.event_id
 WHERE c.status <> 'revoked'
   AND coalesce(c.tipo, 'equipo') = 'equipo'
   AND e.workspace_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM workspace_members m
                    WHERE m.workspace_id = e.workspace_id AND lower(m.email) = lower(c.email))
 GROUP BY e.workspace_id, lower(c.email)
ON CONFLICT DO NOTHING;

-- Las filas con tipo NULL se normalizan a 'equipo'.
UPDATE event_collaborators SET tipo = 'equipo' WHERE tipo IS NULL;

COMMIT;

-- ============================================================
-- VERIFICACION (solo lectura): esperado 0
-- ============================================================
SELECT count(*) AS equipo_sin_asiento
  FROM event_collaborators c
  JOIN events e ON e.id = c.event_id
 WHERE c.status <> 'revoked' AND c.tipo = 'equipo' AND e.workspace_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM workspace_members m
                    WHERE m.workspace_id = e.workspace_id AND lower(m.email) = lower(c.email));

-- ============================================================
-- DESHACER: las filas que creo este script son las de rol colaborador cuyo
-- invited_at coincide con la corrida (default now()):
-- DELETE FROM workspace_members WHERE rol = 'colaborador' AND invited_at >= '<fecha de la corrida>';
