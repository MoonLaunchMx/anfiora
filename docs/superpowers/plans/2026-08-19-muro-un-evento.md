# Muro de un evento a la vez — Plan de implementación

> **Para quien ejecuta:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Una cuenta gratuita puede trabajar un solo evento a la vez; quien necesite más manda una solicitud que llega a Telegram y Diego lo da de alta a mano.

**Architecture:** El límite vive en un solo lugar de TypeScript (`getActiveEventLimit`) y en un solo lugar de Postgres (un trigger `before insert or update` sobre `events`, espejo del anterior). La interfaz consulta la capacidad *antes* para abrir el muro, y el trigger es la red que no se brinca. El estatus del evento baja de cuatro valores a dos (`active` / `archived`), y "Pasado" se deriva de la fecha.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (Postgres + auth), Vitest, Framer Motion, Lucide.

**Spec:** `docs/superpowers/specs/2026-08-19-muro-un-evento-a-la-vez-design.md`

**Worktree:** `C:\Users\diego\Documents\anfiora-muro`, rama `feat/muro-un-evento` (desde `main`). Todo el trabajo ocurre ahí. El checkout principal `anfiora` está ocupado por otro agente.

## Global Constraints

- **Nunca modificar Supabase directamente.** Todo el SQL se escribe en `supabase/2026-08-19-muro-eventos.sql` y **lo corre Diego**. Ninguna tarea ejecuta SQL.
- **Nunca `git add -A`.** Se agregan solo los archivos que la tarea nombra; hay otros agentes trabajando en el repo.
- **Nunca `git push` sin permiso explícito de Diego.**
- **UI en español con acentos.** Mensajes de commit en español **sin acentos ni ñ**, formato convencional (`feat:`, `fix:`, `docs:`, `refactor:`).
- **Cero emojis en la interfaz.** Iconos de Lucide React.
- **Botones CTA en teal `#48C9B0`.** El negro `#1D1E20` solo para dropdowns de filtro y pestañas de vista.
- **Solo Tailwind**, salvo los archivos que ya usan otra cosa.
- **Sin tablas nuevas en Supabase.**
- **Sin comentarios** salvo cuando el *porqué* no es obvio.
- **Tests con Vitest solo para lógica pura.** UI y endpoints con I/O se verifican a mano (local → preview → main).
- Correr `npx tsc --noEmit` antes de cada commit; correr `npm test` cuando la tarea toque lógica pura.

## Estado de la verificación de la base

Antes de la Tarea 4 hace falta el resultado de estas consultas de **solo lectura**, que Diego corre en Supabase (ya se le pidieron, falta la salida):

```sql
select column_name from information_schema.columns
 where table_name = 'events' and column_name in ('plan_tier','over_limit','locked');
select proname from pg_proc
 where proname in ('get_account_capacity','create_event','set_event_status','can_write_event');
select coalesce(event_status,'active') as status, count(*) from events group by 1;
select plan, count(*) from users group by 1;
```

El resultado ajusta **la migración**, no el diseño. Las tareas 1, 2, 3 y 5 a 11 no dependen de él.

---

### Task 1: Catálogo de planes y límite de eventos

Porta desde el worktree `../anfiora-paywall` (commit `dbd743a`) el catálogo de planes y el resolver de límites, recortado a la parte de cuenta. Sin precios en pantalla: es un archivo de datos.

**Files:**
- Create: `lib/pricing.ts` (copia literal de `../anfiora-paywall/lib/pricing.ts`)
- Create: `lib/entitlements.ts` (versión recortada)
- Create: `lib/entitlements.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `getActiveEventLimit(plan: string | null | undefined, email?: string | null): number` (devuelve `Infinity` si no hay límite) · `normalizePlan(raw): UserPlan` · `isPlanner(raw): boolean` · `isStaff(email): boolean` · `PLAN_IDS: UserPlan[]` · `ORGANIZADOR_PLANS` y `AnfitrionPlan`/`OrganizadorPlan` desde `lib/pricing.ts`.

- [ ] **Step 1: Copiar el catálogo de planes tal cual**

```bash
cp ../anfiora-paywall/lib/pricing.ts lib/pricing.ts
```

No editar el archivo. Trae los planes de anfitrión y de organizador con sus precios de lista; hoy solo se consume `ORGANIZADOR_PLANS[].activeEvents`, y los precios los usará `lib/billing.ts` en la Tarea 10.

- [ ] **Step 2: Escribir el test que falla**

Crear `lib/entitlements.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getActiveEventLimit, normalizePlan, isPlanner, PLAN_IDS } from './entitlements'

describe('getActiveEventLimit', () => {
  it('una cuenta gratis lleva un evento a la vez', () => {
    expect(getActiveEventLimit('free')).toBe(1)
  })

  it('sin plan, o con un valor que no existe, cae en uno', () => {
    expect(getActiveEventLimit(null)).toBe(1)
    expect(getActiveEventLimit(undefined)).toBe(1)
    expect(getActiveEventLimit('lo-que-sea')).toBe(1)
  })

  it('respeta el cupo de cada plan de planner', () => {
    expect(getActiveEventLimit('solo')).toBe(10)
    expect(getActiveEventLimit('studio')).toBe(25)
    expect(getActiveEventLimit('agency')).toBe(60)
  })

  it('el plan viejo pro no capa a quien ya lo tiene', () => {
    expect(getActiveEventLimit('pro')).toBe(25)
  })

  it('el staff no tiene limite', () => {
    expect(getActiveEventLimit('free', 'superuser@anfiora.com')).toBe(Infinity)
  })
})

describe('normalizePlan', () => {
  it('traduce el legacy pro a studio', () => {
    expect(normalizePlan('pro')).toBe('studio')
  })
  it('cualquier basura es free', () => {
    expect(normalizePlan('  ')).toBe('free')
    expect(normalizePlan(null)).toBe('free')
  })
})

describe('isPlanner', () => {
  it('free no es planner', () => {
    expect(isPlanner('free')).toBe(false)
  })
  it('los planes de suscripcion si', () => {
    expect(isPlanner('solo')).toBe(true)
    expect(isPlanner('studio')).toBe(true)
    expect(isPlanner('agency')).toBe(true)
  })
})

