-- Categorias por ID, paso 1: la tabla.
--
-- Hoy la categoria es un TEXTO copiado dentro de cada proveedor y cada partida.
-- Por eso renombrar exige cuatro escrituras separadas que pueden fallar a la
-- mitad y dejar proveedores diciendo un nombre y partidas diciendo otro.
--
-- Esta tabla le da identidad. Nada la usa todavia: este script no toca ninguna
-- columna existente, asi que la app sigue funcionando igual despues de correrlo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Dos categorias con el mismo nombre en el mismo planner no tienen sentido: es
-- justo el desorden que esto viene a arreglar. El indice compara sin distinguir
-- mayusculas, igual que mismaCategoria() en el cliente.
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_unico
  ON public.categories (user_id, lower(name));

CREATE INDEX IF NOT EXISTS categories_user_idx
  ON public.categories (user_id) WHERE archived_at IS NULL;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select_own ON public.categories;
CREATE POLICY categories_select_own ON public.categories
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS categories_insert_own ON public.categories;
CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS categories_update_own ON public.categories;
CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS categories_delete_own ON public.categories;
CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ Siembra ============
-- Tres fuentes, en una sola union: el vocabulario del planner, lo que sus
-- proveedores ya usan, y lo que usan las partidas de sus eventos. DISTINCT ON
-- con lower(name) se queda con una sola grafia cuando hay varias — la primera
-- por orden alfabetico, que es arbitrario pero estable. Las repetidas de verdad
-- las junta el planner despues, desde la pantalla.
-- El select va envuelto en una subconsulta porque ON CONFLICT no puede ir despues del ORDER BY que exige DISTINCT ON.

INSERT INTO public.categories (user_id, name)
SELECT user_id, nombre
FROM (
  SELECT DISTINCT ON (user_id, lower(nombre)) user_id, nombre
  FROM (
    SELECT u.id AS user_id, cat AS nombre
    FROM public.users u
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.categories, '[]'::jsonb)) AS cat

    UNION ALL

    SELECT s.user_id, s.category
    FROM public.suppliers s
    WHERE s.category IS NOT NULL AND s.category <> ''

    UNION ALL

    SELECT e.user_id, b.category
    FROM public.event_budgets b
    JOIN public.events e ON e.id = b.event_id
    WHERE b.category IS NOT NULL AND b.category <> ''
  ) fuentes
  WHERE nombre IS NOT NULL AND btrim(nombre) <> ''
  ORDER BY user_id, lower(nombre), nombre
) dedup
ON CONFLICT DO NOTHING;

COMMIT;

-- ============ Marcha atras ============
-- Segura: nada apunta a esta tabla todavia.
-- BEGIN;
-- DROP TABLE IF EXISTS public.categories;
-- COMMIT;
