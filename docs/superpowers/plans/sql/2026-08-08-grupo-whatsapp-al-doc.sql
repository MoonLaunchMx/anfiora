-- El link del grupo de WhatsApp se muda de events al documento de la invitacion.
--
-- Por que: es contenido de la invitacion (el anfitrion lo agrega si quiere), no
-- configuracion del evento. Vivia en Configuracion > Evento por una mala lectura
-- mia el 8-ago; Diego lo corrigio el mismo dia. En el doc respeta borrador y
-- publicado como el resto de la invitacion.
--
-- Ahora vive en: doc.sections[type='rsvp'].content.grupo_whatsapp
--
-- ORDEN: correr DESPUES de que el codigo que lee el doc este en origin/main.
-- Mientras la columna exista sin usarse no rompe nada, asi que no hay prisa.

-- ============ Verificacion previa (solo lectura) ============
-- 1) Confirmar que la columna existe y que NADIE la lleno todavia. Si alguna
--    fila tiene valor, ese planner perderia su link: hay que copiarlo a mano al
--    bloque de RSVP de su invitacion ANTES de correr el DROP.
-- select count(*) filter (where whatsapp_group_url is not null) as con_valor,
--        count(*) as total
-- from public.events;
-- Esperado: con_valor = 0.

BEGIN;

-- ============ 1) Fuera del candado ============
-- El trigger recibe las columnas protegidas como argumentos. Hay que quitarle el
-- nombre antes de tirar la columna, o queda apuntando a algo que no existe.
-- (guard_event_config compara via to_jsonb, asi que un nombre fantasma seria
-- inofensivo, pero dejarlo es basura que confunde al siguiente que lo lea.)
DROP TRIGGER IF EXISTS guard_events_config ON public.events;
CREATE TRIGGER guard_events_config
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_config(
    'id',
    'user_id', 'name', 'event_type', 'event_category', 'event_date', 'event_end_date',
    'event_time', 'venue', 'address', 'host_name', 'host_name_2', 'organization',
    'currency', 'event_status', 'planner_name', 'planner_phone', 'planner_email',
    'plan_tier', 'over_limit', 'locked'
  );

-- ============ 2) La columna ============
ALTER TABLE public.events DROP COLUMN IF EXISTS whatsapp_group_url;

COMMIT;

-- ============ Verificacion posterior ============
-- 1) La columna ya no esta, pero las tres del planner siguen:
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'events'
--   and column_name in ('planner_name','planner_phone','planner_email','whatsapp_group_url');
-- Esperado: 3 filas, sin whatsapp_group_url.
--
-- 2) El candado sigue activo y ya no menciona el grupo:
-- select tgname, tgenabled = 'O' as activo,
--        pg_get_triggerdef(oid) like '%whatsapp_group_url%' as menciona_grupo
-- from pg_trigger
-- where tgrelid = 'public.events'::regclass and tgname = 'guard_events_config';
-- Esperado: activo = true, menciona_grupo = false.