describe('PLAN_IDS', () => {
  it('son los cuatro planes vivos, en orden de cupo', () => {
    expect(PLAN_IDS).toEqual(['free', 'solo', 'studio', 'agency'])
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -- lib/entitlements.test.ts`
Expected: FAIL — no existe `lib/entitlements.ts`.

- [ ] **Step 4: Escribir `lib/entitlements.ts`**

```ts
import { ORGANIZADOR_PLANS, type OrganizadorTier } from './pricing'

export type UserPlan = 'free' | OrganizadorTier

export const PLAN_IDS: UserPlan[] = ['free', ...ORGANIZADOR_PLANS.map(p => p.id)]

const STAFF_EMAILS = new Set<string>(['superuser@anfiora.com'])

export function isStaff(email: string | null | undefined): boolean {
  return !!email && STAFF_EMAILS.has(email)
}

// 'pro' es un plan viejo que daba eventos ilimitados. Se traduce a studio para no
// capar a quien ya lo tiene.
export function normalizePlan(raw: string | null | undefined): UserPlan {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'pro') return 'studio'
  return ORGANIZADOR_PLANS.some(p => p.id === value) ? (value as OrganizadorTier) : 'free'
}

export function isPlanner(raw: string | null | undefined): boolean {
  return normalizePlan(raw) !== 'free'
}

// Cuantos eventos vigentes puede llevar la cuenta al mismo tiempo.
// ESPEJO: el mismo numero vive en get_account_capacity() dentro de
// supabase/2026-08-19-muro-eventos.sql. Si cambias uno, cambia el otro.
export function getActiveEventLimit(
  plan: string | null | undefined,
  email?: string | null,
): number {
  if (isStaff(email)) return Infinity
  const normalized = normalizePlan(plan)
  if (normalized === 'free') return 1
  const found = ORGANIZADOR_PLANS.find(p => p.id === normalized)
  return found ? found.activeEvents : 1
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -- lib/entitlements.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Typecheck y commit**

```bash
npx tsc --noEmit
git add lib/pricing.ts lib/entitlements.ts lib/entitlements.test.ts
git commit -m "feat(muro): catalogo de planes y limite de eventos por cuenta"
```

---

### Task 2: Estatus del evento en dos valores

`EventStatus` baja a `'active' | 'archived'` y se crea el único lugar que decide qué se le muestra al usuario. Cualquier valor que no sea `active` cuenta como archivado, para que el código funcione **antes** de que corra la migración de datos.

**Files:**
- Modify: `lib/types.ts:98`
- Create: `lib/events/estado.ts`
- Create: `lib/events/estado.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type EstadoEvento = 'activo' | 'pasado' | 'archivado'` · `estadoEvento(e: EventoParaEstado, hoy: Date): EstadoEvento` · `esArchivado(status: string | null | undefined): boolean` · `ocupaLugar(e: EventoParaEstado, hoy: Date): boolean` · `ESTADO_LABEL: Record<EstadoEvento, string>` · `type EventoParaEstado = { event_status: string | null; event_date: string | null; event_end_date: string | null }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/events/estado.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { estadoEvento, esArchivado, ocupaLugar } from './estado'

const HOY = new Date(2026, 7, 19)

const evento = (over: Partial<{ event_status: string | null; event_date: string | null; event_end_date: string | null }> = {}) => ({
  event_status: 'active' as string | null,
  event_date: '2026-08-25',
  event_end_date: null as string | null,
  ...over,
})

describe('estadoEvento', () => {
  it('activo cuando la fecha es futura', () => {
    expect(estadoEvento(evento(), HOY)).toBe('activo')
  })

  it('el evento de hoy sigue activo', () => {
    expect(estadoEvento(evento({ event_date: '2026-08-19' }), HOY)).toBe('activo')
  })

  it('pasado cuando la fecha ya se cumplio', () => {
    expect(estadoEvento(evento({ event_date: '2026-08-18' }), HOY)).toBe('pasado')
  })

  it('en un evento de varios dias manda la fecha final', () => {
    expect(estadoEvento(evento({ event_date: '2026-08-17', event_end_date: '2026-08-20' }), HOY)).toBe('activo')
  })

  it('sin fecha se considera vigente', () => {
    expect(estadoEvento(evento({ event_date: null }), HOY)).toBe('activo')
  })

  it('archivado gana sobre la fecha', () => {
    expect(estadoEvento(evento({ event_status: 'archived' }), HOY)).toBe('archivado')
    expect(estadoEvento(evento({ event_status: 'archived', event_date: '2020-01-01' }), HOY)).toBe('archivado')
  })

  it('los estatus viejos cuentan como archivados mientras no corra la migracion', () => {
    expect(estadoEvento(evento({ event_status: 'paused' }), HOY)).toBe('archivado')
    expect(estadoEvento(evento({ event_status: 'cancelled' }), HOY)).toBe('archivado')
    expect(estadoEvento(evento({ event_status: 'completed' }), HOY)).toBe('archivado')
  })

  it('sin estatus es activo, como en la base', () => {
    expect(estadoEvento(evento({ event_status: null }), HOY)).toBe('activo')
  })
})

describe('esArchivado', () => {
  it('solo active esta vivo', () => {
    expect(esArchivado('active')).toBe(false)
    expect(esArchivado(null)).toBe(false)
    expect(esArchivado('archived')).toBe(true)
    expect(esArchivado('paused')).toBe(true)
  })
})

describe('ocupaLugar', () => {
  it('solo el activo vigente ocupa lugar', () => {
    expect(ocupaLugar(evento(), HOY)).toBe(true)
    expect(ocupaLugar(evento({ event_date: '2026-08-18' }), HOY)).toBe(false)
    expect(ocupaLugar(evento({ event_status: 'archived' }), HOY)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- lib/events/estado.test.ts`
Expected: FAIL — no existe `lib/events/estado.ts`.

- [ ] **Step 3: Escribir `lib/events/estado.ts`**

```ts
export type EstadoEvento = 'activo' | 'pasado' | 'archivado'

export type EventoParaEstado = {
  event_status: string | null
  event_date: string | null
  event_end_date: string | null
}

export const ESTADO_LABEL: Record<EstadoEvento, string> = {
  activo: 'Activo',
  pasado: 'Pasado',
  archivado: 'Archivado',
}

// Cualquier valor distinto de 'active' se trata como archivado: asi el codigo
// funciona igual antes y despues de la migracion de paused/cancelled/completed.
export function esArchivado(status: string | null | undefined): boolean {
  return !!status && status !== 'active'
}

function ultimoDia(e: EventoParaEstado): Date | null {
  const raw = e.event_end_date || e.event_date
  if (!raw) return null
  const [year, month, day] = raw.split('T')[0].split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function estadoEvento(e: EventoParaEstado, hoy: Date): EstadoEvento {
  if (esArchivado(e.event_status)) return 'archivado'
  const fin = ultimoDia(e)
  if (!fin) return 'activo'
  const corte = new Date(hoy)
  corte.setHours(0, 0, 0, 0)
  return fin < corte ? 'pasado' : 'activo'
}

export function ocupaLugar(e: EventoParaEstado, hoy: Date): boolean {
  return estadoEvento(e, hoy) === 'activo'
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- lib/events/estado.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Bajar `EventStatus` a dos valores**

En `lib/types.ts:98`, reemplazar:

```ts
export type EventStatus = 'active' | 'paused' | 'cancelled' | 'completed'
```

por:

```ts
export type EventStatus = 'active' | 'archived'
```

- [ ] **Step 6: Correr el typecheck para levantar la lista de lugares rotos**

Run: `npx tsc --noEmit`
Expected: FAIL. Los errores esperados están en `app/dashboard/page.tsx` y `app/events/[id]/layout.tsx`, que se arreglan en las tareas 7 y 9. **No arreglarlos aquí.** Anotar la lista y seguir.

- [ ] **Step 7: Commit**

El typecheck queda en rojo a propósito hasta la Tarea 9; el test suite sí debe estar verde.

```bash
npm test
git add lib/types.ts lib/events/estado.ts lib/events/estado.test.ts
git commit -m "feat(muro): estatus de evento en activo y archivado"
```

---

### Task 3: Los flujos automáticos entienden `archived`

Los recordatorios del timeline y las respuestas automáticas hoy se saltan los eventos `cancelled` y `completed`. Con el modelo nuevo se saltan los archivados, que es lo mismo dicho en dos valores en vez de en cuatro.

**Files:**
- Modify: `lib/notifications/reminders.ts:57`
- Modify: `app/api/webhook/whatsapp/route.ts:63`
- Modify: `lib/notifications/reminders.test.ts`

**Interfaces:**
- Consumes: `esArchivado` de `lib/events/estado.ts` (Tarea 2).
- Produces: nada nuevo.

- [ ] **Step 1: Escribir el test que falla**

En `lib/notifications/reminders.test.ts`, agregar dentro del bloque que ya prueba `reminderSkipReason`:

```ts
it('un evento archivado no dispara recordatorios', () => {
  const task = { ...tareaBase, task_date: '2026-12-01', task_time: '10:00' }
  expect(reminderSkipReason(task, { ...eventoBase, event_status: 'archived' }, new Date(2026, 0, 1)))
    .toBe('evento_no_activo')
})
```

Ajustar `tareaBase` y `eventoBase` a los nombres de los fixtures que ya existan en ese archivo; si no existen, construir los objetos completos siguiendo los tests vecinos.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- lib/notifications/reminders.test.ts`
Expected: FAIL — devuelve `null` porque la condición sigue mirando `cancelled`/`completed`.

- [ ] **Step 3: Cambiar la regla en `lib/notifications/reminders.ts`**

Reemplazar:

```ts
  if (event.event_status === 'cancelled' || event.event_status === 'completed') {
    return 'evento_no_activo'
  }
```

por:

```ts
  if (esArchivado(event.event_status)) return 'evento_no_activo'
```

Y agregar el import arriba: `import { esArchivado } from '@/lib/events/estado'`.

- [ ] **Step 4: Cambiar la misma regla en el webhook**

En `app/api/webhook/whatsapp/route.ts:63`, reemplazar:

```ts
    if (event?.event_status === 'cancelled' || event?.event_status === 'completed') {
```

por:

```ts
    if (esArchivado(event?.event_status)) {
```

Y agregar `import { esArchivado } from '@/lib/events/estado'`.

- [ ] **Step 5: Confirmar que el enrutamiento de Telegram no decide nada con el estatus**

Run: `grep -n "event_status\|eventStatus" lib/telegram/routing.ts`
Ese archivo solo arrastra `eventStatus` como dato de contexto; **si no compara contra `cancelled` o `completed`, no se toca**. Si resulta que sí compara, aplicar el mismo cambio a `esArchivado` y agregarlo al commit.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test -- lib/notifications/reminders.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/notifications/reminders.ts lib/notifications/reminders.test.ts app/api/webhook/whatsapp/route.ts
git commit -m "feat(muro): los flujos automaticos se saltan el evento archivado"
```

---

### Task 4: SQL — cupo, candado de solo lectura y migración

Un solo archivo, que **corre Diego**. Ninguna tarea lo ejecuta. Se escribe en tres bloques con un orden obligatorio.

**Files:**
- Create: `supabase/2026-08-19-muro-eventos.sql`

**Interfaces:**
- Consumes: nada de TypeScript.
- Produces: la función `get_account_capacity(p_user_id uuid)` que devuelve `(active int, lim int, remaining int, over boolean)` — la consume `lib/capacity.ts` en la Tarea 5. Y el error `EVENT_LIMIT_EXCEEDED:<activos>:<limite>`, que parsea esa misma tarea.

- [ ] **Step 1: Averiguar cómo cuelga `gift_reservations` de su evento**

Antes de escribir los triggers hace falta saber por dónde se resuelve el evento en las dos tablas que no tienen `event_id`. Pedir a Diego que corra, de solo lectura:

```sql
select column_name, data_type from information_schema.columns
 where table_name in ('gift_reservations','supplier_payments','gift_registry_items')
 order by table_name, ordinal_position;
```

Si `gift_reservations` no resuelve a un evento con un `join` de un solo salto, **no se le pone trigger**: queda anotado como hueco conocido al final del archivo SQL, cubierto solo por la interfaz. No se finge que está cerrado.

- [ ] **Step 2: Escribir el bloque de cupo**

Crear `supabase/2026-08-19-muro-eventos.sql`:

```sql
-- ============================================================================
-- Muro de un evento a la vez — 19 de agosto de 2026
-- Spec: docs/superpowers/specs/2026-08-19-muro-un-evento-a-la-vez-design.md
--
-- ORDEN OBLIGATORIO:
--   BLOQUE 1 (cupo)          -> se puede correr cuando sea, es inerte hasta que
--                               alguien intente crear el evento que no cabe.
--   BLOQUE 2 (solo lectura)  -> correr DESPUES del deploy, no antes: bloquea
--                               escrituras sobre eventos archivados.
--   BLOQUE 3 (migracion)     -> correr AL FINAL. Convierte paused/cancelled/
--                               completed en archived.
-- ============================================================================

-- ====================== BLOQUE 1 — CUPO DE EVENTOS ==========================

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
```

- [ ] **Step 3: Escribir el bloque de solo lectura**

Agregar al mismo archivo:

```sql
-- ================== BLOQUE 2 — EVENTO ARCHIVADO = SOLO LECTURA ==============
-- Correr DESPUES de que el deploy este arriba.

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

do $$
declare t text;
begin
  foreach t in array array[
    'guests','party_members','tables','table_seats','event_budgets',
    'event_suppliers','event_timeline_tasks','event_itinerary_moments',
    'event_settings','song_recommendations','gift_registry_items','event_collaborators'
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
```

- [ ] **Step 4: Escribir el bloque de migración**

Agregar al mismo archivo:

```sql
-- ====================== BLOQUE 3 — MIGRACION DE DATOS =======================
-- Correr AL FINAL. Ningun evento pierde informacion: archivado conserva todo
-- y se puede reactivar.

update events set event_status = 'archived'
 where coalesce(event_status,'active') not in ('active','archived');

-- Verificacion (debe devolver solo 'active' y 'archived'):
-- select coalesce(event_status,'active') as status, count(*) from events group by 1;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/2026-08-19-muro-eventos.sql
git commit -m "feat(muro): sql del cupo, el candado de solo lectura y la migracion"
```

- [ ] **Step 6: Entregar el SQL a Diego**

Decirle textualmente: el archivo tiene tres bloques y el orden importa. El **bloque 1** se puede correr desde ya (es inerte hasta que alguien intente crear un evento que no cabe). El **bloque 2** se corre después de que el deploy esté arriba. El **bloque 3** al final. No correr nada por cuenta propia.

---

### Task 5: Consultar la capacidad desde el cliente

La interfaz necesita saber *antes* si cabe, para abrir el muro en vez de dejar que la escritura falle. Y necesita entender el error del trigger cuando la carrera se pierde de todos modos.

**Files:**
- Create: `lib/capacity.ts`
- Create: `lib/capacity.test.ts`

**Interfaces:**
- Consumes: `get_account_capacity` (Tarea 4) · `supabase` de `lib/supabase.ts`.
- Produces: `type AccountCapacity = { active: number; lim: number | null; remaining: number | null; over: boolean }` · `fetchAccountCapacity(userId: string): Promise<AccountCapacity | null>` · `parseLimitError(msg: string): { needed: number; limit: number } | null` · `esErrorDeCupo(error: { message: string } | null): boolean`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/capacity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseLimitError, esErrorDeCupo } from './capacity'

describe('parseLimitError', () => {
  it('lee el error que levanta el trigger', () => {
    expect(parseLimitError('EVENT_LIMIT_EXCEEDED:2:1')).toEqual({ needed: 2, limit: 1 })
  })

  it('lo encuentra aunque venga envuelto por postgres', () => {
    expect(parseLimitError('P0001: EVENT_LIMIT_EXCEEDED:26:25')).toEqual({ needed: 26, limit: 25 })
  })

  it('devuelve null con cualquier otro error', () => {
    expect(parseLimitError('duplicate key value violates unique constraint')).toBeNull()
    expect(parseLimitError('')).toBeNull()
  })
})

describe('esErrorDeCupo', () => {
  it('distingue el error de cupo de los demas', () => {
    expect(esErrorDeCupo({ message: 'EVENT_LIMIT_EXCEEDED:2:1' })).toBe(true)
    expect(esErrorDeCupo({ message: 'EVENTO_ARCHIVADO' })).toBe(false)
    expect(esErrorDeCupo(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- lib/capacity.test.ts`
Expected: FAIL — no existe `lib/capacity.ts`.

- [ ] **Step 3: Escribir `lib/capacity.ts`**

```ts
import { supabase } from '@/lib/supabase'

export type AccountCapacity = {
  active: number
  lim: number | null
  remaining: number | null
  over: boolean
}

export async function fetchAccountCapacity(userId: string): Promise<AccountCapacity | null> {
  const { data, error } = await supabase.rpc('get_account_capacity', { p_user_id: userId })
  if (error || !data?.[0]) return null
  return data[0] as AccountCapacity
}

export function parseLimitError(msg: string): { needed: number; limit: number } | null {
  const m = msg.match(/EVENT_LIMIT_EXCEEDED:(\d+):(\d+)/)
  return m ? { needed: Number(m[1]), limit: Number(m[2]) } : null
}

export function esErrorDeCupo(error: { message: string } | null): boolean {
  return !!error && parseLimitError(error.message) !== null
}

export function esErrorDeArchivado(error: { message: string } | null): boolean {
  return !!error && error.message.includes('EVENTO_ARCHIVADO')
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- lib/capacity.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/capacity.ts lib/capacity.test.ts
git commit -m "feat(muro): consulta de capacidad y lectura del error de cupo"
```

---

### Task 6: La solicitud de acceso llega a Telegram

El formulario que llena quien topa con el muro. Sin tabla nueva: el destino es la conversación de Diego.

**Files:**
- Create: `lib/solicitud-acceso.ts`
- Create: `lib/solicitud-acceso.test.ts`
- Create: `app/api/solicitud-acceso/route.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `type SolicitudAcceso = { nombre: string; eventosPorAno: string; tipoEventos: string; tamanoEquipo: string; canal: CanalContacto; whatsapp: string; correo: string; ciudad: string }` · `type CanalContacto = 'whatsapp' | 'correo' | 'llamada'` · `CANALES_CONTACTO: { value: CanalContacto; label: string }[]` · `validarSolicitud(s: SolicitudAcceso): string | null` · `formatSolicitudMessage(s: SolicitudAcceso, contexto: { plan: string; eventosVigentes: number }): string`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/solicitud-acceso.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validarSolicitud, formatSolicitudMessage, type SolicitudAcceso } from './solicitud-acceso'

const base: SolicitudAcceso = {
  nombre: 'Eventos Luna',
  eventosPorAno: '12',
  tipoEventos: 'Bodas y XV',
  tamanoEquipo: '3',
  canal: 'whatsapp',
  whatsapp: '+528112345678',
  correo: 'hola@eventosluna.mx',
  ciudad: 'Monterrey, Mexico',
}

describe('validarSolicitud', () => {
  it('acepta una solicitud completa', () => {
    expect(validarSolicitud(base)).toBeNull()
  })

  it('exige nombre', () => {
    expect(validarSolicitud({ ...base, nombre: '   ' })).toBe('Escribe tu nombre o el de tu empresa.')
  })

  it('exige cuantos eventos al ano', () => {
    expect(validarSolicitud({ ...base, eventosPorAno: '' })).toBe('Dinos cuantos eventos organizas al ano.')
  })

  it('exige un correo con forma de correo', () => {
    expect(validarSolicitud({ ...base, correo: 'noesuncorreo' })).toBe('Revisa tu correo.')
  })

  it('si el canal es whatsapp, exige numero', () => {
    expect(validarSolicitud({ ...base, whatsapp: '' })).toBe('Deja tu WhatsApp para poder escribirte.')
  })

  it('si el canal es correo, el numero es opcional', () => {
    expect(validarSolicitud({ ...base, canal: 'correo', whatsapp: '' })).toBeNull()
  })
})

describe('formatSolicitudMessage', () => {
  it('arma un mensaje con todo lo que Diego necesita para dar de alta', () => {
    const texto = formatSolicitudMessage(base, { plan: 'free', eventosVigentes: 1 })
    expect(texto).toContain('SOLICITUD DE ACCESO')
    expect(texto).toContain('Eventos Luna')
    expect(texto).toContain('12')
    expect(texto).toContain('Bodas y XV')
    expect(texto).toContain('+528112345678')
    expect(texto).toContain('hola@eventosluna.mx')
    expect(texto).toContain('Monterrey, Mexico')
    expect(texto).toContain('free')
    expect(texto).toContain('1')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- lib/solicitud-acceso.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Escribir `lib/solicitud-acceso.ts`**

```ts
export type CanalContacto = 'whatsapp' | 'correo' | 'llamada'

export const CANALES_CONTACTO: { value: CanalContacto; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'correo',   label: 'Correo' },
  { value: 'llamada',  label: 'Llamada' },
]

export type SolicitudAcceso = {
  nombre: string
  eventosPorAno: string
  tipoEventos: string
  tamanoEquipo: string
  canal: CanalContacto
  whatsapp: string
  correo: string
  ciudad: string
}

export function validarSolicitud(s: SolicitudAcceso): string | null {
  if (!s.nombre.trim()) return 'Escribe tu nombre o el de tu empresa.'
  if (!s.eventosPorAno.trim()) return 'Dinos cuantos eventos organizas al ano.'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.correo.trim())) return 'Revisa tu correo.'
  if (s.canal === 'whatsapp' && !s.whatsapp.trim()) return 'Deja tu WhatsApp para poder escribirte.'
  return null
}

export function formatSolicitudMessage(
  s: SolicitudAcceso,
  contexto: { plan: string; eventosVigentes: number },
): string {
  const canal = CANALES_CONTACTO.find(c => c.value === s.canal)?.label ?? s.canal
  return [
    '[SOLICITUD DE ACCESO] Anfiora',
    '',
    `Nombre: ${s.nombre.trim()}`,
    `Eventos al ano: ${s.eventosPorAno.trim()}`,
    `Tipo de eventos: ${s.tipoEventos.trim() || 'No dijo'}`,
    `Equipo: ${s.tamanoEquipo.trim() || 'No dijo'}`,
    `Ciudad: ${s.ciudad.trim() || 'No dijo'}`,
    '',
    `Prefiere que le escriban por: ${canal}`,
    `WhatsApp: ${s.whatsapp.trim() || 'No dejo'}`,
    `Correo: ${s.correo.trim()}`,
    '',
    `Plan actual: ${contexto.plan}`,
    `Eventos vigentes hoy: ${contexto.eventosVigentes}`,
  ].join('\n')
}
```

Nota de estilo: los mensajes de validación van sin acentos porque salen del mismo módulo que el texto que viaja a Telegram; en pantalla se muestran tal cual y esa es la única excepción a la regla de acentos.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- lib/solicitud-acceso.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Escribir el endpoint**

Crear `app/api/solicitud-acceso/route.ts`. Sigue el mismo patrón que `app/api/feedback/route.ts`: autenticación por bearer, cliente con service role, y envío a Telegram con un reintento.

```ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { formatSolicitudMessage, validarSolicitud, type SolicitudAcceso } from '@/lib/solicitud-acceso'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user }, error: authError } =
    await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })

  const token = process.env.TELEGRAM_SUPPORT_BOT_TOKEN
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID
  if (!token || !chatId) {
    console.error('[solicitud-acceso] faltan env vars TELEGRAM_SUPPORT_*')
    return NextResponse.json({ ok: false, error: 'no configurado' }, { status: 500 })
  }

  let solicitud: SolicitudAcceso
  try {
    solicitud = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'json invalido' }, { status: 400 })
  }

  const invalido = validarSolicitud(solicitud)
  if (invalido) return NextResponse.json({ ok: false, error: invalido }, { status: 400 })

  const { data: profile } = await supabaseAdmin
    .from('users').select('plan').eq('id', user.id).single()

  const { count } = await supabaseAdmin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('event_status', 'active')

  const text = formatSolicitudMessage(solicitud, {
    plan: profile?.plan ?? 'free',
    eventosVigentes: count ?? 0,
  })

  const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`
  const tgBody = JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })

  // Reintento unico: el connect a Telegram falla esporadicamente en cold start.
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      const res = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: tgBody,
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (res.ok) return NextResponse.json({ ok: true })
    } catch {
      clearTimeout(timer)
    }
  }

  console.error('[solicitud-acceso] no se pudo enviar a Telegram')
  return NextResponse.json({ ok: false, error: 'no se pudo enviar' }, { status: 502 })
}
```

