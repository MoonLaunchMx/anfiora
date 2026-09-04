-- PREVIO de la migracion de accesos. NO ESCRIBE NADA.
--
-- Ensena exactamente como va a quedar cada persona. Se corre en el editor de
-- Supabase, se lee la salida, y solo entonces se corre el archivo -aplicar.
--
-- Reglas (spec §8):
--   dueno del evento -> se le crea su despacho, el es dueno principal
--   role 'admin'     -> colaborador con 'total' en los doce modulos, SOLO en esa boda
--                       (NO sube a admin del despacho: amaneceria con acceso a
--                        bodas donde nunca lo invitaron)
--   role 'editor'    -> 'editar' en los doce. Pierde borrar hasta que se lo den
--   role 'viewer'    -> 'ver' en los doce

-- 1. Los despachos que se van a crear, uno por dueno
SELECT
  u.id                        AS dueno_id,
  u.email                     AS dueno_email,
  COALESCE(u.full_name, u.email) AS nombre_del_despacho,
  count(e.id)                 AS bodas_que_se_le_asignan
FROM users u
JOIN events e ON e.user_id = u.id
GROUP BY u.id, u.email, u.full_name
ORDER BY count(e.id) DESC;

-- 2. Persona por persona, boda por boda: donde amanece
SELECT
  e.name                                   AS boda,
  c.email                                  AS persona,
  c.role                                   AS hoy,
  CASE c.role
    WHEN 'admin'  THEN 'total  (borra)'
    WHEN 'editor' THEN 'editar (ya NO borra)'
    WHEN 'viewer' THEN 'ver'
    ELSE '?? REVISAR A MANO'
  END                                      AS manana_en_los_12_modulos,
  CASE WHEN c.role = 'editor' THEN 'SI' ELSE 'no' END AS pierde_borrar,
  c.status
FROM event_collaborators c
JOIN events e ON e.id = c.event_id
WHERE c.status IS DISTINCT FROM 'revoked'
ORDER BY e.name, c.email;

-- 3. El semaforo: si esto no da cero, hay filas que la migracion no sabe mapear
SELECT count(*) AS filas_sin_mapeo
FROM event_collaborators
WHERE status IS DISTINCT FROM 'revoked'
  AND (role IS NULL OR role NOT IN ('admin', 'editor', 'viewer'));

-- 4. Eventos sin dueno valido: tienen que ser cero
SELECT count(*) AS eventos_sin_dueno
FROM events e
LEFT JOIN users u ON u.id = e.user_id
WHERE u.id IS NULL;

-- 5. Colaboradores con status nulo: tienen que ser cero, o quedarian invisibles
--    para la migracion Y para su propia verificacion
SELECT count(*) AS colaboradores_status_nulo
FROM event_collaborators WHERE status IS NULL;
