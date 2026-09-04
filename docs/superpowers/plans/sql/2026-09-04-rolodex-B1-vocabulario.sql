-- Rolodex, cimiento B1: el vocabulario de categorias sube al planner.
--
-- Hoy las categorias personalizadas viven en event_settings.budget_categories,
-- que es POR EVENTO. El Rolodex es global del usuario. Los dos ejes no se cruzan:
-- una categoria inventada en una boda no existe en el Rolodex ni en la siguiente
-- boda. Este script crea el eje que faltaba y lo siembra sin perder nada.
--
-- NO quita el CHECK de suppliers.category. Ese es el script B2, y va DESPUES de
-- desplegar el codigo que lee el vocabulario — si se quita antes, el codigo viejo
-- puede escribir una categoria que la base acepta y el tipo de TypeScript rechaza.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb;

-- Siembra: la union de las categorias que cada planner ya usa en sus eventos.
-- Nadie pierde una categoria que ya habia creado. Las base no se siembran aqui:
-- resolverVocabulario() las agrega en el cliente, asi que sembrarlas duplicaria
-- el mantenimiento el dia que cambien.
UPDATE public.users u
SET categories = COALESCE(sub.cats, '[]'::jsonb)
FROM (
  SELECT e.user_id,
         jsonb_agg(DISTINCT cat) AS cats
  FROM public.events e
  JOIN public.event_settings s ON s.event_id = e.id
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(s.budget_categories, '[]'::jsonb)
  ) AS cat
  GROUP BY e.user_id
) sub
WHERE sub.user_id = u.id;

COMMIT;

-- ============ Marcha atras ============
-- BEGIN;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS categories;
-- COMMIT;
