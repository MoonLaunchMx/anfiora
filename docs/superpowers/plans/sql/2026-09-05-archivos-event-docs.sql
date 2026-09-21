-- Archivos de cotizacion y comprobantes de pago: bucket privado + columnas.
--
-- QUE HACE:
--   1. Crea el bucket PRIVADO event-docs, con tope de peso y tipos.
--   2. Agrega dos columnas JSONB: event_suppliers.quote_files y
--      supplier_payments.receipt_files.
--   3. Dos helpers que leen la ruta del objeto y dicen de que evento y de que
--      modulo es. Existen para que la politica no truene al toparse con una
--      ruta mal formada.
--   4. Cuatro politicas sobre storage.objects apoyadas en puede_ver/puede_editar,
--      las mismas funciones que ya gobiernan Finanzas. NO hay politica de DELETE:
--      en este bucket nada se borra, a proposito.
--   5. Cuatro funciones RPC para agregar y quitar archivos de forma ATOMICA.
--      Sin ellas, dos personas subiendo a la vez se pisan y una subida
--      desaparece sin error.
--
-- CUANDO CORRERLO: se puede correr ANTES de desplegar el codigo. Las dos
-- columnas nacen con default '[]' y hoy no las lee nadie; el bucket vacio no le
-- estorba a nada; las politicas nuevas solo aplican a un bucket que aun no
-- existe para el codigo desplegado. Comportamiento cero para produccion.
--
-- REQUISITO: el cimiento del Tramo 2 ya corrio, o sea que existen
-- public.puede_ver(uuid, text) y public.puede_editar(uuid, text).
-- Verificalo antes con:
--   select proname from pg_proc where proname in ('puede_ver','puede_editar');
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1) El bucket privado
-- ============================================================
-- 10485760 = 10 MB. HEIC y HEIF entran porque el iPhone entrega HEIC desde la
-- galeria: sin ellos, la primera foto que sube una novia rebota.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-docs',
  'event-docs',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2) Las columnas
-- ============================================================
ALTER TABLE public.event_suppliers
  ADD COLUMN IF NOT EXISTS quote_files JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS receipt_files JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- 3) Leer la ruta sin que truene
-- ============================================================
-- La ruta es {event_id}/{carpeta}/{dueño}/{uuid}.ext
-- storage.foldername() devuelve los directorios SIN el nombre del archivo, o
-- sea {event_id, carpeta, dueño}.
--
-- El casteo directo a uuid dentro de una policy es una bomba: Postgres no
-- garantiza el corto-circuito del AND, asi que una ruta con un primer segmento
-- que no es uuid puede reventar la consulta entera. Por eso el casteo vive aqui,
-- detras de una comprobacion, y devuelve NULL en vez de fallar.
CREATE OR REPLACE FUNCTION public.evento_de_ruta(ruta text)
RETURNS uuid
LANGUAGE sql STABLE
SET search_path = public, storage, pg_temp
AS $$
  SELECT CASE
    WHEN (storage.foldername(ruta))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN ((storage.foldername(ruta))[1])::uuid
  END
$$;

-- 'cotizaciones' pregunta por el modulo proveedores; 'comprobantes' por pagos.
-- Cualquier otra cosa devuelve NULL y no pasa: una ruta desconocida no se cuela
-- por el lado permisivo de un ELSE.
CREATE OR REPLACE FUNCTION public.modulo_de_ruta(ruta text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, storage, pg_temp
AS $$
  SELECT CASE (storage.foldername(ruta))[2]
    WHEN 'cotizaciones' THEN 'proveedores'
    WHEN 'comprobantes' THEN 'pagos'
  END
$$;

REVOKE EXECUTE ON FUNCTION public.evento_de_ruta(text)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.modulo_de_ruta(text)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.evento_de_ruta(text)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.modulo_de_ruta(text)  TO authenticated;

-- ============================================================
-- 4) Politicas del bucket
-- ============================================================
DROP POLICY IF EXISTS event_docs_ver    ON storage.objects;
DROP POLICY IF EXISTS event_docs_subir  ON storage.objects;

-- Leer y firmar. Con nivel 'ver' se abre el archivo; no hace falta mas.
CREATE POLICY event_docs_ver ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-docs'
  AND public.evento_de_ruta(name) IS NOT NULL
  AND public.modulo_de_ruta(name) IS NOT NULL
  AND public.puede_ver(public.evento_de_ruta(name), public.modulo_de_ruta(name))
);

-- Subir pide nivel 'editar' en el modulo que dice la carpeta: cotizaciones
-- pregunta por proveedores, comprobantes pregunta por pagos. Son modulos
-- distintos, asi que se puede llevar las cotizaciones sin ver el dinero.
CREATE POLICY event_docs_subir ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-docs'
  AND public.evento_de_ruta(name) IS NOT NULL
  AND public.modulo_de_ruta(name) IS NOT NULL
  AND public.puede_editar(public.evento_de_ruta(name), public.modulo_de_ruta(name))
);

-- A PROPOSITO no hay policy de UPDATE ni de DELETE sobre este bucket.
-- Quitar un archivo lo marca en el JSONB y lo saca de la vista; el objeto se
-- queda. El plan gratis de Supabase no tiene recuperacion a un punto en el
-- tiempo, asi que un clic mal dado no puede destruir un contrato.

-- ============================================================
-- 5) Agregar y quitar, atomico
-- ============================================================
-- Leer el arreglo en el navegador, agregarle un elemento y reescribirlo
-- completo es un lost update: dos personas subiendo a la vez y una subida se
-- pierde SIN ERROR. Estas cuatro funciones hacen el cambio dentro de Postgres.
--
-- SECURITY INVOKER (el default) a proposito: corren como quien llama, asi que
-- las policies de event_suppliers y supplier_payments siguen mandando igual.
-- No son una puerta trasera; son la misma puerta con llave atomica.
--
-- Devuelven el arreglo nuevo, o NULL si la policy no dejo tocar ninguna fila.
-- El cliente trata NULL como error visible: cero filas nunca es exito.

