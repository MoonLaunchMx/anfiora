-- ============================================================================
-- Planes de planner, sello de fundador y los dos muros — 20 de septiembre 2026
--
-- Spec:  docs/superpowers/specs/2026-09-19-planes-planner-y-muros-design.md
-- Plan:  docs/superpowers/plans/2026-09-20-planes-planner-y-muros.md
-- Rama:  feat/muro-un-evento (Tareas 1 a 11 = el codigo; esta es la 12)
--
-- REEMPLAZA POR COMPLETO a supabase/2026-08-19-muro-eventos.sql, que se borro
-- en el mismo commit: aquel leia un catalogo de planes ('solo', 'studio' con
-- 25 eventos, el correo superuser@anfiora.com) que ya no existe. Lo que seguia
-- sirviendo — el gate de cupo, evento_editable y el disparador de archivado —
-- se conserva aqui, actualizado. Si hace falta el texto anterior de alguna
-- funcion, esta en git: ese archivo, en el commit anterior al que lo borro.
--
-- CUANDO SE CORRE: DESPUES de que el deploy este arriba y verificado. Nada de
-- esto es inerte:
--   - El muro de eventos hace que un free con un evento vigente ya no pueda
--     crear el segundo. Sin el deploy, el usuario ve el error crudo de
--     Postgres ("EVENT_LIMIT_EXCEEDED:2:1") dentro del modal, sin explicacion.
--   - El muro de invitados corta el invitado 51 de una cuenta free. Sin el
--     deploy, mismo error crudo en la lista de invitados y en la importacion.
--   - El evento archivado se vuelve de solo lectura en el momento en que corre
--     el BLOQUE 6, no cuando el BLOQUE 7 migre los estatus viejos: quien este
--     a media edicion de un evento pausado se topa con EVENTO_ARCHIVADO en su
--     proximo guardado.
--
-- COMO SE CORRE:
--   0. El renglon B11 del BLOQUE 0-A (cuentas Pro con mas de un asiento
--      ocupado) se corre ANTES DE DESPLEGAR el codigo, no junto con el resto
--      de este archivo: con el catalogo nuevo Pro es de un solo asiento, y esa
--      cuenta pierde el boton de invitar desde el momento del deploy, no
--      desde que corre este SQL. Es de solo lectura, se puede correr suelto.
--   1. El BLOQUE 0-A completo, primero (ya con el deploy arriba). Es de solo
--      lectura, no cambia nada, y dice el tamano exacto del cambio. Leerlo
--      antes de seguir, y GUARDAR su resultado: trae la lista de eventos que
--      el BLOQUE 7 migra, que es lo unico que permite deshacer esa migracion
--      evento por evento.
--   2. Todo lo demas de un jalon, desde BEGIN hasta COMMIT: es UNA SOLA
--      TRANSACCION. Si un candado del BLOQUE 0-B falla, aborta SIN CAMBIAR
--      NADA. Es re-corrible completo.
--   3. La verificacion del final, tambien sola. Es de solo lectura.
--   4. La PRUEBA OBLIGATORIA del BLOQUE 3, una vez. Es la unica pieza que no
--      se puede dar por buena leyendo.
--
-- OTRO AGENTE ESTA TRABAJANDO LA AUDITORIA DE SEGURIDAD en esta misma base
-- (archivos docs/superpowers/plans/sql/2026-09-1x-seguridad-*.sql). Este
-- archivo NO reescribe nada de lo suyo: ni guard_users_plan, ni
-- guard_event_config, ni sus policies. Lo unico que toca de su terreno son dos
-- GRANT de la seccion PERMISOS DE EJECUCION, que va al final, despues del
-- BLOQUE 6: ahi estan explicados con su motivo.
-- ============================================================================