- [ ] **Step 6: Typecheck y commit**

```bash
npx tsc --noEmit
git add lib/solicitud-acceso.ts lib/solicitud-acceso.test.ts app/api/solicitud-acceso/route.ts
git commit -m "feat(muro): solicitud de acceso que llega a telegram"
```

---

### Task 7: El muro y su formulario

El modal que se abre cuando ya no cabe otro evento. Dos vistas: el aviso y el formulario.

**Files:**
- Create: `app/components/MuroEventosModal.tsx`

**Interfaces:**
- Consumes: `Modal` de `app/components/ui/Modal.tsx` (`Modal`, `Modal.Header`, `Modal.Body`, `Modal.Footer`) · `PhoneInput` (export default, props `{ value, onChange, placeholder?, disabled? }`) · `CANALES_CONTACTO`, `validarSolicitud`, `type SolicitudAcceso` de `lib/solicitud-acceso.ts` · `supabase` para sacar el token de sesión.
- Produces: `<MuroEventosModal open={boolean} onClose={() => void} limite={number} />`.

- [ ] **Step 1: Construir el componente**

Crear `app/components/MuroEventosModal.tsx` con `'use client'` arriba. Tres estados: `vista` (`'aviso' | 'formulario' | 'enviado'`), el objeto `SolicitudAcceso`, y `enviando`/`error`.

