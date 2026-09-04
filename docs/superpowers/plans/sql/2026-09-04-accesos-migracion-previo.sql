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

-- 6. Duenos sin nombre ni correo: no tumban la migracion (el paso 1 del aplicar
--    escribe workspaces.name con COALESCE(full_name, email, 'Mi despacho')),
--    pero los que salgan aqui van a quedar con un despacho llamado
--    "Mi despacho". Es la lista de despachos a renombrar despues.
SELECT count(*) AS duenos_sin_nombre_ni_correo
FROM users u
WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id)
  AND COALESCE(u.full_name, u.email) IS NULL;

-- 7. Duenos sin correo: deberian ser cero, pero NO bloquea la migracion. El
--    paso 2 del aplicar escribe workspace_members.email, que es NOT NULL, con
--    COALESCE(email, id::text) de respaldo: no aborta, y el bloque de aborto
--    del -aplicar tampoco mira este chequeo. Se puede correr con esto en rojo.
--    El costo de dejarlo: cada fila que salga aqui queda con un UUID donde
--    deberia ir un correo, y ese correo es la identidad del miembro.
--    Arreglarlo despues cuesta DOS tablas: hay que actualizar users.email Y el
--    workspace_members.email que quedo con el UUID. Si solo se arregla el
--    primero, una invitacion futura al correo real crea una fila distinta y al
--    aceptarla choca con workspace_members_un_usuario (23505).
SELECT count(*) AS duenos_sin_correo
FROM users u
WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id)
  AND u.email IS NULL;