-- ============================================================================
-- BLOQUE 0-A — RADIOGRAFIA (CORRER SOLO, ANTES. SOLO LECTURA)
-- ============================================================================
-- Todavia no existe workspaces.sello, asi que aqui nadie tiene sello y el
-- catalogo se lee de workspaces.plan con caida a users.plan. Los numeros son
-- el tamano real del cambio: cuantos eventos se migran (y CUALES), cuantas
-- cuentas quedan por encima de su tope (no se les quita nada: el muro actua
-- sobre lo que entra, no sobre lo que ya entro) y que estorba.
WITH hijas AS (
  SELECT unnest(ARRAY[
    'guests','party_members','tables','table_seats','event_budgets',
    'event_suppliers','event_timeline_tasks','event_itinerary_moments',
    'event_settings','song_recommendations','gift_registry_items',
    'gift_reservations','event_collaborators','supplier_reviews'
  ]) AS t
),
declaradas AS (
  -- Huecos que este archivo declara a proposito (ver BLOQUE 6).
  SELECT unnest(ARRAY[
    'event_audit_log','conversations','messages','channel_participants','wa_messages'
  ]) AS t
),
esperadas AS (
  SELECT * FROM (VALUES
    ('get_account_capacity',       'uuid',       'TABLE(active integer, lim integer, remaining integer, over boolean)'),
    ('plan_del_evento',            'uuid',       'text'),
    ('evento_editable',            'uuid',       'boolean'),
    ('plan_y_sello_de',            'uuid, uuid', 'TABLE(plan text, sello text)'),
    ('plan_y_sello_de_cuenta',     'uuid',       'TABLE(plan text, sello text)'),
    ('plan_y_sello_del_evento',    'uuid',       'TABLE(plan text, sello text)'),
    ('limite_eventos_de_plan',     'text, text', 'integer'),
    ('limite_invitados_de_plan',   'text, text', 'integer'),
    ('limite_invitados_del_evento','uuid',       'integer'),
    ('eventos_vigentes_de',        'uuid',       'integer'),
    ('personas_del_evento',        'uuid',       'integer'),
    ('events_gate_cupo',           '',           'trigger'),
    ('invitados_gate_cupo',        '',           'trigger'),
    ('guard_workspace_sello',      '',           'trigger'),
    ('guard_cliente_sin_total',    '',           'trigger'),
    ('bloquea_evento_archivado',   '',           'trigger'),
    ('bloquea_pago_archivado',     '',           'trigger')
  ) AS v(nombre, args, resultado)
),
plan_de AS (
  SELECT u.id AS user_id, lower(coalesce(w.plan, u.plan, 'free')) AS plan
    FROM users u
    LEFT JOIN workspaces w ON w.primary_owner_id = u.id
),
personas AS (
  SELECT e.id, e.user_id,
         (SELECT count(*) FROM guests g        WHERE g.event_id = e.id)
       + (SELECT count(*) FROM party_members m WHERE m.event_id = e.id) AS personas
    FROM events e
),
vigentes AS (
  SELECT e.user_id, count(*) AS n
    FROM events e
   WHERE coalesce(e.event_status,'active') = 'active'
     AND (coalesce(e.event_end_date, e.event_date) IS NULL
          OR coalesce(e.event_end_date, e.event_date) >= current_date)
   GROUP BY e.user_id
)
SELECT jsonb_pretty(jsonb_build_object(

  -- ---------- lo que hace abortar al archivo ----------
  'A1_check_de_event_status_que_impide_archived',
    (SELECT coalesce(string_agg(conname || ' => ' || pg_get_constraintdef(oid), ' | '), 'ninguno')
       FROM pg_constraint
      WHERE conrelid = 'public.events'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%event_status%'
        AND pg_get_constraintdef(oid) NOT ILIKE '%archived%'),

  'A2_tipo_de_events_event_status_debe_ser_texto',
    (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'event_status'),

  'A3_funciones_que_ya_existen_con_otra_firma',
    (SELECT coalesce(string_agg(e.nombre || '(' || e.args || ') hoy devuelve ' ||
                                replace(pg_get_function_result(p.oid), '"', '') ||
                                ' y se espera ' || e.resultado, ' | '), 'ninguna')
       FROM esperadas e
       JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace
                     AND p.proname = e.nombre
                     AND pg_get_function_identity_arguments(p.oid) = e.args
      WHERE replace(pg_get_function_result(p.oid), '"', '') <> e.resultado),

  'A4_planes_en_workspaces_fuera_del_catalogo',
    (SELECT coalesce(string_agg(DISTINCT plan, ', '), 'ninguno') FROM workspaces
      WHERE plan IS NOT NULL AND plan NOT IN ('free','pro','studio','agency')),

  'A5_eventos_con_dos_o_mas_clientes_vivos',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('event_id', t.event_id, 'clientes', t.n)), '[]'::jsonb)
       FROM (SELECT c.event_id, count(*) AS n FROM event_collaborators c
              WHERE c.tipo = 'cliente' AND coalesce(c.status,'pending') <> 'revoked'
              GROUP BY c.event_id HAVING count(*) > 1) t),

  'A6_tablas_hijas_que_no_existen_o_no_traen_event_id',
    (SELECT coalesce(string_agg(
              h.t || CASE WHEN to_regclass('public.' || h.t) IS NULL
                          THEN ' (la tabla no existe)' ELSE ' (existe pero sin event_id)' END, ', '), 'ninguna')
       FROM hijas h
      WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                         WHERE c.table_schema = 'public' AND c.table_name = h.t
                           AND c.column_name = 'event_id')),

  'A7_otro_check_de_plan_en_workspaces_sin_studio',
    (SELECT coalesce(string_agg(conname || ' => ' || pg_get_constraintdef(oid), ' | '), 'ninguno')
       FROM pg_constraint
      WHERE conrelid = 'public.workspaces'::regclass AND contype = 'c'
        AND conname <> 'workspaces_plan_valido'
        AND pg_get_constraintdef(oid) ILIKE '%plan%'
        AND pg_get_constraintdef(oid) NOT ILIKE '%studio%'),

  -- ---------- lo que hay que mirar a ojo ----------
  'B1_checks_de_workspaces_CON_SU_NOMBRE',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('nombre', conname, 'definicion', pg_get_constraintdef(oid))), '[]'::jsonb)
       FROM pg_constraint
      WHERE conrelid = 'public.workspaces'::regclass AND contype = 'c'),

  'B2_checks_de_users_plan_SIN_STUDIO_ES_PROBLEMA',
    (SELECT coalesce(string_agg(conname || ' => ' || pg_get_constraintdef(oid), ' | '), 'ninguno')
       FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%plan%'),

  'B3_eventos_por_estatus_hoy',
    (SELECT jsonb_object_agg(s, n) FROM (
       SELECT coalesce(event_status,'active') AS s, count(*) AS n FROM events GROUP BY 1) x),

  -- GUARDA ESTA LISTA. Es lo unico con lo que se puede deshacer el BLOQUE 7
  -- evento por evento: los eventos viejos no tienen renglon en event_audit_log.
  'B4_eventos_que_el_bloque_7_migra_GUARDAR_ESTA_LISTA',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'id', e.id, 'nombre', e.name, 'estatus', e.event_status, 'fecha', e.event_date)
              ORDER BY e.event_status, e.event_date), '[]'::jsonb)
       FROM events e WHERE coalesce(e.event_status,'active') NOT IN ('active','archived')),

  'B5_cuentas_free_con_mas_de_un_evento_vigente',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('cuenta', u.email, 'vigentes', v.n)), '[]'::jsonb)
       FROM vigentes v JOIN plan_de p ON p.user_id = v.user_id JOIN users u ON u.id = v.user_id
      WHERE p.plan = 'free' AND v.n > 1),

  'B6_eventos_free_ya_arriba_del_tope_de_50_personas',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('cuenta', u.email, 'personas', pe.personas) ORDER BY pe.personas DESC), '[]'::jsonb)
       FROM personas pe JOIN plan_de p ON p.user_id = pe.user_id JOIN users u ON u.id = pe.user_id
      WHERE p.plan = 'free' AND pe.personas > 50),

  'B7_clientes_con_algun_modulo_en_total_hoy',
    (SELECT count(*) FROM event_collaborators c
      WHERE c.tipo = 'cliente' AND c.permisos IS NOT NULL
        AND jsonb_typeof(c.permisos) = 'object'
        AND EXISTS (SELECT 1 FROM jsonb_each(c.permisos) e WHERE e.value = '"total"'::jsonb)),

  -- Toda tabla con event_id que NO esta ni en las catorce ni declarada como
  -- hueco en el BLOQUE 6. Si aqui sale algo, o entra a la lista o se declara.
  'B8_tablas_con_event_id_que_nadie_declaro',
    (SELECT coalesce(string_agg(c.relname, ', ' ORDER BY c.relname), 'ninguna')
       FROM pg_class c
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'event_id'
                          AND a.attnum > 0 AND NOT a.attisdropped
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
        AND c.relname NOT IN (SELECT t FROM hijas)
        AND c.relname NOT IN (SELECT t FROM declaradas)),

  'B9_indices_por_event_id_que_el_muro_de_invitados_va_a_usar',
    (SELECT coalesce(string_agg(indexname, ', '), 'NINGUNO — ver la nota del BLOQUE 3') FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('guests','party_members')
        AND indexdef ILIKE '%event_id%'),

  'B10_funciones_de_otros_tramos_que_este_archivo_llama',
    (SELECT coalesce(jsonb_object_agg(f, existe), '{}'::jsonb) FROM (
       SELECT f, EXISTS (SELECT 1 FROM pg_proc p
                          WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f) AS existe
         FROM unnest(ARRAY['is_event_member','es_admin_de','plan_del_evento','asegurar_workspace']) AS f) y),

  -- CORRER ESTE RENGLON ANTES DE DESPLEGAR, no junto con el resto del bloque:
  -- con el catalogo nuevo Pro es de un solo asiento (asientosIncluidos: 1 en
  -- lib/workspace/planes.ts). Estas cuentas pierden el boton de invitar desde
  -- el momento del deploy del codigo, sin esperar a que este SQL corra.
  -- Asiento ocupado = igual que contarAsientos en lib/workspace/asientos.ts:
  -- un miembro en status pending o active.
  'B11_cuentas_pro_con_mas_de_un_asiento_ocupado_CORRER_ANTES_DEL_DEPLOY',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
              'workspace', w.name, 'dueno', u.email, 'asientos_ocupados', m.n
            ) ORDER BY m.n DESC), '[]'::jsonb)
       FROM workspaces w
       JOIN users u ON u.id = w.primary_owner_id
       JOIN (SELECT workspace_id, count(*) AS n FROM workspace_members
              WHERE status IN ('pending','active') GROUP BY workspace_id) m ON m.workspace_id = w.id
      WHERE lower(coalesce(w.plan, u.plan, 'free')) = 'pro' AND m.n > 1)

)) AS radiografia;
-- Lo esperado: A1 a A7 en 'ninguno' / '[]' (si no, el archivo aborta y dice
-- que arreglar), A2 'text'. B1 y B2 se miran a ojo: si hay un CHECK de plan
-- con otro nombre, hay que tirarlo por su nombre. B4 se guarda. B8 deberia
-- decir 'ninguna'; si no, esa tabla entra al BLOQUE 6 o se declara como hueco.
-- B11 se corre ANTES del deploy (ver el punto 0 de COMO SE CORRE, arriba):
-- cada cuenta que salga ahi pierde el boton de invitar en cuanto el codigo
-- suba, y Diego decide si le sube el plan antes de que alguien lo note.


-- ============================================================================
-- DE AQUI AL COMMIT, DE UN JALON. UNA SOLA TRANSACCION.
-- ============================================================================
BEGIN;

-- Antes de tomar el primer candado: si una consulta larga tiene ocupada
-- workspaces, events, guests o party_members, este archivo falla rapido en vez
-- de quedarse esperando con candados exclusivos tomados y encolar detras a
-- todos los planners conectados. El remedio es volver a correrlo: es
-- idempotente de cabo a rabo.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ============================================================================
-- BLOQUE 0-B — CANDADOS QUE ABORTAN SIN CAMBIAR NADA
-- ============================================================================
DO $$
DECLARE
  faltan text;