CREATE OR REPLACE FUNCTION public.adjuntar_cotizacion(es_id uuid, archivo jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  resultado jsonb;
  visibles  int;
BEGIN
  SELECT count(*) INTO visibles
  FROM public.event_suppliers es,
       LATERAL jsonb_array_elements(es.quote_files) e
  WHERE es.id = es_id
    AND e->>'borrado' IS NULL;

  IF visibles >= 10 THEN
    RAISE EXCEPTION 'tope_cotizaciones' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.event_suppliers
     SET quote_files = quote_files || jsonb_build_array(archivo)
   WHERE id = es_id
   RETURNING quote_files INTO resultado;

  RETURN resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.quitar_cotizacion(es_id uuid, ruta text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE resultado jsonb;
BEGIN
  UPDATE public.event_suppliers
     SET quote_files = (
       SELECT coalesce(jsonb_agg(
                CASE WHEN e->>'path' = ruta AND e->>'borrado' IS NULL
                     THEN jsonb_set(e, '{borrado}', to_jsonb(now()))
                     ELSE e
                END
              ), '[]'::jsonb)
       FROM jsonb_array_elements(quote_files) e
     )
   WHERE id = es_id
   RETURNING quote_files INTO resultado;

  RETURN resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjuntar_comprobante(pago_id uuid, archivo jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  resultado jsonb;
  visibles  int;
BEGIN
  SELECT count(*) INTO visibles
  FROM public.supplier_payments sp,
       LATERAL jsonb_array_elements(sp.receipt_files) e
  WHERE sp.id = pago_id
    AND e->>'borrado' IS NULL;

  IF visibles >= 5 THEN
    RAISE EXCEPTION 'tope_comprobantes' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.supplier_payments
     SET receipt_files = receipt_files || jsonb_build_array(archivo)
   WHERE id = pago_id
   RETURNING receipt_files INTO resultado;

  RETURN resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.quitar_comprobante(pago_id uuid, ruta text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE resultado jsonb;
BEGIN
  UPDATE public.supplier_payments
     SET receipt_files = (
       SELECT coalesce(jsonb_agg(
                CASE WHEN e->>'path' = ruta AND e->>'borrado' IS NULL
                     THEN jsonb_set(e, '{borrado}', to_jsonb(now()))
                     ELSE e
                END
              ), '[]'::jsonb)
       FROM jsonb_array_elements(receipt_files) e
     )
   WHERE id = pago_id
   RETURNING receipt_files INTO resultado;

  RETURN resultado;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjuntar_cotizacion(uuid, jsonb)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.quitar_cotizacion(uuid, text)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjuntar_comprobante(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.quitar_comprobante(uuid, text)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.adjuntar_cotizacion(uuid, jsonb)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_cotizacion(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjuntar_comprobante(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_comprobante(uuid, text)    TO authenticated;

COMMIT;


-- ============================================================
-- Comprobaciones despues de correrlo
-- ============================================================
-- 1) El bucket existe y es PRIVADO. 'public' tiene que salir en false:
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'event-docs';
--
-- 2) Las dos columnas, con default '[]':
-- select table_name, column_name, column_default
--   from information_schema.columns
--  where (table_name, column_name) in
--        (('event_suppliers','quote_files'), ('supplier_payments','receipt_files'));
--
-- 3) Las dos politicas del bucket, y NINGUNA de delete:
-- select policyname, cmd from pg_policies
--  where tablename = 'objects' and policyname like 'event_docs%';
--
-- 4) Los helpers leen bien una ruta y rechazan una mal formada:
-- select public.evento_de_ruta('11111111-1111-1111-1111-111111111111/cotizaciones/x/y.pdf'),
--        public.modulo_de_ruta('11111111-1111-1111-1111-111111111111/cotizaciones/x/y.pdf'),
--        public.evento_de_ruta('basura/cotizaciones/x/y.pdf'),
--        public.modulo_de_ruta('11111111-1111-1111-1111-111111111111/otra-cosa/x/y.pdf');
-- Esperado: el uuid, 'proveedores', NULL, NULL.


-- ============================================================
-- Marcha atras
-- ============================================================
-- Ojo: quitar las columnas TIRA la lista de archivos. Los objetos del bucket
-- sobreviven, pero se quedan sin quien los nombre. Solo si nadie subio nada.
--
-- BEGIN;
-- DROP POLICY IF EXISTS event_docs_ver   ON storage.objects;
-- DROP POLICY IF EXISTS event_docs_subir ON storage.objects;
-- DROP FUNCTION IF EXISTS public.adjuntar_cotizacion(uuid, jsonb);
-- DROP FUNCTION IF EXISTS public.quitar_cotizacion(uuid, text);
-- DROP FUNCTION IF EXISTS public.adjuntar_comprobante(uuid, jsonb);
-- DROP FUNCTION IF EXISTS public.quitar_comprobante(uuid, text);
-- DROP FUNCTION IF EXISTS public.evento_de_ruta(text);
-- DROP FUNCTION IF EXISTS public.modulo_de_ruta(text);
-- ALTER TABLE public.event_suppliers   DROP COLUMN IF EXISTS quote_files;
-- ALTER TABLE public.supplier_payments DROP COLUMN IF EXISTS receipt_files;
-- DELETE FROM storage.buckets WHERE id = 'event-docs';
-- COMMIT;