Estructura:

- **Vista `aviso`** — `Modal.Header` con título "Un evento a la vez"; en el cuerpo, el texto: *"Con tu cuenta puedes llevar {limite} evento{s} a la vez. Si organizas varios, cuéntanos qué necesitas y te damos acceso."*; en el footer, "Ahora no" (borde gris, cierra) y **"Solicitar acceso"** en teal `#48C9B0`, que pasa a `formulario`.
- **Vista `formulario`** — los ocho campos, en este orden: Nombre (empresa o persona) · Eventos aproximados al año (`inputMode="numeric"`) · Tipo de eventos que gestiona · Tamaño del equipo (`inputMode="numeric"`) · Cómo prefieres que te contactemos (los tres botones de `CANALES_CONTACTO`, el activo en teal) · WhatsApp (`<PhoneInput>`, **nunca** un input suelto) · Correo (precargado con el de la sesión) · Ciudad / país. El error de `validarSolicitud` se pinta arriba del footer en `--error-text` (`#cc3333`).
- **Vista `enviado`** — icono `Check` de Lucide en teal, "Listo, te escribimos hoy mismo." y un botón "Cerrar".

Clases de los inputs, iguales a las de los modales del producto: `w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-base outline-none transition focus:border-[#48C9B0]`.

El correo se precarga así:

```ts
useEffect(() => {
  if (!open) return
  supabase.auth.getUser().then(({ data }) => {
    setSolicitud(s => ({ ...s, correo: s.correo || (data.user?.email ?? '') }))
  })
}, [open])
```

Y el envío:

```ts
const enviar = async () => {
  const invalido = validarSolicitud(solicitud)
  if (invalido) { setError(invalido); return }
  setEnviando(true); setError('')
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/solicitud-acceso', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: 'Bearer ' + (session?.access_token ?? ''),
    },
    body: JSON.stringify(solicitud),
  })
  setEnviando(false)
  if (res.ok) setVista('enviado')
  else setError('No se pudo enviar. Intenta de nuevo o escribenos por WhatsApp.')
}
```

- [ ] **Step 2: Verificar a mano en local**

Run: `npm run dev` (siempre en `localhost:3000`; si está ocupado, avisarle a Diego — **nunca** brincar al 3001).
Comprobar: se abre el aviso, pasa al formulario, un envío sin nombre muestra el error, un envío completo llega a Telegram y deja la vista de "enviado". En móvil (DevTools a 375px), que el teclado no tape los campos y que el selector de país de `PhoneInput` se abra completo.

- [ ] **Step 3: Typecheck y commit**

```bash
npx tsc --noEmit
git add app/components/MuroEventosModal.tsx
git commit -m "feat(muro): modal del muro con el formulario de solicitud"
```