BEGIN
  -- 1. Un CHECK viejo sobre events.event_status que no conozca 'archived'
  --    dejaria la base a medias: el BLOQUE 7 abortaria y, peor, la app ya
  --    desplegada escribe 'archived' al archivar.
  SELECT string_agg(conname, ', ') INTO faltan
    FROM pg_constraint
   WHERE conrelid = 'public.events'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%event_status%'
     AND pg_get_constraintdef(oid) NOT ILIKE '%archived%';
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: el CHECK % sobre events.event_status no permite archived. Ampliarlo o tirarlo antes de correr este archivo', faltan;
  END IF;

  -- 2. Si event_status fuera un enum en vez de texto, escribir 'archived'
  --    fallaria igual aunque no haya CHECK.
  SELECT data_type INTO faltan FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'event_status';
  IF faltan IS NULL OR faltan NOT IN ('text', 'character varying') THEN
    RAISE EXCEPTION 'ABORTA: events.event_status es de tipo % y este archivo lo trata como texto', coalesce(faltan, 'inexistente');
  END IF;

  -- 3. Columnas que este archivo da por hechas.
  SELECT string_agg(x.t || '.' || x.c, ', ') INTO faltan FROM (
    VALUES ('events','event_status'), ('events','event_date'), ('events','event_end_date'),
           ('events','user_id'), ('events','workspace_id'),
           ('workspaces','plan'), ('workspaces','primary_owner_id'),
           ('users','plan'), ('guests','event_id'), ('party_members','event_id'),
           ('event_collaborators','tipo'), ('event_collaborators','permisos'),
           ('event_collaborators','status'), ('event_collaborators','event_id'),
           ('supplier_payments','event_supplier_id')
  ) AS x(t, c)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                     WHERE c.table_schema = 'public' AND c.table_name = x.t AND c.column_name = x.c);
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: faltan columnas que este archivo da por hechas: %', faltan;
  END IF;

  -- 4. Funciones de otros tramos que este archivo LLAMA (no redefine).
  SELECT string_agg(f, ', ') INTO faltan
    FROM unnest(ARRAY['is_event_member','es_admin_de']) AS f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p
                      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f);
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: faltan funciones del tramo de accesos: %. Correr antes 2026-09-05-accesos-timeline-cimiento.sql y 2026-09-08-workspace-cimiento.sql', faltan;
  END IF;

  -- 5. Firmas. CREATE OR REPLACE FUNCTION no deja cambiar el tipo de regreso, y
  --    del texto anterior de get_account_capacity, plan_del_evento y
  --    evento_editable ya no queda copia en el repo. Si alguna existe hoy con
  --    otra forma, este archivo reventaria a media transaccion.
  SELECT string_agg(e.nombre || '(' || e.args || ') devuelve ' ||
                    replace(pg_get_function_result(p.oid), '"', '') ||
                    ' y aqui se espera ' || e.resultado, ' | ') INTO faltan
    FROM (VALUES
      ('get_account_capacity',       'uuid',       'TABLE(active integer, lim integer, remaining integer, over boolean)'),
      ('plan_del_evento',            'uuid',       'text'),
      ('evento_editable',            'uuid',       'boolean'),
      ('plan_y_sello_de',            'uuid, uuid', 'TABLE(plan text, sello text)'),
      ('plan_y_sello_de_cuenta',     'uuid',       'TABLE(plan text, sello text)'),
      ('plan_y_sello_del_evento',    'uuid',       'TABLE(plan text, sello text)'),
      ('limite_eventos_de_plan',     'text, text', 'integer'),
      ('limite_invitados_de_plan',   'text, text', 'integer'),
      ('limite_invitados_del_evento','uuid',       'integer'),
      ('eventos_vigentes_de',        'uuid',       'integer'),
      ('personas_del_evento',        'uuid',       'integer'),
      ('events_gate_cupo',           '',           'trigger'),
      ('invitados_gate_cupo',        '',           'trigger'),
      ('guard_workspace_sello',      '',           'trigger'),
      ('guard_cliente_sin_total',    '',           'trigger'),
      ('bloquea_evento_archivado',   '',           'trigger'),
      ('bloquea_pago_archivado',     '',           'trigger')
    ) AS e(nombre, args, resultado)
    JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace
                  AND p.proname = e.nombre
                  AND pg_get_function_identity_arguments(p.oid) = e.args
   WHERE replace(pg_get_function_result(p.oid), '"', '') <> e.resultado;
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: hay funciones con otra firma: %. Tirarlas con DROP FUNCTION antes de correr', faltan;
  END IF;

  -- 6. Las tablas hijas del BLOQUE 6 tienen que existir y colgar de event_id.
  --    Si alguna no, se saca de la lista a mano y se declara como hueco; NO se
  --    finge que quedo cerrada.
  SELECT string_agg(h.t || CASE WHEN to_regclass('public.' || h.t) IS NULL
                                THEN ' (la tabla no existe)'
                                ELSE ' (la tabla existe pero no tiene event_id)' END, ', ') INTO faltan
    FROM unnest(ARRAY[
      'guests','party_members','tables','table_seats','event_budgets',
      'event_suppliers','event_timeline_tasks','event_itinerary_moments',
      'event_settings','song_recommendations','gift_registry_items',
      'gift_reservations','event_collaborators','supplier_reviews'
    ]) AS h(t)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public' AND c.table_name = h.t
                        AND c.column_name = 'event_id');
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: problemas con las tablas del BLOQUE 6: %. Sacarlas de la lista y anotarlas como hueco', faltan;
  END IF;

  -- 7. El catalogo nuevo tiene cuatro planes. Si alguna fila trae otro valor,
  --    el CHECK del BLOQUE 1 fallaria a media transaccion.
  SELECT string_agg(DISTINCT plan, ', ') INTO faltan FROM workspaces
   WHERE plan IS NOT NULL AND plan NOT IN ('free','pro','studio','agency');
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: hay workspaces con plan fuera del catalogo: %. Corregirlos antes', faltan;
  END IF;

  -- 8. Un CHECK de plan con OTRO nombre seguiria prohibiendo Studio despues de
  --    que este archivo amplie el suyo, y nadie se enteraria: /admin fallaria
  --    en silencio, como hoy.
  SELECT string_agg(conname, ', ') INTO faltan
    FROM pg_constraint
   WHERE conrelid = 'public.workspaces'::regclass AND contype = 'c'
     AND conname <> 'workspaces_plan_valido'
     AND pg_get_constraintdef(oid) ILIKE '%plan%'
     AND pg_get_constraintdef(oid) NOT ILIKE '%studio%';
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: el CHECK % sobre workspaces tambien limita plan y no conoce studio. Tirarlo por su nombre antes de correr', faltan;
  END IF;

  -- 9. El indice unico del BLOQUE 5 no se puede crear si ya hay un evento con
  --    dos clientes vivos.
  SELECT string_agg(t.event_id::text, ', ') INTO faltan
    FROM (SELECT c.event_id FROM event_collaborators c
           WHERE c.tipo = 'cliente' AND coalesce(c.status,'pending') <> 'revoked'
           GROUP BY c.event_id HAVING count(*) > 1) t;
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: estos eventos ya tienen mas de un cliente vivo: %. Revocar los de mas antes de correr', faltan;
  END IF;

  -- 10. Propiedad. Reemplazar una funcion, revocarle permisos u otorgarselos
  --     exige ser su dueno (o miembro del rol dueno). Si alguna de las que ya
  --     existen la creo otro rol, el archivo abortaria a media corrida con un
  --     error de propiedad. Mejor saberlo aqui.
  SELECT string_agg(p.proname || ' (dueno: ' || pg_get_userbyid(p.proowner) || ')', ', ') INTO faltan
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('limite_eventos_de_plan','limite_invitados_de_plan','plan_y_sello_de',
                       'plan_y_sello_de_cuenta','plan_y_sello_del_evento','limite_invitados_del_evento',
                       'personas_del_evento','eventos_vigentes_de','evento_editable',
                       'get_account_capacity','plan_del_evento','guard_workspace_sello',
                       'events_gate_cupo','invitados_gate_cupo','guard_cliente_sin_total',
                       'bloquea_evento_archivado','bloquea_pago_archivado')
     AND NOT pg_has_role(current_user, p.proowner, 'USAGE');
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: % no te pertenecen y no las podrias reemplazar ni cambiarles permisos. Correr este archivo con el rol dueno', faltan;
  END IF;

  -- AVISO, no candado: ALTER TABLE workspaces y los CREATE TRIGGER de los
  -- BLOQUES 1 a 6 tambien piden ser dueno de esas tablas. En Supabase el editor
  -- de SQL corre como `postgres`, que las creo todas, asi que no se comprueba
  -- aqui; si alguna vez este archivo se corre con otro rol, es lo primero que
  -- fallaria.
END $$;


-- ============================================================================
-- BLOQUE 1 — EL SELLO DE PARTNER FUNDADOR
-- ============================================================================
-- El sello vive en el workspace, no en la persona: es la cuenta la que queda
-- sin topes. Solo lo pone /admin (service role). 25 lugares, y el tope se
-- cierra AQUI: la ruta cuenta y luego escribe, y dos peticiones casi
-- simultaneas dejarian 26.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS sello       text,
  ADD COLUMN IF NOT EXISTS sello_desde date;

ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_sello_valido;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_sello_valido CHECK (sello IS NULL OR sello = 'fundador');

-- El catalogo de planes gano 'studio' (Tarea 2). El CHECK del 8-sep solo
-- conoce free/pro/agency, asi que hoy /admin NO puede guardar Studio en el
-- workspace: la escritura falla y la ruta lo reporta como aviso. Se amplia.
-- ESPEJO: PLAN_IDS en lib/workspace/planes.ts.
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_valido;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_valido CHECK (plan IN ('free', 'pro', 'studio', 'agency'));

