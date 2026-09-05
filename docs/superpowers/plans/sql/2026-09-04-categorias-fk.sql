-- Normaliza igual que normalizarCategoria() en el cliente: quita acentos,
-- recorta y baja a minusculas. Se escribe a mano en vez de usar la extension
-- unaccent porque no siempre esta instalada y esto solo corre una vez.
CREATE OR REPLACE FUNCTION public.unaccent_lower(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(translate(
    t,
    'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
    'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'
  )));
$$;

-- Categorias por ID, paso 2: colgar proveedores y partidas de la tabla.
--
-- Agrega category_id y lo llena. NO borra ni modifica las columnas de texto:
-- despues de este script la app sigue leyendo el texto y se comporta igual.
-- El ID queda puesto pero todavia sin usar, que es lo que hace este paso seguro.
--
-- ON DELETE RESTRICT es a proposito: Postgres impide borrar una categoria que
-- algun proveedor o alguna partida este usando. Es la misma regla que la
-- pantalla va a mostrar ("Eliminar solo si nadie la usa"), pero puesta donde no
-- se puede saltar.

BEGIN;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE public.event_budgets
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

-- ============ Relleno ============
-- El emparejamiento normaliza acentos igual que normalizarCategoria() en el
-- cliente, para que "Decoracion" y "Decoracion-con-acento" caigan en la misma
-- fila. Sin esa normalizacion, una partida con acento se quedaria sin ID.

UPDATE public.suppliers s
SET category_id = c.id
FROM public.categories c
WHERE c.user_id = s.user_id
  AND unaccent_lower(c.name) = unaccent_lower(s.category)
  AND s.category_id IS NULL
  AND s.category IS NOT NULL;

UPDATE public.event_budgets b
SET category_id = c.id
FROM public.events e, public.categories c
WHERE e.id = b.event_id
  AND c.user_id = e.user_id
  AND unaccent_lower(c.name) = unaccent_lower(b.category)
  AND b.category_id IS NULL
  AND b.category IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_category_id_idx ON public.suppliers (category_id);
CREATE INDEX IF NOT EXISTS event_budgets_category_id_idx ON public.event_budgets (category_id);

COMMIT;

-- ============ Marcha atras ============
-- Segura: nada lee category_id todavia.
-- BEGIN;
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS category_id;
-- ALTER TABLE public.event_budgets DROP COLUMN IF EXISTS category_id;
-- COMMIT;