---

### Task 8: El muro al crear un evento

`NewEventModal` consulta la capacidad antes de insertar y, si no cabe, abre el muro en vez de crear. El error del trigger queda como red por si la carrera se pierde.

**Files:**
- Modify: `app/components/NewEventModal.tsx:100-142` (la función `handleCreate`)
- Modify: `app/dashboard/page.tsx:788-793` (el uso de `<NewEventModal>`)

**Interfaces:**
- Consumes: `fetchAccountCapacity`, `esErrorDeCupo` de `lib/capacity.ts` (Tarea 5) · `<MuroEventosModal>` (Tarea 7).
- Produces: la prop nueva `onLimite: (limite: number) => void` en `NewEventModalProps`.

- [ ] **Step 1: Agregar la prop al contrato del modal**

En `NewEventModal.tsx`, en `interface NewEventModalProps`, agregar:

```ts
  onLimite: (limite: number) => void
```

y recibirla en la firma del componente.

- [ ] **Step 2: Consultar la capacidad antes de insertar**

Dentro de `handleCreate`, justo después de resolver el usuario y **antes** del `insert` a `events`:

```ts
    const cap = await fetchAccountCapacity(user.id)
    if (cap && cap.lim !== null && cap.active >= cap.lim) {
      setLoading(false)
      onClose()
      onLimite(cap.lim)
      return
    }
```

Con el import correspondiente: `import { fetchAccountCapacity, esErrorDeCupo } from '@/lib/capacity'`.

- [ ] **Step 3: Tratar el error del trigger como red**

En el bloque que hoy dice:

```ts
    if (eventError) {
      setError('Error al crear el evento: ' + eventError.message)
      setLoading(false)
      return
    }
```

reemplazar por:

```ts
    if (eventError) {
      if (esErrorDeCupo(eventError)) {
        setLoading(false)
        onClose()
        onLimite(cap?.lim ?? 1)
        return
      }
      setError('Error al crear el evento: ' + eventError.message)
      setLoading(false)
      return
    }
```

- [ ] **Step 4: Conectar el muro en el dashboard**

En `app/dashboard/page.tsx`, agregar el estado y el modal:

```tsx
  const [muroLimite, setMuroLimite] = useState<number | null>(null)
```

```tsx
      <NewEventModal
        open={showNewEvent}
        onClose={() => setShowNewEvent(false)}
        onLimite={limite => setMuroLimite(limite)}
        onCreated={...}
      />
      <MuroEventosModal
        open={muroLimite !== null}
        onClose={() => setMuroLimite(null)}
        limite={muroLimite ?? 1}
      />
```

El botón "+ Nuevo evento" (`app/dashboard/page.tsx:644` y `:744`) **no se esconde** cuando no hay cupo: sigue abriendo el modal, y el muro aparece al intentar crear.

- [ ] **Step 5: Verificar a mano**

Con una cuenta `free` que ya tenga un evento vigente: intentar crear otro → aparece el muro, no se crea nada. Archivar el primero → ahora sí se crea. Con la cuenta de Diego (plan con cupo alto): crear un evento normal y **verificar que llegan todos los campos** (fecha final, herramientas, modo de acceso, cupo y precio de la puerta), que es justo lo que el RPC viejo perdía.

- [ ] **Step 6: Typecheck y commit**

```bash
npx tsc --noEmit
git add app/components/NewEventModal.tsx app/dashboard/page.tsx
git commit -m "feat(muro): el segundo evento abre el muro en vez de crearse"
```

---

### Task 9: Dashboard con tres pestañas y archivar

**Files:**
- Modify: `app/dashboard/page.tsx:25` (`type Tab`), `:281-287` (`handleStatusChange`), `:356-373` (`filterByTab`), `:377-388` (selección por pestaña), `:403-410` (pestañas), `:411-417` (`getMenuOptions`), `:753-756` (textos de vacío)

