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
-- se conserva aqui, actualizado.
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
--   1. El BLOQUE 0-A solo, primero. Es de solo lectura, no cambia nada, y
--      dice el tamano exacto del cambio. Leerlo antes de seguir.
--   2. Todo lo demas de un jalon, desde BEGIN hasta COMMIT. Si un candado del
--      BLOQUE 0-B falla, aborta SIN CAMBIAR NADA.
--   3. La verificacion del final, tambien sola. Es de solo lectura.
--
-- OTRO AGENTE ESTA TRABAJANDO LA AUDITORIA DE SEGURIDAD en esta misma base
-- (archivos docs/superpowers/plans/sql/2026-09-1x-seguridad-*.sql). Este
-- archivo NO reescribe nada de lo suyo: ni guard_users_plan, ni
-- guard_event_config, ni sus policies. Lo unico que toca de su terreno son dos
-- GRANT del BLOQUE 4, explicados ahi con su motivo.
-- ============================================================================


-- ============================================================================
-- BLOQUE 0-A — RADIOGRAFIA (CORRER SOLO, ANTES. SOLO LECTURA)
-- ============================================================================
-- Todavia no existe workspaces.sello, asi que aqui nadie tiene sello y el
-- catalogo se lee de workspaces.plan con caida a users.plan. Los numeros son
-- el tamano real del cambio: cuantos eventos se migran, cuantas cuentas
-- quedan por encima de su tope (no se les quita nada: el muro actua sobre lo
-- que entra, no sobre lo que ya entro) y que estorba.
WITH plan_de AS (
  SELECT u.id AS user_id, lower(coalesce(w.plan, u.plan, 'free')) AS plan
    FROM users u
    LEFT JOIN workspaces w ON w.primary_owner_id = u.id
),
personas AS (
  SELECT e.id, e.user_id,
         (SELECT count(*) FROM guests g        WHERE g.event_id  = e.id)
       + (SELECT count(*) FROM party_members m WHERE m.event_id  = e.id) AS personas
    FROM events e
),
vigentes AS (
  SELECT e.user_id, count(*) AS n
    FROM events e
   WHERE coalesce(e.event_status,'active') = 'active'
     AND (coalesce(e.event_end_date, e.event_date) IS NULL
          OR coalesce(e.event_end_date, e.event_date) >= current_date)
   GROUP BY e.user_id
),
hijas AS (
  SELECT unnest(ARRAY[
    'guests','party_members','tables','table_seats','event_budgets',
    'event_suppliers','event_timeline_tasks','event_itinerary_moments',
    'event_settings','song_recommendations','gift_registry_items',
    'gift_reservations','event_collaborators','supplier_reviews'
  ]) AS t
)
SELECT jsonb_pretty(jsonb_build_object(

  'eventos_por_estatus_hoy',
    (SELECT jsonb_object_agg(s, n) FROM (
       SELECT coalesce(event_status,'active') AS s, count(*) AS n FROM events GROUP BY 1) x),

  'eventos_que_el_bloque_7_migra_a_archived',
    (SELECT count(*) FROM events WHERE coalesce(event_status,'active') NOT IN ('active','archived')),

  'check_de_event_status_que_impide_archived_ABORTA',
    (SELECT coalesce(string_agg(conname || ' => ' || pg_get_constraintdef(oid), ' | '), 'ninguno')
       FROM pg_constraint
      WHERE conrelid = 'public.events'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%event_status%'
        AND pg_get_constraintdef(oid) NOT ILIKE '%archived%'),

  'check_de_workspaces_plan_hoy',
    (SELECT coalesce(string_agg(pg_get_constraintdef(oid), ' | '), 'ninguno')
       FROM pg_constraint
      WHERE conrelid = 'public.workspaces'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%plan%'),

  'check_de_users_plan_hoy_SIN_STUDIO_ES_PROBLEMA',
    (SELECT coalesce(string_agg(pg_get_constraintdef(oid), ' | '), 'ninguno')
       FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%plan%'),

  'planes_en_workspaces_fuera_del_catalogo_ABORTA',
    (SELECT coalesce(string_agg(DISTINCT plan, ', '), 'ninguno') FROM workspaces
      WHERE plan IS NOT NULL AND plan NOT IN ('free','pro','studio','agency')),

  'cuentas_con_mas_de_un_evento_vigente',
    (SELECT count(*) FROM vigentes v JOIN plan_de p ON p.user_id = v.user_id
      WHERE p.plan = 'free' AND v.n > 1),

  'eventos_vigentes_de_esas_cuentas',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('cuenta', u.email, 'vigentes', v.n)), '[]'::jsonb)
       FROM vigentes v JOIN plan_de p ON p.user_id = v.user_id JOIN users u ON u.id = v.user_id
      WHERE p.plan = 'free' AND v.n > 1),

  'eventos_free_ya_arriba_del_tope_de_50_personas',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('cuenta', u.email, 'personas', pe.personas) ORDER BY pe.personas DESC), '[]'::jsonb)
       FROM personas pe JOIN plan_de p ON p.user_id = pe.user_id JOIN users u ON u.id = pe.user_id
      WHERE p.plan = 'free' AND pe.personas > 50),

  'eventos_con_dos_o_mas_clientes_vivos_ABORTA',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('event_id', t.event_id, 'clientes', t.n)), '[]'::jsonb)
       FROM (SELECT c.event_id, count(*) AS n FROM event_collaborators c
              WHERE c.tipo = 'cliente' AND coalesce(c.status,'pending') <> 'revoked'
              GROUP BY c.event_id HAVING count(*) > 1) t),

  'clientes_con_algun_modulo_en_total_hoy',
    (SELECT count(*) FROM event_collaborators c
      WHERE c.tipo = 'cliente' AND c.permisos IS NOT NULL
        AND jsonb_typeof(c.permisos) = 'object'
        AND EXISTS (SELECT 1 FROM jsonb_each_text(c.permisos) e WHERE e.value = 'total')),

  'tablas_hijas_sin_columna_event_id_ABORTA',
    (SELECT coalesce(string_agg(h.t, ', '), 'ninguna') FROM hijas h
      WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                         WHERE c.table_schema = 'public' AND c.table_name = h.t
                           AND c.column_name = 'event_id')),

  'funciones_que_este_archivo_da_por_hechas_ABORTA_SI_FALTA',
    (SELECT coalesce(jsonb_object_agg(f, existe), '{}'::jsonb) FROM (
       SELECT f, EXISTS (SELECT 1 FROM pg_proc p
                          WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f) AS existe
         FROM unnest(ARRAY['is_event_member','es_admin_de','plan_del_evento','asegurar_workspace']) AS f) y),

  'indices_por_event_id_que_el_muro_de_invitados_va_a_usar',
    (SELECT coalesce(string_agg(indexname, ', '), 'ninguno') FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('guests','party_members')
        AND indexdef ILIKE '%event_id%')

)) AS radiografia;