-- Mismo candado, misma forma, que guard_users_plan de
-- docs/superpowers/plans/sql/2026-09-17-seguridad-2a-cerrar-ya.sql: con sesion
-- de navegador (auth.uid() no nulo) no se toca; sin ella (service role) si.
-- Ademas:
--   - sello_desde se llena solo, porque /api/admin/update-plan no lo escribe.
--   - el tope de 25 se serializa con un candado de transaccion: la segunda
--     peticion espera a que la primera termine y entonces cuenta de verdad.
-- ESPEJO: LUGARES_FUNDADOR en lib/workspace/sello.ts.
CREATE OR REPLACE FUNCTION public.guard_workspace_sello()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ocupados int;
  v_lugares  int := 25;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.sello IS NOT NULL OR NEW.sello_desde IS NOT NULL THEN
        RAISE EXCEPTION 'El sello de partner fundador no se pone desde aqui' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.sello IS DISTINCT FROM OLD.sello
       OR NEW.sello_desde IS DISTINCT FROM OLD.sello_desde THEN
      RAISE EXCEPTION 'El sello de partner fundador no se pone desde aqui' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.sello IS NULL THEN
    NEW.sello_desde := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR OLD.sello IS DISTINCT FROM NEW.sello THEN
    NEW.sello_desde := coalesce(NEW.sello_desde, current_date);
    PERFORM pg_advisory_xact_lock(2026, 920);
    SELECT count(*)::int INTO v_ocupados
      FROM workspaces w
     WHERE w.sello = 'fundador' AND w.id IS DISTINCT FROM NEW.id;
    IF v_ocupados >= v_lugares THEN
      RAISE EXCEPTION 'Ya no hay lugares de partner fundador: son %', v_lugares;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_workspace_sello ON public.workspaces;
CREATE TRIGGER guard_workspace_sello
  BEFORE INSERT OR UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_sello();


-- ============================================================================
-- BLOQUE 2 — EL CUPO DE EVENTOS
-- ============================================================================
-- Los numeros del catalogo viven DUPLICADOS a proposito: aqui esta el candado
-- de verdad y en TypeScript esta la interfaz que se adelanta para avisar antes
-- de intentarlo.
-- ESPEJO: lib/workspace/planes.ts (PLANES[*].eventosActivos e
--         .invitadosPorEvento) y lib/workspace/sello.ts (limiteEventos,
--         limiteInvitados). Si cambias un numero aqui, cambialo alla.
-- NULL = sin limite.

CREATE OR REPLACE FUNCTION public.limite_eventos_de_plan(p_plan text, p_sello text)
RETURNS int LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_sello, '')) = 'fundador'                    THEN NULL::int
    WHEN lower(coalesce(p_plan, 'free')) IN ('pro','studio','agency') THEN NULL::int
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.limite_invitados_de_plan(p_plan text, p_sello text)
RETURNS int LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_sello, '')) = 'fundador'                    THEN NULL::int
    WHEN lower(coalesce(p_plan, 'free')) IN ('pro','studio','agency') THEN NULL::int
    ELSE 50
  END
$$;

