-- Rolodex, cimiento A: arreglar lo roto y agregar lo que falta.
--
-- Los cinco cambios son invisibles para el codigo desplegado hoy: nadie lee tags
-- ni archived_at todavia, el default nuevo solo aplica a inserts que no mandan
-- status (hoy todos lo mandan), y las dos restricciones no tienen filas que
-- violar (verificado 4-sep: 0 duplicados de cualquier tipo).
--
-- Por eso este script puede correr ANTES de desplegar nada.

BEGIN;

-- ============ 1) El default que no pasaba su propio CHECK ============
-- Default 'contactado' contra un CHECK que solo acepta
-- nuevo|cotizado|contratado|descartado: cualquier insert sin status explicito
-- reventaba con 23514. Hoy no truena porque el codigo siempre lo manda.
ALTER TABLE public.event_suppliers
  ALTER COLUMN status SET DEFAULT 'nuevo';

-- ============ 2) Un proveedor no entra dos veces a la misma boda ============
-- Sin esto el conteo "6a vez" del expediente es mentira.
ALTER TABLE public.event_suppliers
  ADD CONSTRAINT event_suppliers_evento_proveedor_unico
  UNIQUE (event_id, supplier_id);

-- ============ 3) Buscar por nombre, sin bloquear ============
-- Indice NO unico a proposito: dos floristas reales pueden llamarse igual.
-- El aviso de posible duplicado vive en la pantalla, donde la persona decide.
CREATE INDEX IF NOT EXISTS suppliers_user_nombre_idx
  ON public.suppliers (user_id, lower(name));

-- ============ 4) Etiquetas ============
-- En un directorio de 200 proveedores se filtra por "economico" o "no contestan"
-- mas que por categoria. Es la unica tabla de la app sin etiquetas.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- ============ 5) Archivar sin perder la historia ============
-- Borrar un proveedor se lleva su historial, que es justo lo que el Rolodex vende.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMIT;

-- ============ Marcha atras ============
-- BEGIN;
-- ALTER TABLE public.event_suppliers ALTER COLUMN status SET DEFAULT 'contactado';
-- ALTER TABLE public.event_suppliers DROP CONSTRAINT IF EXISTS event_suppliers_evento_proveedor_unico;
-- DROP INDEX IF EXISTS public.suppliers_user_nombre_idx;
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS tags;
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS archived_at;
-- COMMIT;