-- ============================================================================
-- DE AQUI AL COMMIT, DE UN JALON
-- ============================================================================
BEGIN;

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

  -- 2. Columnas que este archivo da por hechas.
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

  -- 3. Funciones de otros tramos que este archivo LLAMA (no redefine).
  SELECT string_agg(f, ', ') INTO faltan
    FROM unnest(ARRAY['is_event_member','es_admin_de']) AS f
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p
                      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f);
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: faltan funciones del tramo de accesos: %. Correr antes 2026-09-05-accesos-timeline-cimiento.sql y 2026-09-08-workspace-cimiento.sql', faltan;
  END IF;

  -- 4. Las tablas hijas del BLOQUE 6 tienen que colgar de event_id. Si alguna
  --    no lo trae, se saca de la lista del BLOQUE 6 a mano y se anota como
  --    hueco conocido; NO se finge que quedo cerrada.
  SELECT string_agg(h.t, ', ') INTO faltan
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
    RAISE EXCEPTION 'ABORTA: estas tablas del BLOQUE 6 no tienen event_id: %. Sacarlas de la lista y anotarlas como hueco', faltan;
  END IF;

  -- 5. El catalogo nuevo tiene cuatro planes. Si alguna fila trae otro valor,
  --    el CHECK del BLOQUE 1 fallaria a media transaccion.
  SELECT string_agg(DISTINCT plan, ', ') INTO faltan FROM workspaces
   WHERE plan IS NOT NULL AND plan NOT IN ('free','pro','studio','agency');
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: hay workspaces con plan fuera del catalogo: %. Corregirlos antes', faltan;
  END IF;

  -- 6. El indice unico del BLOQUE 5 no se puede crear si ya hay un evento con
  --    dos clientes vivos.
  SELECT string_agg(t.event_id::text, ', ') INTO faltan
    FROM (SELECT c.event_id FROM event_collaborators c
           WHERE c.tipo = 'cliente' AND coalesce(c.status,'pending') <> 'revoked'
           GROUP BY c.event_id HAVING count(*) > 1) t;
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTA: estos eventos ya tienen mas de un cliente vivo: %. Revocar los de mas antes de correr', faltan;
  END IF;
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
-- de verdad y en TypeScript esta la interfaz que se adelanta para avisar
-- antes de intentarlo.
-- ESPEJO: lib/workspace/planes.ts (PLANES[*].eventosActivos e
--         .invitadosPorEvento) y lib/workspace/sello.ts (limiteEventos,
--         limiteInvitados). Si cambias un numero aqui, cambialo alla.
-- NULL = sin limite.