-- LAS DOS PAREDES MIDEN IGUAL, y esta es la funcion que lo garantiza: manda el
-- workspace donde vive el evento; si no hay, el workspace propio del dueno; si
-- tampoco, users.plan (que /admin sigue escribiendo por compatibilidad); al
-- final, free. Un evento que vive en un workspace de paga ajeno no puede
-- quedar sin tope de invitados y topado a un evento al mismo tiempo.
CREATE OR REPLACE FUNCTION public.plan_y_sello_de(p_workspace_id uuid, p_user_id uuid)
RETURNS TABLE (plan text, sello text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT f.plan, f.sello FROM (
    SELECT w.plan, w.sello, 1 AS orden FROM workspaces w WHERE w.id = p_workspace_id
    UNION ALL
    SELECT w.plan, w.sello, 2 FROM workspaces w WHERE w.primary_owner_id = p_user_id
    UNION ALL
    SELECT coalesce(u.plan, 'free'), NULL::text, 3 FROM users u WHERE u.id = p_user_id
    UNION ALL
    SELECT 'free', NULL::text, 4
  ) f ORDER BY f.orden LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.plan_y_sello_de_cuenta(p_user_id uuid)
RETURNS TABLE (plan text, sello text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.plan, c.sello FROM public.plan_y_sello_de(NULL::uuid, p_user_id) c
$$;

-- Un evento VIGENTE es el que esta 'active' y cuyo ultimo dia (la fecha de fin
-- si existe, si no la de inicio) es de hoy en adelante. Sin fecha, cuenta.
-- OJO con la zona horaria: current_date es UTC y Mexico va seis horas atras,
-- asi que un evento que termina "hoy" deja de ocupar lugar a las 18:00 hora de
-- Mexico. Libera antes, nunca bloquea de mas.
-- ESPEJO: ocupaLugar() en lib/events/estado.ts.
CREATE OR REPLACE FUNCTION public.eventos_vigentes_de(p_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM events e
   WHERE e.user_id = p_user_id
     AND coalesce(e.event_status, 'active') = 'active'
     AND (coalesce(e.event_end_date, e.event_date) IS NULL
          OR coalesce(e.event_end_date, e.event_date) >= current_date)
$$;

-- Cuantos eventos vigentes lleva la cuenta y cuantos puede llevar. La firma y
-- los nombres de columna NO cambian: lib/capacity.ts lee data[0].active/lim/
-- remaining/over. Lo que cambia es el catalogo (Free uno, los de paga sin
-- limite, sello sin limite) y que ya no hay correo privilegiado a mano.
--
-- Esta funcion contesta por CUENTA, sin evento de por medio, asi que no puede
-- resolver el plan por el workspace del evento como hace el disparador. Para
-- no inventar un muro que la base no aplicaria, es generosa: si alguno de los
-- eventos vigentes de la cuenta vive en un workspace sin tope, contesta sin
-- tope. Quedarse corta por aqui no abre nada — el candado real es el
-- disparador, y su rechazo lo pinta la misma pantalla.
--
-- Devuelve CERO FILAS cuando el que pregunta no tiene por que saberlo; la
-- interfaz lo toma como "no pude averiguarlo" y deja pasar.
CREATE OR REPLACE FUNCTION public.get_account_capacity(p_user_id uuid)
RETURNS TABLE (active int, lim int, remaining int, over boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_plan text; v_sello text; v_lim int; v_active int;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT EXISTS (SELECT 1 FROM events e
                      WHERE e.user_id = p_user_id AND public.is_event_member(e.id))
  THEN
    RETURN;
  END IF;

  SELECT c.plan, c.sello INTO v_plan, v_sello FROM public.plan_y_sello_de_cuenta(p_user_id) c;
  v_lim    := public.limite_eventos_de_plan(v_plan, v_sello);
  v_active := public.eventos_vigentes_de(p_user_id);

  IF v_lim IS NOT NULL AND EXISTS (
       SELECT 1 FROM events e
        JOIN workspaces w ON w.id = e.workspace_id
        WHERE e.user_id = p_user_id
          AND coalesce(e.event_status, 'active') = 'active'
          AND (coalesce(e.event_end_date, e.event_date) IS NULL
               OR coalesce(e.event_end_date, e.event_date) >= current_date)
          AND public.limite_eventos_de_plan(w.plan, w.sello) IS NULL)
  THEN
    v_lim := NULL;
  END IF;

  RETURN QUERY SELECT
    v_active,
    v_lim,
    CASE WHEN v_lim IS NULL THEN NULL ELSE greatest(v_lim - v_active, 0) END,
    CASE WHEN v_lim IS NULL THEN false ELSE v_active >= v_lim END;
END $$;

-- El gate. Actua solo cuando el evento ENTRA a contar: al crearse activo con
-- fecha vigente, al reactivarse, o al mover su fecha de pasada a futura.
-- Editar cualquier otra cosa nunca se bloquea. El lugar lo paga el DUENO del
-- evento (events.user_id), no quien esta guardando; el plan sale del workspace
-- del evento, igual que en el muro de invitados.
--
-- LAS DOS MITADES NO SE MIDEN EN EL MISMO SITIO, y hay que saberlo: el LIMITE
-- sale del workspace donde entra el evento, pero el CONTEO (eventos_vigentes_de)
-- es por dueno y atraviesa todos sus workspaces. Un dueno con cinco eventos
-- vigentes en un workspace de paga que cree el sexto en su workspace gratuito
-- se lo topan: el limite que aplica es el del workspace gratuito, 1, y ya lleva
-- cinco contados. Hoy es improbable (hace falta ser dueno de eventos en dos
-- workspaces a la vez) y el remedio del usuario es crear el evento dentro del
-- workspace de paga. Contar por workspace en vez de por dueno seria otro
-- diseno: el spec dice que el lugar lo paga el dueno.
--
-- A PROPOSITO NO TIENE ESCAPE PARA EL SERVICE ROLE, a diferencia de los otros
-- dos disparadores de este archivo: los eventos no los crea ni los reactiva
-- ningun canal de entrada — hoy no hay una sola escritura a events desde el
-- servidor (verificado en app/api el 20-sep), solo desde el navegador. Si
-- algun dia una ruta de soporte reactiva eventos, se topara con
-- EVENT_LIMIT_EXCEEDED en crudo; la salida seria agregar aqui arriba:
--     IF auth.uid() IS NULL THEN RETURN NEW; END IF;
-- que abre el muro a TODO lo que entre con la llave de servicio. No se pone
-- hasta que exista esa ruta y se decida.
CREATE OR REPLACE FUNCTION public.events_gate_cupo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_plan text; v_sello text; v_lim int; v_active int;
BEGIN
  -- Despues de esta operacion, ¿el evento cuenta?
  IF coalesce(NEW.event_status, 'active') <> 'active'
     OR (coalesce(NEW.event_end_date, NEW.event_date) IS NOT NULL
         AND coalesce(NEW.event_end_date, NEW.event_date) < current_date) THEN
    RETURN NEW;
  END IF;

  -- Si ya contaba antes, no esta entrando: esto es editar.
  IF TG_OP = 'UPDATE'
     AND coalesce(OLD.event_status, 'active') = 'active'
     AND (coalesce(OLD.event_end_date, OLD.event_date) IS NULL
          OR coalesce(OLD.event_end_date, OLD.event_date) >= current_date) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT c.plan, c.sello INTO v_plan, v_sello
    FROM public.plan_y_sello_de(NEW.workspace_id, NEW.user_id) c;
  v_lim := public.limite_eventos_de_plan(v_plan, v_sello);
  IF v_lim IS NULL THEN RETURN NEW; END IF;

  v_active := public.eventos_vigentes_de(NEW.user_id);
  IF v_active >= v_lim THEN
    RAISE EXCEPTION 'EVENT_LIMIT_EXCEEDED:%:%', v_active + 1, v_lim;
  END IF;

  RETURN NEW;
END $$;

-- Los disparadores BEFORE de events corren en orden alfabetico:
-- set_event_workspace va antes que trg_events_gate_cupo, asi que
-- NEW.workspace_id ya viene resuelto cuando este mira el plan.
DROP TRIGGER IF EXISTS trg_events_gate_cupo ON public.events;
CREATE TRIGGER trg_events_gate_cupo
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_gate_cupo();


-- ============================================================================
-- BLOQUE 3 — EL CUPO DE INVITADOS
-- ============================================================================
-- Se cuentan PERSONAS: filas de guests mas filas de party_members del evento.
-- El tope es el del workspace del evento (y si no tiene, el del dueno), con el
-- sello quitandolo.
-- ESPEJO: contarPersonas() en lib/invitados/cupo.ts.

CREATE OR REPLACE FUNCTION public.plan_y_sello_del_evento(evento uuid)
RETURNS TABLE (plan text, sello text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.plan, c.sello
    FROM events e, LATERAL public.plan_y_sello_de(e.workspace_id, e.user_id) c
   WHERE e.id = evento
$$;

CREATE OR REPLACE FUNCTION public.limite_invitados_del_evento(evento uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.limite_invitados_de_plan(p.plan, p.sello)
    FROM public.plan_y_sello_del_evento(evento) p
$$;

CREATE OR REPLACE FUNCTION public.personas_del_evento(evento uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT ((SELECT count(*) FROM guests g        WHERE g.event_id = evento)
        + (SELECT count(*) FROM party_members m WHERE m.event_id = evento))::int
$$;

-- Solo actua cuando hay sesion de navegador. El registro por el link publico y
-- las respuestas que llegan por WhatsApp o Telegram entran por servidor, sin
-- auth.uid(), y JAMAS se rechazan: a un invitado no se le tumba su
-- confirmacion por el plan de quien lo invito.
--
-- Una cuenta que ya esta por encima de su tope (hay eventos con 213 personas y
-- tope de 50) no pierde a nadie: el disparador actua sobre lo que ENTRA. Lo
-- que si le pasa es que no puede agregar a nadie mas hasta bajar de 50 o subir
-- de plan — incluido el caso de intercambiar un acompanante por otro, que la
-- interfaz si deja pasar (bloqueaPorTope en lib/invitados/cupo.ts) porque alla
-- se ve la operacion completa y aqui solo se ve la fila que entra.
--
-- HUECO CONOCIDO: es BEFORE INSERT, asi que mover un invitado de un evento a
-- otro con un UPDATE de guests.event_id no pasa por aqui. Ninguna pantalla lo
-- hace; se alcanza solo desde la consola.
--
-- COSTO: cuenta una vez por fila que entra, y ademas el BLOQUE 6 le cuelga a
-- estas dos tablas un SEGUNDO disparador por fila (trg_guests_archivado y
-- trg_party_members_archivado, que miran si el evento sigue editable). O sea
-- dos consultas por fila insertada, no una. Con indice por event_id en guests
-- y party_members las dos son triviales; sin el, la del cupo vuelve cuadratica
-- una importacion grande. El BLOQUE 0-A (B9) dice si estan. Si falta alguno,
-- se crea FUERA de esta transaccion (CONCURRENTLY no corre dentro de una):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS guests_event_id_idx
--     ON public.guests (event_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS party_members_event_id_idx
--     ON public.party_members (event_id);
CREATE OR REPLACE FUNCTION public.invitados_gate_cupo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_lim int; v_personas int;
BEGIN
  IF auth.uid() IS NULL OR NEW.event_id IS NULL THEN RETURN NEW; END IF;

  v_lim := public.limite_invitados_del_evento(NEW.event_id);
  IF v_lim IS NULL THEN RETURN NEW; END IF;

  v_personas := public.personas_del_evento(NEW.event_id) + 1;
  IF v_personas > v_lim THEN
    RAISE EXCEPTION 'INVITADOS_LIMITE:%:%', v_personas, v_lim;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guests_gate_cupo ON public.guests;
CREATE TRIGGER trg_guests_gate_cupo
  BEFORE INSERT ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.invitados_gate_cupo();

DROP TRIGGER IF EXISTS trg_party_members_gate_cupo ON public.party_members;
CREATE TRIGGER trg_party_members_gate_cupo
  BEFORE INSERT ON public.party_members
  FOR EACH ROW EXECUTE FUNCTION public.invitados_gate_cupo();

-- ----------------------------------------------------------------------------
-- PRUEBA OBLIGATORIA, UNA SOLA VEZ, DESPUES DE APLICAR ESTE ARCHIVO
-- ----------------------------------------------------------------------------
-- Esto NO se puede dar por bueno leyendo, y es de lo que depende que el muro
-- exista en el camino principal: el disparador es POR FILA y la importacion de
-- invitados manda TODAS las filas en UNA sola sentencia INSERT. Postgres deja
-- que la fila N vea las filas anteriores de su propia sentencia (plpgsql
-- avanza el contador de comandos antes de cada consulta interna). Si eso no
-- fuera cierto en esta base, personas_del_evento contaria siempre lo de ANTES
-- de la sentencia y una importacion de 300 entraria completa en una cuenta
-- free.
--
-- Como se prueba, en el editor de Supabase. LAS DOS CONDICIONES DEL EVENTO NO
-- SON ADORNO — sin ellas el resultado no dice nada:
--   a) El evento tiene que estar REALMENTE VACIO. Comprobalo, no lo supongas:
--        SELECT public.personas_del_evento('<UUID DEL EVENTO>');  -- debe dar 0
--      Con 45 personas dentro, el error saldria en la fila 6 y no probaria que
--      el disparador ve las filas de su propia sentencia.
--   b) Su tope tiene que existir, o sea plan gratuito y sin sello:
--        SELECT * FROM public.plan_y_sello_del_evento('<UUID DEL EVENTO>');
--        SELECT public.limite_invitados_del_evento('<UUID DEL EVENTO>'); -- 50
--      Si sale NULL (plan de paga o sello), las 60 entran y eso es lo correcto:
--      no habrias probado nada.
--   c) El evento tiene que estar ACTIVO, no archivado:
--        SELECT public.evento_editable('<UUID DEL EVENTO>');  -- debe dar true
--      guests lleva DOS disparadores por fila, y corren en orden alfabetico:
--      trg_guests_archivado va ANTES que trg_guests_gate_cupo. Como la prueba
--      finge una sesion, ese primero tambien evalua, y sobre un evento
--      archivado el error que sale es EVENTO_ARCHIVADO — no el del tope — y
--      pareceria que el muro no sirve. Ojo con esto justo despues de correr
--      este archivo: el BLOQUE 7 acaba de volver 'archived' todo lo que estaba
--      pausado, cancelado o completado, que es el estado tipico de un evento
--      de prueba viejo. Si salio archivado, reactivalo antes:
--        UPDATE events SET event_status = 'active' WHERE id = '<UUID>';
--      (eso consume el lugar de esa cuenta; el muro de eventos puede
--       rechazarlo si ya tiene otro vigente — archiva el otro primero).
-- El editor corre sin auth.uid() y el disparador se salta a proposito, asi que
-- hay que fingir la sesion con set_config; todo va dentro de una transaccion
-- que se deshace al final y no deja rastro:
--
--   BEGIN;
--   SELECT set_config('request.jwt.claims',
--                     '{"sub":"<UUID DEL DUENO DEL EVENTO>","role":"authenticated"}', true);
--   INSERT INTO guests (event_id, name)
--   SELECT '<UUID DEL EVENTO VACIO>', 'Prueba ' || g FROM generate_series(1, 60) g;
--   ROLLBACK;
--
--   (si guests pide alguna columna mas sin default, agregala al INSERT)
--
-- LO ESPERADO: la sentencia falla con
--     ERROR: INVITADOS_LIMITE:51:50
-- y el ROLLBACK no deja nada. Eso significa que el muro SI ve las filas de su
-- propia sentencia, y la importacion queda cubierta.
--
-- SI EN CAMBIO ENTRAN LAS 60 SIN ERROR: el muro no existe para la importacion.
-- El remedio es cambiarlo por un disparador POR SENTENCIA con tabla de
-- transicion, que ve todas las filas de golpe:
--     CREATE TRIGGER trg_guests_gate_cupo AFTER INSERT ON guests
--       REFERENCING NEW TABLE AS nuevas FOR EACH STATEMENT
--       EXECUTE FUNCTION invitados_gate_cupo_por_sentencia();
-- con una funcion que recorra `SELECT DISTINCT event_id FROM nuevas` aplicando
-- el mismo limite. No se deja escrita aqui para no dejar dos caminos vivos: se
-- escribe si la prueba lo pide.


-- ============================================================================
-- BLOQUE 4 — LA FUNCION QUE LA INTERFAZ CONSULTA
-- ============================================================================
-- plan_del_evento ya existia (2026-09-08-workspace-cimiento.sql) y devolvia
-- solo el plan del workspace del evento, con 'free' por omision.
--
-- Se extiende sin romper a quien ya la consume:
--   - SIGUE devolviendo text. lib/workspace/cliente.ts comprueba
--     `typeof data === 'string'`: cambiarle el tipo de regreso la dejaria
--     ciega en silencio y, de paso, CREATE OR REPLACE ni siquiera lo permite.
--   - Gana la misma caida en cascada de los otros bloques (workspace del
--     evento -> workspace propio del dueno -> users.plan -> free).
--   - El plan y el SELLO juntos salen por plan_y_sello_del_evento: es la que
--     resuelve que las policies de workspaces no dejen a un colaborador leer
--     esa fila. Mientras la interfaz no la llame, un colaborador de una
--     partner fundadora simplemente no ve tope en pantalla
--     (resolverLimiteInvitados devuelve null cuando no pudo comprobar el plan)
--     y el disparador del BLOQUE 3, que si lee el sello, lo deja pasar. Nadie
--     queda topado de mas.
--   - Un extrano ya no aprende nada: fuera del evento devuelve NULL.
CREATE OR REPLACE FUNCTION public.plan_del_evento(evento uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_plan text; v_ws uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_event_member(evento) THEN
    SELECT e.workspace_id INTO v_ws FROM events e WHERE e.id = evento;
    IF v_ws IS NULL OR NOT public.es_admin_de(v_ws) THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT p.plan INTO v_plan FROM public.plan_y_sello_del_evento(evento) p;
  RETURN coalesce(v_plan, 'free');
END $$;

-- LOS PERMISOS DE EJECUCION NO VAN AQUI: van al final, despues del BLOQUE 6.
-- REVOKE EXECUTE ON FUNCTION no tiene IF EXISTS, y cuatro de las diecisiete
-- funciones nacen hasta los BLOQUES 5 y 6 (guard_cliente_sin_total,
-- evento_editable, bloquea_evento_archivado, bloquea_pago_archivado):
-- revocarlas aqui abortaria la transaccion entera con "la funcion no existe".
-- Se cierran cuando las diecisiete ya existen. Nada de los BLOQUES 5, 6 y 7
-- depende de esos permisos.


-- ============================================================================
-- BLOQUE 5 — UN CLIENTE POR EVENTO
-- ============================================================================
-- Hoy las dos reglas viven solo en la interfaz y se brincan desde la consola
-- del navegador. El indice unico parcial cuenta igual que validarCliente en
-- lib/workspace/invitacion.ts: un cliente VIVO es el que no esta 'revoked'
-- (pendiente tambien ocupa lugar).
CREATE UNIQUE INDEX IF NOT EXISTS event_collaborators_un_cliente_vivo
  ON public.event_collaborators (event_id)
  WHERE tipo = 'cliente' AND coalesce(status, 'pending') <> 'revoked';

-- El cliente nunca llega a 'total'. Igual que topeDeCliente() en
-- lib/workspace/invitacion.ts, no se rechaza la escritura: se recorta a
-- 'editar', porque la intencion era darle acceso, no dejarlo fuera.
-- Corre siempre, con sesion o sin ella: no rechaza nada, normaliza. Las dos
-- puertas del servidor ya aplican la misma regla antes de escribir.
-- Solo toca los valores que son EXACTAMENTE el texto "total"; cualquier otro
-- valor del jsonb se copia tal cual, sin aplanarlo a texto.
-- NO toca la columna legada `role`: el runtime resuelve el acceso con
-- `permisos` (nivel_en / nivelEfectivo), no con ella.
CREATE OR REPLACE FUNCTION public.guard_cliente_sin_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tipo = 'cliente'
     AND NEW.permisos IS NOT NULL
     AND jsonb_typeof(NEW.permisos) = 'object'
     AND EXISTS (SELECT 1 FROM jsonb_each(NEW.permisos) e WHERE e.value = '"total"'::jsonb) THEN
    NEW.permisos := (
      SELECT jsonb_object_agg(e.key,
               CASE WHEN e.value = '"total"'::jsonb THEN '"editar"'::jsonb ELSE e.value END)
        FROM jsonb_each(NEW.permisos) e
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_cliente_sin_total ON public.event_collaborators;
CREATE TRIGGER guard_cliente_sin_total
  BEFORE INSERT OR UPDATE ON public.event_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.guard_cliente_sin_total();


-- ============================================================================
-- BLOQUE 6 — EVENTO ARCHIVADO = SOLO LECTURA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.evento_editable(p_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT coalesce(event_status, 'active') = 'active' FROM events WHERE id = p_event_id;
$$;

-- Rechaza escrituras de un usuario logueado sobre un evento archivado. Lo que
-- entra por servidor o por link publico (RSVP de WhatsApp/Telegram, registro
-- publico, reserva de mesa de regalos, opinion del cliente, aceptar una
-- invitacion de colaborador) NO trae auth.uid() y pasa siempre.
CREATE OR REPLACE FUNCTION public.bloquea_evento_archivado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_row jsonb; v_event uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN v_row := to_jsonb(OLD); ELSE v_row := to_jsonb(NEW); END IF;
  v_event := (v_row->>'event_id')::uuid;

  IF v_event IS NOT NULL AND NOT public.evento_editable(v_event) THEN
    RAISE EXCEPTION 'EVENTO_ARCHIVADO';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

-- QUE ENTRA Y QUE NO:
--   - Las 14 tablas de abajo cuelgan directo de event_id (el BLOQUE 0-B lo
--     verifica una por una y aborta si alguna no, distinguiendo "la tabla no
--     existe" de "existe pero no tiene event_id").
--   - supplier_payments no tiene event_id: se resuelve con un join, abajo.
--   - gift_reservations SI tiene event_id (columna NOT NULL desde ANF-049),
--     asi que entra a la lista generica y no necesita join.
--   - HUECOS CONOCIDOS, fuera a proposito (el BLOQUE 0-A, en B8, saca a la luz
--     cualquier tabla con event_id que no este ni aqui ni en esta lista, para
--     que "hueco conocido" se demuestre en vez de afirmarse):
--       * event_audit_log — la bitacora tiene que poder seguir registrando lo
--         que pasa en un evento archivado, incluido su archivado.
--       * conversations, messages, channel_participants, wa_messages — el
--         nucleo omnicanal. Casi todo lo escribe el servidor (pasaria igual),
--         y lo poco que escribe el navegador no vale el riesgo de partirle el
--         hilo al agente. Un evento archivado no se muestra en la app, asi que
--         hoy esto solo se alcanza a proposito.
--       * suppliers y categories — no tienen event_id: son del despacho, se
--         comparten entre eventos y no se congelan con uno.
--
-- El loop toma ACCESS EXCLUSIVE sobre las 14 tablas y lo retiene hasta el
-- commit. El lock_timeout puesto arriba, justo despues del BEGIN, hace que
-- falle rapido en vez de encolar la app entera detras de una consulta larga.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'guests','party_members','tables','table_seats','event_budgets',
    'event_suppliers','event_timeline_tasks','event_itinerary_moments',
    'event_settings','song_recommendations','gift_registry_items',
    'gift_reservations','event_collaborators','supplier_reviews'
  ] LOOP
    EXECUTE format('drop trigger if exists trg_%s_archivado on public.%I', t, t);
    EXECUTE format(
      'create trigger trg_%s_archivado before insert or update or delete on public.%I
         for each row execute function public.bloquea_evento_archivado()', t, t);
  END LOOP;
END $$;

-- supplier_payments cuelga del proveedor del evento, no del evento.
CREATE OR REPLACE FUNCTION public.bloquea_pago_archivado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_supplier uuid; v_event uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN v_supplier := OLD.event_supplier_id;
  ELSE v_supplier := NEW.event_supplier_id; END IF;

  SELECT event_id INTO v_event FROM event_suppliers WHERE id = v_supplier;
  IF v_event IS NOT NULL AND NOT public.evento_editable(v_event) THEN
    RAISE EXCEPTION 'EVENTO_ARCHIVADO';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

DROP TRIGGER IF EXISTS trg_supplier_payments_archivado ON public.supplier_payments;
CREATE TRIGGER trg_supplier_payments_archivado
  BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.bloquea_pago_archivado();


-- ============================================================================
-- PERMISOS DE EJECUCION — LEER ANTES DE TOCAR
-- ============================================================================
-- Va AQUI, al final, y no junto a cada funcion: REVOKE EXECUTE ON FUNCTION no
-- tiene IF EXISTS, asi que todas las que nombra tienen que existir ya. En este
-- punto existen las diecisiete.
--
-- En Postgres toda funcion nace ejecutable por PUBLIC, y Supabase ademas tiene
-- default privileges que se la otorgan a anon y authenticated. Como Supabase
-- publica cada funcion de `public` como endpoint, una funcion nueva sin cerrar
-- es una puerta abierta: personas_del_evento, plan_y_sello_de_cuenta,
-- eventos_vigentes_de, limite_invitados_del_evento y evento_editable
-- contestarian de cualquier evento o cuenta a quien no tiene ni sesion, que es
-- justo el hueco que acaba de cerrar la auditoria de seguridad.
-- Por eso se cierran TODAS, y luego se abre solo lo que la app llama.
REVOKE EXECUTE ON FUNCTION
  public.limite_eventos_de_plan(text, text),
  public.limite_invitados_de_plan(text, text),
  public.plan_y_sello_de(uuid, uuid),
  public.plan_y_sello_de_cuenta(uuid),
  public.plan_y_sello_del_evento(uuid),
  public.limite_invitados_del_evento(uuid),
  public.personas_del_evento(uuid),
  public.eventos_vigentes_de(uuid),
  public.evento_editable(uuid),
  public.get_account_capacity(uuid),
  public.plan_del_evento(uuid)
FROM PUBLIC, anon, authenticated;

-- Las funciones de disparador no se llaman por RPC (Postgres solo revisa el
-- permiso al CREAR el disparador, no al dispararlo), pero se cierran igual.
REVOKE EXECUTE ON FUNCTION
  public.guard_workspace_sello(),
  public.events_gate_cupo(),
  public.invitados_gate_cupo(),
  public.guard_cliente_sin_total(),
  public.bloquea_evento_archivado(),
  public.bloquea_pago_archivado()
FROM PUBLIC, anon, authenticated;

-- Lo unico que se vuelve a abrir, y por que:
--
-- docs/superpowers/plans/sql/2026-09-14-seguridad-1a-cerrar-ya.sql le quito a
-- `authenticated` el permiso de ejecutar get_account_capacity y
-- plan_del_evento, con razon: eran SECURITY DEFINER que recibian el id de
-- cualquiera y contestaban sin preguntar quien llamaba.
--
-- El codigo que se acaba de desplegar las NECESITA desde el navegador:
-- NewEventModal y configuracion llaman get_account_capacity para avisar antes
-- de intentar, y el contador de invitados llama plan_del_evento. Sin estos dos
-- GRANT las dos pantallas siguen funcionando, pero pierden el aviso previo: el
-- usuario se entera hasta que el disparador lo rechaza.
--
-- Por eso se vuelven a otorgar, pero YA NO son las mismas funciones: las dos
-- traen adentro la pregunta que les faltaba (¿eres tu?, ¿eres del evento?,
-- ¿lo administras?) y contestan vacio a quien no. El hueco que cerro la
-- auditoria sigue cerrado; lo que vuelve es el uso legitimo.
--
-- Si prefieres no reabrirlos: estos dos GRANT se pueden saltar sin tocar nada
-- mas. Los muros no dependen de ellos.
GRANT EXECUTE ON FUNCTION public.get_account_capacity(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_del_evento(uuid)      TO authenticated, service_role;

-- plan_y_sello_del_evento NO se le da a authenticated: hoy no la llama nadie
-- desde el navegador, y abierta dejaria leer el plan y el sello de cualquier
-- evento por la puerta de al lado. Cuando la interfaz la use, se le pone la
-- misma pregunta de adentro que trae plan_del_evento y entonces se otorga.
GRANT EXECUTE ON FUNCTION public.plan_y_sello_del_evento(uuid) TO service_role;


-- ============================================================================
-- BLOQUE 7 — LA MIGRACION DE ESTATUS
-- ============================================================================
-- Va al final, ya con todo lo demas puesto. Ningun dato se pierde: archivado
-- conserva todo y se puede reactivar (y reactivar vuelve a pedir lugar, que es
-- justo lo que hace el gate del BLOQUE 2).
-- Para deshacerla evento por evento hace falta la lista B4 del BLOQUE 0-A:
-- guardala antes de correr esto.
-- Esta misma sentencia dispara trg_events_gate_cupo, que la deja pasar sin
-- mirar nada porque el estatus que queda no es 'active'.
UPDATE events SET event_status = 'archived'
 WHERE coalesce(event_status, 'active') NOT IN ('active', 'archived');

COMMIT;


-- ============================================================================
-- VERIFICACION (CORRER DESPUES, SOLO LECTURA)
-- ============================================================================
SELECT 'V1 columnas del sello' AS chequeo,
  (SELECT string_agg(column_name || ':' || data_type, ', ' ORDER BY column_name)
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces'
      AND column_name IN ('sello', 'sello_desde')) AS resultado
UNION ALL
SELECT 'V2 checks de workspaces (plan con studio + sello)',
  (SELECT string_agg(conname, ', ' ORDER BY conname) FROM pg_constraint
    WHERE conrelid = 'public.workspaces'::regclass AND contype = 'c')
UNION ALL
SELECT 'V3 disparadores nuevos',
  (SELECT string_agg(t.tgname, ', ' ORDER BY t.tgname) FROM pg_trigger t
    WHERE NOT t.tgisinternal
      AND t.tgname IN ('guard_workspace_sello','trg_events_gate_cupo','trg_guests_gate_cupo',
                       'trg_party_members_gate_cupo','guard_cliente_sin_total',
                       'trg_supplier_payments_archivado'))
UNION ALL
SELECT 'V4 tablas con el candado de archivado (esperado: 14)',
  (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'trg_%_archivado'
     AND tgname <> 'trg_supplier_payments_archivado')
UNION ALL
SELECT 'V5 indice de un cliente por evento',
  (SELECT coalesce(string_agg(indexname, ', '), 'NO EXISTE') FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'event_collaborators_un_cliente_vivo')
UNION ALL
SELECT 'V6 estatus de eventos (esperado: solo active y archived)',
  (SELECT string_agg(s || '=' || n, ', ' ORDER BY s) FROM (
     SELECT coalesce(event_status,'active') AS s, count(*) AS n FROM events GROUP BY 1) x)
UNION ALL
SELECT 'V7 limites del catalogo (free / pro / free con sello)',
  (SELECT public.limite_eventos_de_plan('free', NULL)::text || ' evento, ' ||
          coalesce(public.limite_eventos_de_plan('pro', NULL)::text, 'sin limite') || ', ' ||
          coalesce(public.limite_eventos_de_plan('free', 'fundador')::text, 'sin limite') ||
          ' | invitados: ' || public.limite_invitados_de_plan('free', NULL)::text || ', ' ||
          coalesce(public.limite_invitados_de_plan('free', 'fundador')::text, 'sin limite'))
UNION ALL
SELECT 'V8 fundadores con sello (tope 25)',
  (SELECT count(*)::text FROM workspaces WHERE sello = 'fundador')
UNION ALL
SELECT 'V9 funciones de este archivo que anon puede ejecutar (esperado: ninguna)',
  (SELECT coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), 'ninguna')
     FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('limite_eventos_de_plan','limite_invitados_de_plan','plan_y_sello_de',
                        'plan_y_sello_de_cuenta','plan_y_sello_del_evento','limite_invitados_del_evento',
                        'personas_del_evento','eventos_vigentes_de','evento_editable',
                        'get_account_capacity','plan_del_evento','guard_workspace_sello',
                        'events_gate_cupo','invitados_gate_cupo','guard_cliente_sin_total',
                        'bloquea_evento_archivado','bloquea_pago_archivado')
      AND has_function_privilege('anon', p.oid, 'EXECUTE'))
UNION ALL
SELECT 'V10 las que authenticated puede ejecutar (esperado: solo las dos)',
  (SELECT coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), 'ninguna')
     FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('limite_eventos_de_plan','limite_invitados_de_plan','plan_y_sello_de',
                        'plan_y_sello_de_cuenta','plan_y_sello_del_evento','limite_invitados_del_evento',
                        'personas_del_evento','eventos_vigentes_de','evento_editable',
                        'get_account_capacity','plan_del_evento','guard_workspace_sello',
                        'events_gate_cupo','invitados_gate_cupo','guard_cliente_sin_total',
                        'bloquea_evento_archivado','bloquea_pago_archivado')
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE'))
UNION ALL
SELECT 'V11 clientes que todavia traen algun total',
  (SELECT count(*)::text FROM event_collaborators c
    WHERE c.tipo = 'cliente' AND c.permisos IS NOT NULL AND jsonb_typeof(c.permisos) = 'object'
      AND EXISTS (SELECT 1 FROM jsonb_each(c.permisos) e WHERE e.value = '"total"'::jsonb));
-- Esperado: V1 las dos columnas, V2 workspaces_plan_valido y
-- workspaces_sello_valido, V3 los seis disparadores, V4 catorce, V5 el indice,
-- V6 solo active y archived, V7 "1 evento, sin limite, sin limite | invitados:
-- 50, sin limite", V8 los que tu hayas puesto, V9 NINGUNA, V10 exactamente
-- get_account_capacity y plan_del_evento, V11 los clientes viejos que nadie ha
-- vuelto a guardar (el disparador solo los limpia cuando se escriben; este
-- archivo no toca datos de nadie).
--
-- Y falta la PRUEBA OBLIGATORIA del BLOQUE 3 (los 60 invitados de un jalon).


-- ============================================================================
-- REVERTIR (SOLO SI ALGO SE ROMPE)
-- ============================================================================
-- Va en transaccion, como el archivo. OJO con lo que esta reversa NO hace:
--   - NO restaura el texto anterior de get_account_capacity, plan_del_evento
--     ni evento_editable: quedan con el cuerpo nuevo, que es compatible con lo
--     que la app consume. Si de verdad hace falta el viejo, esta en git:
--     supabase/2026-08-19-muro-eventos.sql, en el commit anterior al que lo
--     borro (git show <commit>^:supabase/2026-08-19-muro-eventos.sql).
--   - NO revierte la migracion de estatus. 'paused', 'cancelled' y 'completed'
--     ya no existen en el codigo desplegado (EventStatus en lib/types.ts es
--     'active' | 'archived'), asi que devolverlos dejaria filas que la app no
--     sabe pintar. Si aun asi hace falta, se hace evento por evento con la
--     lista B4 que guardaste del BLOQUE 0-A.
--   - NO devuelve el CHECK viejo de planes, el de tres valores: reponerlo
--     revienta si para entonces ya hay alguien en Studio, y al tirar el de
--     cuatro primero la tabla se quedaria sin ningun candado de plan. El de
--     cuatro valores es correcto con o sin muros: se queda.
--
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
--
-- -- Muro de eventos:
-- DROP TRIGGER IF EXISTS trg_events_gate_cupo ON public.events;
--
-- -- Muro de invitados:
-- DROP TRIGGER IF EXISTS trg_guests_gate_cupo ON public.guests;
-- DROP TRIGGER IF EXISTS trg_party_members_gate_cupo ON public.party_members;
--
-- -- Solo lectura del evento archivado (las 14 hijas + pagos):
-- DO $x$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'guests','party_members','tables','table_seats','event_budgets',
--     'event_suppliers','event_timeline_tasks','event_itinerary_moments',
--     'event_settings','song_recommendations','gift_registry_items',
--     'gift_reservations','event_collaborators','supplier_reviews'
--   ] LOOP
--     EXECUTE format('drop trigger if exists trg_%s_archivado on public.%I', t, t);
--   END LOOP;
-- END $x$;
-- DROP TRIGGER IF EXISTS trg_supplier_payments_archivado ON public.supplier_payments;
--
-- -- Sello (el candado; las columnas se pueden dejar, son inertes):
-- DROP TRIGGER IF EXISTS guard_workspace_sello ON public.workspaces;
-- -- Y si estorba el dato: UPDATE workspaces SET sello = NULL, sello_desde = NULL;
--
-- -- Un cliente por evento:
-- DROP INDEX IF EXISTS public.event_collaborators_un_cliente_vivo;
-- DROP TRIGGER IF EXISTS guard_cliente_sin_total ON public.event_collaborators;
--
-- -- Los permisos que este archivo otorgo, como los dejo la auditoria del 14-sep:
-- REVOKE EXECUTE ON FUNCTION public.get_account_capacity(uuid), public.plan_del_evento(uuid)
--   FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.plan_y_sello_del_evento(uuid) FROM service_role;
--
-- COMMIT;
--
-- HASTA AQUI LA REVERSA NORMAL. Con esto los muros desaparecen y las funciones
-- se quedan puestas, inertes: no estorban, no cuestan y las dos que la app
-- llama (get_account_capacity y plan_del_evento) siguen contestando bien.
--
-- ---------------------------------------------------------------------------
-- BORRAR ADEMAS LAS FUNCIONES: SOLO SI SABES ESTO
-- ---------------------------------------------------------------------------
-- get_account_capacity y plan_del_evento se quedan con el cuerpo NUEVO, y ese
-- cuerpo llama a cinco de las funciones de abajo:
--     get_account_capacity -> plan_y_sello_de_cuenta -> plan_y_sello_de
--                             limite_eventos_de_plan, eventos_vigentes_de
--     plan_del_evento      -> plan_y_sello_del_evento -> plan_y_sello_de
-- Borrarlas deja esas DOS LLAMADAS DE LA APP TIRANDO ERROR (el cuerpo es
-- plpgsql: no se queja al borrar, se queja al ejecutar). Hay dos caminos
-- limpios:
--   A. No borrar esas cinco. Es lo recomendado: son inertes.
--   B. Restaurar primero los cuerpos viejos desde git
--      (git show <commit>^:supabase/2026-08-19-muro-eventos.sql) y despues
--      borrarlas. Ojo: el cuerpo viejo de get_account_capacity trae el catalogo
--      de agosto, con planes que ya no existen.
--
-- Las que se pueden borrar sin romper nada una vez tirados sus disparadores:
-- DROP FUNCTION IF EXISTS public.limite_invitados_del_evento(uuid);
-- DROP FUNCTION IF EXISTS public.limite_invitados_de_plan(text, text);
-- DROP FUNCTION IF EXISTS public.personas_del_evento(uuid);
-- DROP FUNCTION IF EXISTS public.evento_editable(uuid);
-- DROP FUNCTION IF EXISTS public.events_gate_cupo();
-- DROP FUNCTION IF EXISTS public.invitados_gate_cupo();
-- DROP FUNCTION IF EXISTS public.guard_workspace_sello();
-- DROP FUNCTION IF EXISTS public.guard_cliente_sin_total();
-- DROP FUNCTION IF EXISTS public.bloquea_evento_archivado();
-- DROP FUNCTION IF EXISTS public.bloquea_pago_archivado();
--
-- Y estas cinco SOLO por el camino B:
-- DROP FUNCTION IF EXISTS public.plan_y_sello_del_evento(uuid);
-- DROP FUNCTION IF EXISTS public.plan_y_sello_de_cuenta(uuid);
-- DROP FUNCTION IF EXISTS public.plan_y_sello_de(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.limite_eventos_de_plan(text, text);
-- DROP FUNCTION IF EXISTS public.eventos_vigentes_de(uuid);
