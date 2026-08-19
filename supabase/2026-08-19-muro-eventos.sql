-- ============================================================================
-- Muro de un evento a la vez — 19 de agosto de 2026
-- Spec: docs/superpowers/specs/2026-08-19-muro-un-evento-a-la-vez-design.md
--
-- ORDEN OBLIGATORIO:
--   BLOQUE 0 (preflight)     -> correr PRIMERO, a mano, de solo lectura. Revisa
--                               si hay un CHECK sobre events.event_status que
--                               impida el valor 'archived'.
--   BLOQUE 1 (cupo)          -> correr DESPUES del deploy, NO antes. No es
--                               inerte: NewEventModal.tsx muestra el mensaje de
--                               error de Postgres tal cual. Si este bloque corre
--                               antes del deploy, un free con un evento vigente
--                               que intenta crear el segundo ve literalmente
--                               "Error al crear el evento: EVENT_LIMIT_EXCEEDED:2:1"
--                               en el modal, sin muro ni explicacion, hasta que
--                               el deploy aterrice.
--   BLOQUE 2 (solo lectura)  -> correr DESPUES del deploy, no antes. Tampoco es
--                               inerte: evento_editable ya devuelve false para
--                               'paused'/'cancelled'/'completed', y esas filas
--                               existen HOY en produccion, editables ahora mismo.
--                               "pausado = solo lectura" entra en vigor apenas
--                               corre este bloque, no cuando el BLOQUE 3 migre
--                               los datos: quien este a media edicion de un
--                               evento pausado se topa con EVENTO_ARCHIVADO en
--                               su proximo guardado.
--   BLOQUE 3 (migracion)     -> correr AL FINAL. Convierte paused/cancelled/
--                               completed en archived.
-- ============================================================================

-- ========================= BLOQUE 0 — PRE-FLIGHT (A MANO) ===================
-- Correr PRIMERO, de solo lectura. No es parte de la migracion, no modifica nada.
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'events'::regclass;
--
-- Si aparece un CHECK que restringe event_status a los valores viejos
-- ('active','paused','cancelled','completed'), hay que tirarlo o ampliarlo para
-- permitir 'archived' ANTES de correr cualquier otra cosa de este archivo. Si
-- no se hace, el BLOQUE 3 aborta Y las escrituras de 'archived' que ya hace la
-- app desplegada empiezan a fallar: la feature nace muerta.

-- ====================== BLOQUE 1 — CUPO DE EVENTOS ==========================
-- Correr DESPUES de que el deploy este arriba (ver nota de orden obligatorio
-- arriba): antes de eso, el error crudo de Postgres se le muestra al usuario
-- en el modal de crear evento.