CREATE OR REPLACE FUNCTION public.limite_eventos_de_plan(p_plan text, p_sello text)
RETURNS int LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_sello, '')) = 'fundador'                  THEN NULL::int
    WHEN lower(coalesce(p_plan, 'free')) IN ('pro','studio','agency') THEN NULL::int
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.limite_invitados_de_plan(p_plan text, p_sello text)
RETURNS int LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_sello, '')) = 'fundador'                  THEN NULL::int
    WHEN lower(coalesce(p_plan, 'free')) IN ('pro','studio','agency') THEN NULL::int
    ELSE 50
  END
$$;

-- El plan y el sello de una CUENTA: su workspace propio manda; si no tiene,
-- se cae a users.plan (que /admin sigue escribiendo por compatibilidad) y al
-- final a free.
CREATE OR REPLACE FUNCTION public.plan_y_sello_de_cuenta(p_user_id uuid)
RETURNS TABLE (plan text, sello text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT f.plan, f.sello FROM (
    SELECT w.plan, w.sello, 1 AS orden FROM workspaces w WHERE w.primary_owner_id = p_user_id
    UNION ALL
    SELECT coalesce(u.plan, 'free'), NULL::text, 2 FROM users u WHERE u.id = p_user_id
    UNION ALL
    SELECT 'free', NULL::text, 3
  ) f ORDER BY f.orden LIMIT 1
$$;

-- Un evento VIGENTE es el que esta 'active' y cuyo ultimo dia (la fecha de fin
-- si existe, si no la de inicio) es de hoy en adelante. Sin fecha, cuenta.
-- OJO con la zona horaria: current_date es UTC y Mexico va seis horas atras,
-- asi que un evento que termina "hoy" deja de ocupar lugar a las 18:00 hora
-- de Mexico. Libera antes, nunca bloquea de mas.
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
-- Devuelve CERO FILAS cuando el que pregunta no tiene por que saberlo; la
-- interfaz lo toma como "no pude averiguarlo" y deja pasar (el candado real
-- es el disparador de abajo, no esta funcion).
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

  RETURN QUERY SELECT
    v_active,
    v_lim,
    CASE WHEN v_lim IS NULL THEN NULL ELSE greatest(v_lim - v_active, 0) END,
    CASE WHEN v_lim IS NULL THEN false ELSE v_active >= v_lim END;
END $$;

-- El gate. Actua solo cuando el evento ENTRA a contar: al crearse activo con
-- fecha vigente, al reactivarse, o al mover su fecha de pasada a futura.
-- Editar cualquier otra cosa nunca se bloquea. El lugar lo paga el DUENO del
-- evento (events.user_id), no quien esta guardando.
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

  SELECT c.plan, c.sello INTO v_plan, v_sello FROM public.plan_y_sello_de_cuenta(NEW.user_id) c;
  v_lim := public.limite_eventos_de_plan(v_plan, v_sello);
  IF v_lim IS NULL THEN RETURN NEW; END IF;

  v_active := public.eventos_vigentes_de(NEW.user_id);
  IF v_active >= v_lim THEN
    RAISE EXCEPTION 'EVENT_LIMIT_EXCEEDED:%:%', v_active + 1, v_lim;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_events_gate_cupo ON public.events;
CREATE TRIGGER trg_events_gate_cupo
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_gate_cupo();


-- ============================================================================
-- BLOQUE 3 — EL CUPO DE INVITADOS
-- ============================================================================
-- Se cuentan PERSONAS: filas de guests mas filas de party_members del evento.
-- El tope es el del DUENO del evento, con el sello quitandolo.
-- ESPEJO: contarPersonas() en lib/invitados/cupo.ts.

-- El plan y el sello que gobiernan un EVENTO. Manda el workspace del evento;
-- si no tiene, el workspace propio del dueno; si tampoco, users.plan; al
-- final, free.
CREATE OR REPLACE FUNCTION public.plan_y_sello_del_evento(evento uuid)
RETURNS TABLE (plan text, sello text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH e AS (SELECT ev.user_id, ev.workspace_id FROM events ev WHERE ev.id = evento)
  SELECT f.plan, f.sello FROM (
    SELECT w.plan, w.sello, 1 AS orden FROM workspaces w JOIN e ON w.id = e.workspace_id
    UNION ALL
    SELECT w.plan, w.sello, 2 FROM workspaces w JOIN e ON w.primary_owner_id = e.user_id
    UNION ALL
    SELECT coalesce(u.plan, 'free'), NULL::text, 3 FROM users u JOIN e ON u.id = e.user_id
    UNION ALL
    SELECT 'free', NULL::text, 4
  ) f ORDER BY f.orden LIMIT 1
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
-- interfaz si deja pasar (bloqueaPorTope en lib/invitados/cupo.ts) porque
-- alla se ve la operacion completa y aqui solo se ve la fila que entra.
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
--   - Gana la misma caida en cascada del BLOQUE 3 (workspace del evento ->
--     workspace propio del dueno -> users.plan -> free).
--   - El plan y el SELLO juntos salen por plan_y_sello_del_evento, creada
--     arriba: es la que resuelve el problema de que las policies de workspaces
--     no dejan a un colaborador leer esa fila. Mientras la interfaz no la
--     llame, un colaborador de una partner fundadora simplemente no ve tope en
--     pantalla (resolverLimiteInvitados devuelve null cuando no pudo
--     comprobar el plan) y el disparador del BLOQUE 3, que si lee el sello,
--     lo deja pasar. Nadie queda topado de mas.
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

-- ---------------------------------------------------------------------------
-- PERMISOS DE EJECUCION — TERRENO DE LA AUDITORIA DE SEGURIDAD, LEER ANTES
-- ---------------------------------------------------------------------------
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
REVOKE EXECUTE ON FUNCTION public.get_account_capacity(uuid)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_del_evento(uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_y_sello_del_evento(uuid)   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_account_capacity(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_del_evento(uuid)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_y_sello_del_evento(uuid)  TO authenticated, service_role;

-- Las demas funciones de este archivo solo las usan los disparadores (que
-- corren como su dueno) y otras funciones SECURITY DEFINER. No se les revoca
-- nada a `authenticated`: una policy de RLS que llame a cualquiera de estas se
-- evalua con el rol del usuario y se romperia entera.


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
-- NO toca la columna legada `role`: el runtime resuelve el acceso con
-- `permisos` (nivel_en / nivelEfectivo), no con ella.
CREATE OR REPLACE FUNCTION public.guard_cliente_sin_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tipo = 'cliente'
     AND NEW.permisos IS NOT NULL
     AND jsonb_typeof(NEW.permisos) = 'object'
     AND EXISTS (SELECT 1 FROM jsonb_each_text(NEW.permisos) e WHERE e.value = 'total') THEN
    NEW.permisos := (
      SELECT coalesce(jsonb_object_agg(e.key,
               to_jsonb(CASE WHEN e.value = 'total' THEN 'editar' ELSE e.value END)), '{}'::jsonb)
        FROM jsonb_each_text(NEW.permisos) e
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
--     verifica una por una y aborta si alguna no).
--   - supplier_payments no tiene event_id: se resuelve con un join, abajo.
--   - gift_reservations SI tiene event_id (columna NOT NULL desde ANF-049),
--     asi que entra a la lista generica y no necesita join.
--   - HUECOS CONOCIDOS, fuera a proposito:
--       * event_audit_log — la bitacora tiene que poder seguir registrando lo
--         que pasa en un evento archivado, incluido su archivado.
--       * conversations, messages, channel_participants, wa_messages — el
--         nucleo omnicanal. Casi todo lo escribe el servidor (pasaria igual),
--         y lo poco que escribe el navegador no vale el riesgo de partirle el
--         hilo al agente. Un evento archivado no se muestra en la app, asi que
--         hoy esto solo se alcanza a proposito.
--       * suppliers y categories — son del despacho, no del evento: se
--         comparten entre eventos y no se congelan con uno.
--
-- El loop toma ACCESS EXCLUSIVE sobre las 14 tablas y lo retiene hasta el
-- commit. Con lock_timeout falla rapido en vez de encolar la app entera detras
-- de una consulta larga; el remedio es volver a correr el archivo, que es
-- idempotente.
SET LOCAL lock_timeout = '5s';
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
-- BLOQUE 7 — LA MIGRACION DE ESTATUS
-- ============================================================================
-- Van al final, ya con todo lo demas puesto. Ningun dato se pierde: archivado
-- conserva todo y se puede reactivar (y reactivar vuelve a pedir lugar, que es
-- justo lo que hace el gate del BLOQUE 2).
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
SELECT 'V9 permisos de ejecucion (auth / anon)',
  (SELECT 'get_account_capacity ' || has_function_privilege('authenticated','public.get_account_capacity(uuid)','EXECUTE')::text ||
          '/' || has_function_privilege('anon','public.get_account_capacity(uuid)','EXECUTE')::text ||
          ' | plan_del_evento ' || has_function_privilege('authenticated','public.plan_del_evento(uuid)','EXECUTE')::text ||
          '/' || has_function_privilege('anon','public.plan_del_evento(uuid)','EXECUTE')::text)
UNION ALL
SELECT 'V10 clientes que todavia traen algun total (esperado: 0 al editarlos)',
  (SELECT count(*)::text FROM event_collaborators c
    WHERE c.tipo = 'cliente' AND c.permisos IS NOT NULL AND jsonb_typeof(c.permisos) = 'object'
      AND EXISTS (SELECT 1 FROM jsonb_each_text(c.permisos) e WHERE e.value = 'total'));
-- Esperado: V1 las dos columnas, V2 workspaces_plan_valido y
-- workspaces_sello_valido, V3 los seis disparadores, V4 catorce, V5 el
-- indice, V6 solo active y archived, V7 "1 evento, sin limite, sin limite |
-- invitados: 50, sin limite", V8 los que tu hayas puesto, V9 authenticated
-- true y anon false en las dos, V10 los clientes viejos que nadie ha vuelto a
-- guardar (el disparador solo los limpia cuando se escriben; no se tocan
-- datos a mano en este archivo).


-- ============================================================================
-- REVERTIR (SOLO SI ALGO SE ROMPE). Cada pieza por separado.
-- ============================================================================
-- -- Muro de eventos:
-- DROP TRIGGER IF EXISTS trg_events_gate_cupo ON public.events;
--
-- -- Muro de invitados:
-- DROP TRIGGER IF EXISTS trg_guests_gate_cupo ON public.guests;
-- DROP TRIGGER IF EXISTS trg_party_members_gate_cupo ON public.party_members;
--
-- -- Solo lectura del evento archivado (las 14 hijas + pagos):
-- DO $$
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
-- END $$;
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
-- -- Permisos de ejecucion, como los dejo la auditoria del 14-sep:
-- REVOKE EXECUTE ON FUNCTION public.get_account_capacity(uuid), public.plan_del_evento(uuid)
--   FROM PUBLIC, anon, authenticated;
--
-- -- Catalogo de planes, como estaba el 8-sep (OJO: con esto /admin ya no puede
-- -- guardar Studio):
-- ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_valido;
-- ALTER TABLE public.workspaces
--   ADD CONSTRAINT workspaces_plan_valido CHECK (plan IN ('free', 'pro', 'agency'));
--
-- -- La migracion de estatus NO se revierte: 'paused', 'cancelled' y
-- -- 'completed' ya no existen en el codigo desplegado (EventStatus en
-- -- lib/types.ts es 'active' | 'archived'), asi que devolverlos dejaria filas
-- -- que la app no sabe pintar. Si de verdad hace falta, el dato viejo esta en
-- -- event_audit_log.