**Interfaces:**
- Consumes: `estadoEvento`, `esArchivado`, `type EstadoEvento` de `lib/events/estado.ts` (Tarea 2) · `getActiveEventLimit` de `lib/entitlements.ts` (Tarea 1) · `esErrorDeCupo` de `lib/capacity.ts` (Tarea 5) · `MuroEventosModal` y el estado `muroLimite` que introdujo la Tarea 8.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Bajar las pestañas a tres**

Reemplazar `type Tab = 'activos' | 'pasados' | 'pausados' | 'cancelados'` por:

```ts
type Tab = 'activos' | 'pasados' | 'archivados'
```

- [ ] **Step 2: Reescribir el agrupado sobre el estado derivado**

Reemplazar el cuerpo de `filterByTab` por:

```ts
  const filterByTab = (list: EventWithStats[]) => {
    const grupo = (estado: EstadoEvento) => list.filter(e => estadoEvento(e, today) === estado)
    const active = grupo('activo').sort((a, b) => {
      const diff = getEventDateTime(a).getTime() - getEventDateTime(b).getTime()
      return sortAsc ? diff : -diff
    })
    const past = grupo('pasado')
      .sort((a, b) => getEventDateTime(b).getTime() - getEventDateTime(a).getTime())
    const archived = grupo('archivado')
      .sort((a, b) => getEventDateTime(b).getTime() - getEventDateTime(a).getTime())
    return { active, past, archived }
  }
```

Actualizar `currentMy`, `currentShared` y `tabs` para usar `archived` en vez de `paused`/`cancelled`, y los textos de vacío: `'No tienes eventos archivados'`.

- [ ] **Step 3: El menú por evento ofrece archivar o reactivar**

```ts
  const getMenuOptions = (event: EventWithStats) => {
    return esArchivado(event.event_status)
      ? [{ label: 'Reactivar', status: 'active' as EventStatus }]
      : [{ label: 'Archivar', status: 'archived' as EventStatus }]
  }
```

Quitar los símbolos `●`, `⏸` y `✕` de las etiquetas: son decoración de texto y el estándar es Lucide.

- [ ] **Step 4: `handleStatusChange` deja de asumir que el cambio entró**

El código de hoy pinta el cambio y dispara el `update` sin mirar el resultado. Con el trigger, reactivar sin cupo **falla**, y si no se revisa, la pantalla miente. Reemplazar por:

```ts
  const handleStatusChange = async (event: EventWithStats, newStatus: EventStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    if (event.is_shared) return
    const anterior = event.event_status
    setMyEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, event_status: newStatus } : ev))
    const { data, error } = await supabase
      .from('events')
      .update({ event_status: newStatus })
      .eq('id', event.id)
      .select('id')
    if (error || !data?.length) {
      setMyEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, event_status: anterior } : ev))
      if (esErrorDeCupo(error)) setMuroLimite(getActiveEventLimit(userPlan, userEmail))
    }
  }
```

`userPlan` y `userEmail` salen de la carga de perfil que ya hace el dashboard; si no existen como estado, agregarlos al mismo `select` de `users` que ya se hace ahí.

**El `.select('id')` no es opcional.** Un `update` que RLS filtra devuelve cero filas **sin error**; contar las filas es la única forma de saber si entró. Es el fallo mudo que ya mordió dos veces en este proyecto (el editor de invitación y el cambio de plan en `/admin`).

- [ ] **Step 5: Verificar a mano**

Archivar un evento → sale de Activos, aparece en Archivados, y el contador de la pestaña cuadra. Reactivar con cupo → vuelve a Activos. Reactivar sin cupo → **no** se mueve y aparece el muro.

- [ ] **Step 6: Typecheck y commit**

```bash
npx tsc --noEmit
npm test
git add app/dashboard/page.tsx
git commit -m "feat(muro): dashboard con activos pasados y archivados"
```

---

### Task 10: El evento archivado se abre en solo lectura

**Files:**
- Modify: `lib/event-access-context.tsx:60-70` (la query), `:128-133` (los permisos derivados), la interfaz del context
- Modify: `app/events/[id]/layout.tsx:374-384` (`getDisplayStatus`) y el contenedor donde se pinta el banner
- Modify: `app/events/[id]/page.tsx:1742`, `app/events/[id]/timeline/page.tsx:252`, `app/events/[id]/presupuesto/page.tsx:179-185`

**Interfaces:**
- Consumes: `esArchivado`, `estadoEvento`, `type EstadoEvento` de `lib/events/estado.ts` (Tarea 2) · `MuroEventosModal` (Tarea 7) · `esErrorDeCupo` de `lib/capacity.ts` (Tarea 5).
- Produces: el context expone `isArchived: boolean`, y `canEdit` pasa a significar "el rol permite **y** el evento no está archivado".

- [ ] **Step 1: El context aprende que el evento está archivado**

En `lib/event-access-context.tsx`, agregar `isArchived: boolean` a `EventAccessContextType` y a su valor por defecto (`false`). Extender la query del evento:

```ts
          supabase.from('events').select('user_id, event_type, event_status').eq('id', eventId).single(),
```

Guardar el estado con `const [archived, setArchived] = useState(false)` y, dentro del `if (event)`, `setArchived(esArchivado(event.event_status))`.

Y cambiar la derivación de permisos:

```ts
  const isOwner = role === 'owner'
  const canAdmin = (role === 'owner' || role === 'admin') && !archived
  const canEdit = (role === 'owner' || role === 'admin' || role === 'editor') && !archived
  const canInvite = (role === 'owner' || role === 'admin') && !archived
```

`isOwner` y `hasAccess` **no** cambian: siguen diciendo quién es, no qué puede hacer. Exponer `isArchived: archived` en el provider.

- [ ] **Step 2: El banner en el layout del evento**

En `app/events/[id]/layout.tsx`, reemplazar `getDisplayStatus` por el módulo compartido:

```ts
  const estado = event ? estadoEvento(event, new Date()) : 'activo'
```

y ajustar los usos de `'paused' | 'cancelled' | 'completed'` a `EstadoEvento`.

Arriba del contenido de la página, cuando `estado === 'archivado'`, pintar:

```tsx
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#e8e8e8] bg-[#f8f8f8] px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Archive size={15} className="shrink-0 text-[#888]" />
            <span>Este evento está archivado. Solo lectura.</span>
          </div>
          <button
            onClick={reactivar}
            className="shrink-0 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Reactivar
          </button>
        </div>
```

