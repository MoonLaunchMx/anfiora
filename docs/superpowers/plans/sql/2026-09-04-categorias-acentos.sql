-- Categorias por ID: arregla los acentos.
--
-- La siembra tomo el texto guardado en suppliers.category y event_budgets.category,
-- que es el texto plano del enum (sin acento). Antes cada pantalla pasaba ese texto
-- por budgetCategoryLabel() para mostrarlo con acento; ahora la pantalla muestra
-- name tal cual, asi que el nombre debe llevar el acento desde la tabla.
--
-- Solo renombra los 4 valores base que llevan acento en su version de exhibicion.
-- Si el planner ya tiene las dos filas (la plana y la acentuada, por ejemplo por
-- vocabulario propio), no se toca esa fila: ese planner tiene dos categorias
-- genuinas que fusionar, y eso se hace desde Ajustes (pantalla que viene despues).
--
-- Idempotente: al re-correrlo ya no quedan filas con el nombre plano, asi que no
-- cambia nada.

BEGIN;

UPDATE public.categories c
SET name = m.acentuada
FROM (VALUES
  ('Decoracion', 'Decoración'),
  ('Papeleria',  'Papelería'),
  ('Logistica',  'Logística'),
  ('Planeacion', 'Planeación')
) AS m(plana, acentuada)
WHERE c.name = m.plana
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c2
    WHERE c2.user_id = c.user_id
      AND lower(c2.name) = lower(m.acentuada)
  );

COMMIT;

-- ============ Verificacion ============
-- SELECT user_id, name FROM public.categories
-- WHERE name IN ('Decoración', 'Papelería', 'Logística', 'Planeación')
-- ORDER BY user_id, name;

-- ============ Marcha atras ============
-- BEGIN;
-- UPDATE public.categories c
-- SET name = m.plana
-- FROM (VALUES
--   ('Decoracion', 'Decoración'),
--   ('Papeleria',  'Papelería'),
--   ('Logistica',  'Logística'),
--   ('Planeacion', 'Planeación')
-- ) AS m(plana, acentuada)
-- WHERE c.name = m.acentuada
--   AND NOT EXISTS (
--     SELECT 1 FROM public.categories c2
--     WHERE c2.user_id = c.user_id
--       AND lower(c2.name) = lower(m.plana)
--   );
-- COMMIT;