-- Cuantos eventos vigentes lleva la cuenta y cuantos puede llevar.
-- lim NULL = sin limite.
-- ESPEJO: los mismos numeros viven en getActiveEventLimit() de lib/entitlements.ts.
-- Si cambias uno, cambia el otro.
create or replace function get_account_capacity(p_user_id uuid)
returns table (active int, lim int, remaining int, over boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_plan text; v_email text; v_lim int; v_active int;
begin
  select u.plan, u.email into v_plan, v_email from users u where u.id = p_user_id;

  if v_email in ('superuser@anfiora.com') then v_lim := null;
  elsif v_plan = 'solo'   then v_lim := 10;
  elsif v_plan in ('studio','pro') then v_lim := 25;   -- 'pro' es legacy
  elsif v_plan = 'agency' then v_lim := 60;
  else v_lim := 1;
  end if;

  select count(*) into v_active from events e
   where e.user_id = p_user_id
     and coalesce(e.event_status,'active') = 'active'
     and (coalesce(e.event_end_date, e.event_date) is null
          or coalesce(e.event_end_date, e.event_date) >= current_date);

  return query select v_active, v_lim,
    case when v_lim is null then null else greatest(v_lim - v_active, 0) end,
    case when v_lim is null then false else v_active >= v_lim end;
end $$;

-- Gate del cupo. Actua solo cuando el evento ENTRA a contar: al crearlo, al
-- reactivarlo, o al mover una fecha pasada al futuro. Editar nunca se bloquea.
create or replace function events_gate_cupo()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare cap record;
begin
  -- Despues de esta operacion, ¿el evento cuenta?
  if coalesce(new.event_status,'active') <> 'active'
     or (coalesce(new.event_end_date, new.event_date) is not null
         and coalesce(new.event_end_date, new.event_date) < current_date) then
    return new;
  end if;

  -- Si ya contaba antes, no esta entrando: no se gatea (esto es editar).
  if TG_OP = 'UPDATE'
     and coalesce(old.event_status,'active') = 'active'
     and (coalesce(old.event_end_date, old.event_date) is null
          or coalesce(old.event_end_date, old.event_date) >= current_date) then
    return new;
  end if;

  select * into cap from get_account_capacity(new.user_id);
  if cap.lim is not null and cap.active >= cap.lim then
    raise exception 'EVENT_LIMIT_EXCEEDED:%:%', cap.active + 1, cap.lim;
  end if;
  return new;
end $$;

drop trigger if exists trg_events_gate_cupo on events;
create trigger trg_events_gate_cupo
  before insert or update on events
  for each row execute function events_gate_cupo();

grant execute on function get_account_capacity(uuid) to authenticated;

-- ================== BLOQUE 2 — EVENTO ARCHIVADO = SOLO LECTURA ==============
-- Correr DESPUES de que el deploy este arriba. No es inerte: paused/cancelled/
-- completed ya existen en produccion y se vuelven de solo lectura apenas corre
-- este bloque, no hasta que el BLOQUE 3 los migre a 'archived' mas tarde.

create or replace function evento_editable(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(event_status,'active') = 'active' from events where id = p_event_id;
$$;

-- Rechaza escrituras de un usuario logueado sobre un evento archivado.
-- Lo que entra por servidor o por link publico (RSVP de WhatsApp/Telegram,
-- registro publico) NO trae auth.uid() y pasa: nunca se le tumba una
-- confirmacion a un invitado a media respuesta.
create or replace function bloquea_evento_archivado()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_row jsonb; v_event uuid;
begin
  if auth.uid() is null then
    if TG_OP = 'DELETE' then return old; else return new; end if;
  end if;

  if TG_OP = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_event := (v_row->>'event_id')::uuid;

  if v_event is not null and not evento_editable(v_event) then
    raise exception 'EVENTO_ARCHIVADO';
  end if;

  if TG_OP = 'DELETE' then return old; else return new; end if;
end $$;

-- gift_reservations se agrego a la lista generica: a diferencia de lo que
-- asumia el spec, SI cuelga directo de event_id (columna NOT NULL en el
-- schema de ANF-049, no via join a gift_registry_items). Verificado en
-- app/api/mesa/[token]/route.ts y en el SQL original de la tabla.

-- El loop toma ACCESS EXCLUSIVE sobre las 13 tablas y lo retiene hasta el
-- commit. Si se atora esperando una consulta larga sobre alguna de ellas,
-- falla rapido en vez de encolar todo detras: el remedio es volver a correr
-- este bloque completo, es idempotente (drop trigger if exists + create).
set lock_timeout = '3s';
do $$
declare t text;
begin
  foreach t in array array[
    'guests','party_members','tables','table_seats','event_budgets',
    'event_suppliers','event_timeline_tasks','event_itinerary_moments',
    'event_settings','song_recommendations','gift_registry_items',
    'gift_reservations','event_collaborators'
  ] loop
    execute format('drop trigger if exists trg_%s_archivado on %I', t, t);
    execute format(
      'create trigger trg_%s_archivado before insert or update or delete on %I
         for each row execute function bloquea_evento_archivado()', t, t);
  end loop;
end $$;

-- supplier_payments no tiene event_id: resuelve por su proveedor del evento.
create or replace function bloquea_pago_archivado()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_supplier uuid; v_event uuid;
begin
  if auth.uid() is null then
    if TG_OP = 'DELETE' then return old; else return new; end if;
  end if;

  if TG_OP = 'DELETE' then v_supplier := old.event_supplier_id;
  else v_supplier := new.event_supplier_id; end if;

  select event_id into v_event from event_suppliers where id = v_supplier;
  if v_event is not null and not evento_editable(v_event) then
    raise exception 'EVENTO_ARCHIVADO';
  end if;

  if TG_OP = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists trg_supplier_payments_archivado on supplier_payments;
create trigger trg_supplier_payments_archivado
  before insert or update or delete on supplier_payments
  for each row execute function bloquea_pago_archivado();

-- ====================== BLOQUE 3 — MIGRACION DE DATOS =======================
-- Correr AL FINAL. Ningun evento pierde informacion: archivado conserva todo
-- y se puede reactivar.

update events set event_status = 'archived'
 where coalesce(event_status,'active') not in ('active','archived');

-- Verificacion (debe devolver solo 'active' y 'archived'):
-- select coalesce(event_status,'active') as status, count(*) from events group by 1;