`Archive` viene de `lucide-react`. `reactivar` hace el mismo `update` con `.select('id')` de la Tarea 9: si vuelve vacío o con error de cupo, abre `<MuroEventosModal>`; si entra, recarga la página.

- [ ] **Step 3: Apagar los botones de las tres pantallas donde más se escribe**

En cada una, sacar `canEdit` del hook (`const { canEdit } = useEventAccess()`) y envolver el disparador principal:

- `app/events/[id]/page.tsx:1742` — el botón que hace `setShowModal(true)` (alta de invitado): `{canEdit && ( ...ese botón... )}`.
- `app/events/[id]/timeline/page.tsx:252` — `openNew`: agregar `if (!canEdit) return` como primera línea, y esconder el botón que la llama.
- `app/events/[id]/presupuesto/page.tsx:179-185` — las dos funciones que hacen `setModalOpen(true)`: mismo tratamiento.

- [ ] **Step 4: Verificar a mano, incluido el candado de la base**

Archivar un evento y abrirlo: sale el banner, los tres botones desaparecen. Después de que Diego corra el **bloque 2** del SQL, intentar escribir desde un rincón no cubierto (por ejemplo, editar una partida de presupuesto ya existente): debe fallar. Confirmar además que un RSVP que entra por WhatsApp a ese mismo evento **sí** se registra.

- [ ] **Step 5: Typecheck y commit**

```bash
npx tsc --noEmit
git add lib/event-access-context.tsx "app/events/[id]/layout.tsx" "app/events/[id]/page.tsx" "app/events/[id]/timeline/page.tsx" "app/events/[id]/presupuesto/page.tsx"
git commit -m "feat(muro): el evento archivado se abre en solo lectura"
```

---

### Task 11: `/admin` con los planes vivos

Hoy el selector ofrece `free` / `pro` / `agency`, que ya no son los planes del producto. `VALID_PLANS` sale de `Object.keys(PLAN_PRICES)`, así que arreglar `lib/billing.ts` propaga solo a la validación.

**Files:**
- Modify: `lib/billing.ts:5-9` (`PLAN_PRICES`) y `:70-79` (`byPlan` de `getBillingSummary`)
- Modify: `app/admin/UsuariosTab.tsx:190-194` y `:334` (los dos selectores)
- Modify: `app/admin/lib/format.ts:20-24` (`PLAN_STYLES`)
- Modify: `app/admin/page.tsx:125-127`, `app/admin/lib/metrics.ts:70-72`, `app/admin/MarketingTab.tsx:29`

**Interfaces:**
- Consumes: `ORGANIZADOR_PLANS` de `lib/pricing.ts` y `PLAN_IDS`, `normalizePlan` de `lib/entitlements.ts` (Tarea 1).
- Produces: `PLAN_PRICES` con los ids vivos.

- [ ] **Step 1: `PLAN_PRICES` sale del catálogo**

En `lib/billing.ts`, reemplazar el objeto literal por:

```ts
import { ORGANIZADOR_PLANS } from './pricing'

// Precio de lista por plan. Hoy nadie cobra todavia: el MRR de /admin es una
// estimacion sobre el plan asignado a mano, no un cobro real.
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  ...Object.fromEntries(ORGANIZADOR_PLANS.map(p => [p.id, p.listMonthly])),
}
```

En `getBillingSummary`, cambiar `byPlan` para que cuente los planes vivos:

```ts
    byPlan: Object.fromEntries(
      Object.keys(PLAN_PRICES).map(id => [id, rows.filter(r => r.plan === id).length]),
    ) as Record<string, number>,
```

y ajustar el tipo `BillingSummary.byPlan` a `Record<string, number>`.

- [ ] **Step 2: Los selectores de `/admin` ofrecen los planes vivos**

En los dos lugares de `UsuariosTab.tsx` que hoy tienen las tres `<option>` fijas:

```tsx
                        {PLAN_IDS.map(id => (
                          <option key={id} value={id}>{id}</option>
                        ))}
```

con `import { PLAN_IDS } from '@/lib/entitlements'`.

- [ ] **Step 3: Los colores de la píldora cubren los cuatro planes**

En `app/admin/lib/format.ts`:

```ts
export const PLAN_STYLES: Record<string, string> = {
  free:   'bg-[#f0f0f0] text-[#666]',
  solo:   'bg-[#e8faf6] text-[#1a7a60]',
  studio: 'bg-[#e8faf6] text-[#1a7a60]',
  agency: 'bg-[#fff3cd] text-[#856404]',
  pro:    'bg-[#e8faf6] text-[#1a7a60]',
}
```

`pro` se queda por las cuentas que todavía lo traigan hasta que Diego corra el `update`.

- [ ] **Step 4: Los conteos por plan dejan de estar escritos a mano**

En `app/admin/page.tsx:125-127`, `app/admin/lib/metrics.ts:70-72` y `app/admin/MarketingTab.tsx:29`, reemplazar las comparaciones contra `'pro'` y `'agency'` por `isPlanner(u.plan)` (importado de `@/lib/entitlements`) donde la pregunta sea "¿es de pago?", y por un conteo sobre `PLAN_IDS` donde la pregunta sea "¿cuántos hay de cada uno?".

- [ ] **Step 5: Verificar a mano**

Entrar a `/admin` con `diego.garza@moonlaunch.mx`: el selector ofrece los cuatro planes, cambiar uno se guarda y avisa (ya valida por filas afectadas), y la tarjeta de MRR no se va a cero.

- [ ] **Step 6: Typecheck, tests y commit**

```bash
npx tsc --noEmit
npm test
git add lib/billing.ts app/admin/UsuariosTab.tsx app/admin/lib/format.ts app/admin/page.tsx app/admin/lib/metrics.ts app/admin/MarketingTab.tsx
git commit -m "feat(muro): admin con los planes vivos del producto"
```

---

## Cierre: el recorrido a producción

Después de la Tarea 11, y **solo con el visto bueno de Diego**:

1. `npm run build` en el worktree. Verde antes de seguir.
2. Push de la rama y probar en el preview de Vercel. **Ojo:** el preview comparte la base de producción, así que el bloque 1 del SQL ya afecta a usuarios reales cuando se corra.
3. Diego corre el **bloque 1** (cupo).
4. Merge a `main` y esperar el deploy.
5. Diego corre el **bloque 2** (solo lectura) y luego el **bloque 3** (migración).
6. Diego corre, si decide re-significar el plan viejo: `update users set plan = 'studio' where plan = 'pro';`
7. Agregar el release a `lib/changelog.ts` (`CURRENT_VERSION` + entrada) para que el `WhatsNewModal` lo anuncie.
