-- Seguridad, Tramo 2b. Las subidas y el listado del bucket event-media.
-- No depende de ningun deploy: el codigo de hoy ya sube a estas rutas.
--
-- Lo que queda abierto despues del 2a:
--   * INSERT: "event-media subir autenticados" deja escribir en CUALQUIER
--     ruta del bucket. Cualquier cuenta con sesion puede llenar de archivos
--     la carpeta de un evento ajeno (borrarlos ya no puede, eso se cerro).
--   * SELECT: "event-media lectura publica" y "event-media audio public read"
--     son del rol public, o sea que SIN CUENTA se puede listar el bucket
--     entero y leer los nombres de todos los archivos de todos los eventos.
--
-- Las rutas que escribe la app (verificadas en el codigo, 18-sep):
--   avatars/<user_id>/...      app/configuracion/perfil       -> el propio dueno
--   logos/<workspace_id>/...   app/configuracion (layout)     -> miembro del workspace
--   imagenes/<event_id>/...    invitacion/SectionForm         -> quien edita Invitacion
--   audio/<event_id>/...       invitacion/SectionForm         -> quien edita Invitacion
--   dress-code/<event_id>/...  vestimenta/DressCodeEditor     -> quien edita Dress code
--
-- El bucket sigue siendo publico: las fotos se sirven por URL directa sin
-- consultar estas policies, asi que quitar el SELECT de public NO tumba
-- ninguna imagen. Lo unico que se pierde es poder LISTAR el bucket sin cuenta.
--
-- CORRERLO ENTERO DE UN JALON. Si un candado previo falla, aborta sin cambiar nada.

BEGIN;

-- ============================================================
-- 0. Candados previos
-- ============================================================
DO $$
DECLARE
  carpetas text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'event-media' AND public) THEN
    RAISE EXCEPTION 'ABORTA: event-media no es publico; quitar el SELECT de public dejaria las fotos sin verse';
  END IF;

  SELECT array_agg(DISTINCT split_part(name, '/', 1) ORDER BY split_part(name, '/', 1))
    INTO carpetas
    FROM storage.objects WHERE bucket_id = 'event-media';

  IF carpetas IS NOT NULL AND NOT (carpetas <@ ARRAY['avatars', 'logos', 'imagenes', 'audio', 'dress-code']) THEN
    RAISE EXCEPTION 'ABORTA: hay carpetas que no conozco en event-media: %', carpetas;
  END IF;
END $$;

-- ============================================================
-- 1. Quien puede subir a que carpeta
-- ============================================================
-- STABLE y sin SECURITY DEFINER: las funciones que consulta (es_miembro_de,
-- puede_editar) ya son definer y se evaluan con la sesion de quien sube.
CREATE OR REPLACE FUNCTION public.puede_subir_media(ruta text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public, storage, pg_temp
AS $$
DECLARE
  partes  text[] := storage.foldername(ruta);
  carpeta text   := partes[1];
  id      text   := partes[2];
  destino uuid;
BEGIN
  IF carpeta IS NULL OR id IS NULL THEN RETURN false; END IF;
  IF id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  destino := id::uuid;

  RETURN CASE carpeta
    WHEN 'avatars'    THEN destino = auth.uid()
    WHEN 'logos'      THEN public.es_miembro_de(destino)
    WHEN 'imagenes'   THEN public.puede_editar(destino, 'invitacion')
    WHEN 'audio'      THEN public.puede_editar(destino, 'invitacion')
    WHEN 'dress-code' THEN public.puede_editar(destino, 'vestimenta')
    ELSE false
  END;
END $$;

REVOKE EXECUTE ON FUNCTION public.puede_subir_media(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.puede_subir_media(text) TO authenticated;

DROP POLICY IF EXISTS "event-media subir autenticados" ON storage.objects;
DROP POLICY IF EXISTS "event-media audio auth upload"  ON storage.objects;

CREATE POLICY "event-media subir" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-media' AND public.puede_subir_media(name));

-- ============================================================
-- 2. El bucket deja de listarse sin cuenta
-- ============================================================
-- Las imagenes se siguen viendo: un bucket publico las sirve por URL directa,
-- sin pasar por RLS. Esto solo cierra el LISTADO.
DROP POLICY IF EXISTS "event-media lectura publica"   ON storage.objects;
DROP POLICY IF EXISTS "event-media audio public read" ON storage.objects;

CREATE POLICY "event-media listar con cuenta" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'event-media');

COMMIT;

-- ============ Verificacion (correr despues, solo lectura) ============
select 'V1 policies event-media' as chequeo,
  (select string_agg(policyname || ' [' || cmd || ': ' || array_to_string(roles, ',') || ']', ' | ' order by policyname)
     from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'event-media%') as resultado
union all
select 'V2 el bucket sigue siendo publico',
  (select public::text from storage.buckets where id = 'event-media')
union all
select 'V3 archivos por carpeta',
  (select jsonb_object_agg(carpeta, total)::text
     from (select split_part(name, '/', 1) carpeta, count(*) total
             from storage.objects where bucket_id = 'event-media' group by 1) x);
-- Esperado: V1 con subir / borrar / listar, ninguna del rol public.
--           V2 true. V3 las cinco carpetas de siempre.

-- ============ Revertir (solo si algo se rompe) ============
-- BEGIN;
-- DROP POLICY IF EXISTS "event-media subir" ON storage.objects;
-- CREATE POLICY "event-media subir autenticados" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-media');
-- DROP POLICY IF EXISTS "event-media listar con cuenta" ON storage.objects;
-- CREATE POLICY "event-media lectura publica" ON storage.objects
--   FOR SELECT TO public USING (bucket_id = 'event-media');
-- COMMIT;
