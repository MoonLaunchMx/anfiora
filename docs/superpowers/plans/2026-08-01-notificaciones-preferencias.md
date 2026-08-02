# Notificaciones: preferencias por tipo + cron de recordatorios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los recordatorios del timeline se envíen de verdad, y que el usuario pueda elegir qué tipos de notificación recibe.

**Architecture:** Las preferencias viven en `users.settings` (JSONB que ya existe) y se hacen cumplir dentro de `sendPushToUsers`, que pasa a exigir el tipo como parámetro. Un cron externo en GitHub Actions llama cada 15 minutos a `/api/cron/reminders`, que reclama tareas vencidas con una función RPC atómica y envía un push al asignado. Toda la lógica de decisión se extrae a funciones puras en `lib/notifications/` para poder probarla con Vitest.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (postgres + RPC), `web-push` (VAPID, RFC 8030), Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-01-notificaciones-preferencias-design.md`

## Global Constraints

- Idioma de la UI: **español con acentos**. Mensajes de commit: **sin acentos ni ñ**.
- Nada de emojis en la UI. Iconos de Lucide React.
- Solo Tailwind. Teal `#48C9B0` para lo activo, `#d8d8d8` para lo inactivo. Negro `#1D1E20` solo en dropdowns de filtro (no aplica aquí).
- **Ninguna tabla nueva.** Solo una columna, un índice y una función en la base.
- Sin comentarios en el código salvo cuando el *porqué* no es obvio.
- Vitest solo para lógica pura. La UI y los endpoints con I/O se verifican manualmente.
- **No se toca el comportamiento de los estados del evento.** El cron replica la guarda existente: calla en `cancelled` y `completed`, los `paused` siguen avisando.
- Nunca `git push` sin permiso explícito de Diego. Nunca aplicar SQL en Supabase sin que el código esté en `origin/main`.
- Al actualizar `users`, **verificar filas afectadas con `.select()`**: un UPDATE filtrado por RLS no devuelve error, devuelve cero filas.

---

### Task 1: Tipos y preferencias

**Files:**
- Modify: `lib/types.ts` (agregar al final)
- Create: `lib/notifications/prefs.ts`
- Test: `lib/notifications/prefs.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `PushType`, `NotificationPrefs`, `PUSH_TYPES` desde `@/lib/types`. `readPrefs(settings: unknown): NotificationPrefs`, `isTypeEnabled(settings: unknown, type: PushType): boolean`, `withPref(settings: unknown, type: PushType, value: boolean): Record<string, unknown>` desde `@/lib/notifications/prefs`.

- [ ] **Step 1: Agregar los tipos a `lib/types.ts`**

Agregar al final del archivo, sin tocar nada existente:

```ts
export type PushType = 'guest_replies' | 'task_reminders' | 'payment_due'

export type NotificationPrefs = Partial<Record<PushType, boolean>>

export const PUSH_TYPES: { type: PushType; label: string; hint: string }[] = [
  { type: 'guest_replies',  label: 'Respuestas de invitados', hint: 'Cuando alguien contesta tu invitación' },
  { type: 'task_reminders', label: 'Recordatorios de tareas', hint: 'A la hora que programaste en el timeline' },
  { type: 'payment_due',    label: 'Pagos por vencer',        hint: 'Recordatorios de tareas de tipo pago' },
]
```

- [ ] **Step 2: Escribir la prueba que falla**

Crear `lib/notifications/prefs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readPrefs, isTypeEnabled, withPref } from './prefs'

describe('isTypeEnabled', () => {
  it('sin settings guardados: todo activado', () => {
    expect(isTypeEnabled(null, 'task_reminders')).toBe(true)
    expect(isTypeEnabled(undefined, 'guest_replies')).toBe(true)
    expect(isTypeEnabled({}, 'payment_due')).toBe(true)
  })

  it('settings sin la llave notifications: activado', () => {
    expect(isTypeEnabled({ otra_cosa: 1 }, 'task_reminders')).toBe(true)
  })

  it('solo false apaga; el resto de los tipos siguen activos', () => {
    const settings = { notifications: { task_reminders: false } }
    expect(isTypeEnabled(settings, 'task_reminders')).toBe(false)
    expect(isTypeEnabled(settings, 'guest_replies')).toBe(true)
  })

  it('true explicito: activado', () => {
    expect(isTypeEnabled({ notifications: { payment_due: true } }, 'payment_due')).toBe(true)
  })
})

describe('readPrefs', () => {
  it('devuelve objeto vacio cuando no hay nada util', () => {
    expect(readPrefs(null)).toEqual({})
    expect(readPrefs('texto')).toEqual({})
    expect(readPrefs({ notifications: 'no-es-objeto' })).toEqual({})
  })
})

describe('withPref', () => {
  it('conserva otras llaves de settings', () => {
    const out = withPref({ tema: 'oscuro', notifications: { guest_replies: false } }, 'payment_due', false)
    expect(out.tema).toBe('oscuro')
    expect(out.notifications).toEqual({ guest_replies: false, payment_due: false })
  })

  it('funciona desde settings nulo', () => {
    expect(withPref(null, 'task_reminders', false)).toEqual({ notifications: { task_reminders: false } })
  })

  it('sobrescribe el mismo tipo sin duplicar', () => {
    const out = withPref({ notifications: { task_reminders: false } }, 'task_reminders', true)
    expect(out.notifications).toEqual({ task_reminders: true })
  })
})
```

- [ ] **Step 3: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/notifications/prefs.test.ts`
Expected: FAIL, no encuentra el módulo `./prefs`.

- [ ] **Step 4: Escribir la implementación mínima**

Crear `lib/notifications/prefs.ts`:

```ts
import type { PushType, NotificationPrefs } from '@/lib/types'

export function readPrefs(settings: unknown): NotificationPrefs {
  if (!settings || typeof settings !== 'object') return {}
  const raw = (settings as Record<string, unknown>).notifications
  if (!raw || typeof raw !== 'object') return {}
  return raw as NotificationPrefs
}

// Ausencia significa activado: los usuarios que ya tenian push antes de esta
// feature no se quedan mudos, y no hace falta backfill.
export function isTypeEnabled(settings: unknown, type: PushType): boolean {
  return readPrefs(settings)[type] !== false
}

export function withPref(
  settings: unknown,
  type: PushType,
  value: boolean,
): Record<string, unknown> {
  const base =
    settings && typeof settings === 'object' ? { ...(settings as Record<string, unknown>) } : {}
  base.notifications = { ...readPrefs(settings), [type]: value }
  return base
}
```

- [ ] **Step 5: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/notifications/prefs.test.ts`
Expected: PASS, 8 pruebas.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/notifications/prefs.ts lib/notifications/prefs.test.ts
git commit -m "feat(notificaciones): tipos y lectura de preferencias por tipo"
```

---

### Task 2: `lib/push.ts` exige el tipo, filtra y manda las cabeceras del estandar

**Files:**
- Modify: `lib/push.ts` (reemplazo completo del archivo)
- Modify: `lib/omnichannel/notify.ts:27` y `:55`
- Modify: `app/api/push/test/route.ts` (reemplazo completo)

**Interfaces:**
- Consumes: `PushType` de `@/lib/types`, `isTypeEnabled` de `@/lib/notifications/prefs` (Task 1).
- Produces: `sendPushToUsers(userIds: string[], payload: PushPayload, type: PushType): Promise<void>` — el tercer parámetro es **obligatorio**. `sendTestPush(userId: string, payload: PushPayload): Promise<void>` — omite las preferencias a propósito. `PushPayload` gana `ttl?: number` y `topic?: string`, que **no** viajan al Service Worker.

- [ ] **Step 1: Reemplazar `lib/push.ts` completo**

```ts
import 'server-only'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import type { PushType } from '@/lib/types'
import { isTypeEnabled } from '@/lib/notifications/prefs'

const VAPID_SUBJECT = process.env.VAPID_SUBJECT
const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

let configured = false

function ensureConfigured(): boolean {
  if (configured) return true
  if (!VAPID_SUBJECT || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys ausentes - push deshabilitado')
    return false
  }
  const subject =
    VAPID_SUBJECT.startsWith('mailto:') || VAPID_SUBJECT.startsWith('http')
      ? VAPID_SUBJECT
      : `mailto:${VAPID_SUBJECT}`
  webpush.setVapidDetails(subject, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  renotify?: boolean
  ttl?: number
  topic?: string
}

const DEFAULT_TTL_SECONDS = 3 * 24 * 60 * 60

const URGENCY_BY_TYPE: Record<PushType, 'normal' | 'high'> = {
  guest_replies:  'normal',
  task_reminders: 'high',
  payment_due:    'high',
}

// RFC 8030 limita Topic a 32 caracteres del alfabeto base64url. Un valor
// invalido haria fallar el envio entero, asi que se descarta en vez de mandarse.
const TOPIC_RE = /^[A-Za-z0-9_-]{1,32}$/

async function deliver(
  userIds: string[],
  payload: PushPayload,
  urgency: 'normal' | 'high',
): Promise<void> {
  if (userIds.length === 0) return

  const supabase = admin()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (error) {
    console.error('[push] no se pudieron leer las suscripciones:', error.message)
    return
  }
  if (!subs || subs.length === 0) return

  const { ttl, topic, ...clientPayload } = payload
  const body = JSON.stringify(clientPayload)

  const options: { TTL: number; urgency: 'normal' | 'high'; topic?: string } = {
    TTL: ttl ?? DEFAULT_TTL_SECONDS,
    urgency,
  }
  if (topic) {
    if (TOPIC_RE.test(topic)) options.topic = topic
    else console.warn('[push] topic invalido, se omite:', topic)
  }

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          options
        )
      } catch (err: any) {
        const status = err?.statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[push] envio fallido', status, err?.message ?? err)
        }
      }
    })
  )
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  type: PushType,
): Promise<void> {
  if (!ensureConfigured()) return

  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return

  const { data: users, error } = await admin()
    .from('users')
    .select('id, settings')
    .in('id', ids)

  if (error) {
    console.error('[push] no se pudieron leer las preferencias:', error.message)
    return
  }

  const wanted = (users ?? []).filter((u) => isTypeEnabled(u.settings, type)).map((u) => u.id)
  await deliver(wanted, payload, URGENCY_BY_TYPE[type])
}

// Diagnostico: debe llegar aunque el usuario haya apagado tipos, o el boton de
// prueba mentiria justo cuando mas se necesita.
export async function sendTestPush(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return
  await deliver([userId], payload, 'high')
}

export async function resolveEventRecipients(eventId: string, actorUserId?: string): Promise<string[]> {
  const supabase = admin()
  const recipients = new Set<string>()

  const { data: event } = await supabase
    .from('events')
    .select('user_id')
    .eq('id', eventId)
    .single()
  if (event?.user_id) recipients.add(event.user_id)

  const { data: collaborators } = await supabase
    .from('event_collaborators')
    .select('user_id, role')
    .eq('event_id', eventId)
    .eq('status', 'active')
    .in('role', ['admin', 'editor'])
  for (const c of collaborators ?? []) {
    if (c.user_id) recipients.add(c.user_id)
  }

  if (actorUserId) recipients.delete(actorUserId)
  return [...recipients]
}
```

- [ ] **Step 2: Verificar que la compilacion rompe en los 3 call sites**

Run: `npx tsc --noEmit`
Expected: FAIL con errores de "Expected 3 arguments, but got 2" en `lib/omnichannel/notify.ts` (dos veces) y en `app/api/push/test/route.ts`. **Es el resultado deseado**: el tipo obligatorio es lo que impide que un disparador se salte las preferencias.

- [ ] **Step 3: Actualizar `lib/omnichannel/notify.ts`**

En la llamada de la rama `accion_necesaria` (línea ~27), agregar `topic` y el tipo:

```ts
      await sendPushToUsers(recipients, {
        title: a.eventName,
        body: `${a.guestName} necesita tu atención.`,
        url: `/events/${a.eventId}/mensajes`,
        tag: `event-${a.eventId}-accion-${a.guestId}`,
        renotify: true,
        topic: a.guestId.replace(/-/g, ''),
      }, 'guest_replies')
      return
```

En la llamada final (línea ~55):

```ts
    await sendPushToUsers(recipients, {
      title: a.eventName,
      body,
      url: `/events/${a.eventId}/mensajes`,
      tag: `event-${a.eventId}`,
      renotify: true,
      topic: a.eventId.replace(/-/g, ''),
    }, 'guest_replies')
```

- [ ] **Step 4: Reemplazar `app/api/push/test/route.ts` completo**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTestPush } from '@/lib/push'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await admin().auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Sin tag: cada prueba crea su propia notificacion en vez de reemplazar la
  // anterior, que hacia parecer que la segunda nunca habia llegado.
  await sendTestPush(user.id, {
    title: 'Anfiora',
    body: 'Notificacion de prueba. Si la ves, las notificaciones funcionan en este dispositivo.',
    url: '/dashboard',
    ttl: 60,
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Verificar que compila y que nada mas se rompio**

Run: `npx tsc --noEmit`
Expected: PASS, sin errores.

Run: `npx vitest run`
Expected: PASS, toda la suite existente sigue verde.

- [ ] **Step 6: Commit**

```bash
git add lib/push.ts lib/omnichannel/notify.ts app/api/push/test/route.ts
git commit -m "feat(push): tipo obligatorio, filtro por preferencias y cabeceras TTL/Topic/Urgency"
```

---

### Task 3: Logica pura de recordatorios

**Files:**
- Create: `lib/notifications/reminders.ts`
- Test: `lib/notifications/reminders.test.ts`

**Interfaces:**
- Consumes: `PushType` de `@/lib/types`.
- Produces: los tipos `ReminderTask`, `ReminderEvent`, `ReminderCollaborator`, `SkipReason`; y las funciones `taskMoment(task): Date | null`, `ttlSeconds(moment: Date | null, now: Date): number`, `reminderSkipReason(task, event, now): SkipReason`, `resolveReminderRecipient(task, event, collaborators): string | null`, `reminderPushType(task): PushType`, `pushTopic(id: string): string`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/notifications/reminders.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  taskMoment,
  ttlSeconds,
  reminderSkipReason,
  resolveReminderRecipient,
  reminderPushType,
  pushTopic,
  DEFAULT_REMINDER_TTL,
  type ReminderTask,
  type ReminderEvent,
} from './reminders'

const task = (over: Partial<ReminderTask> = {}): ReminderTask => ({
  id: '11111111-2222-3333-4444-555555555555',
  event_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  title: 'Probar menu',
  category: 'tarea',
  task_date: '2026-08-10',
  task_time: '18:00:00',
  assigned_to_user_id: null,
  ...over,
})

const evento = (over: Partial<ReminderEvent> = {}): ReminderEvent => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  user_id: 'owner-1',
  name: 'Boda Ana y Luis',
  event_status: 'active',
  ...over,
})

describe('taskMoment', () => {
  it('combina fecha y hora en la zona del evento (UTC-6)', () => {
    expect(taskMoment(task())?.toISOString()).toBe('2026-08-11T00:00:00.000Z')
  })

  it('sin hora, la tarea vence al final del dia', () => {
    expect(taskMoment(task({ task_time: null }))?.toISOString()).toBe('2026-08-11T05:59:59.000Z')
  })

  it('acepta hora sin segundos', () => {
    expect(taskMoment(task({ task_time: '18:00' }))?.toISOString()).toBe('2026-08-11T00:00:00.000Z')
  })

  it('sin fecha no hay momento', () => {
    expect(taskMoment(task({ task_date: null }))).toBeNull()
  })
})

describe('ttlSeconds', () => {
  it('cuenta los segundos que faltan', () => {
    const now = new Date('2026-08-10T23:00:00.000Z')
    expect(ttlSeconds(new Date('2026-08-11T00:00:00.000Z'), now)).toBe(3600)
  })

  it('nunca es negativo', () => {
    const now = new Date('2026-08-12T00:00:00.000Z')
    expect(ttlSeconds(new Date('2026-08-11T00:00:00.000Z'), now)).toBe(0)
  })

  it('sin momento usa el default', () => {
    expect(ttlSeconds(null, new Date())).toBe(DEFAULT_REMINDER_TTL)
  })
})

describe('reminderSkipReason', () => {
  const now = new Date('2026-08-09T12:00:00.000Z')

  it('evento activo y tarea futura: se envia', () => {
    expect(reminderSkipReason(task(), evento(), now)).toBeNull()
  })

  it('evento cancelado: no se envia', () => {
    expect(reminderSkipReason(task(), evento({ event_status: 'cancelled' }), now)).toBe('evento_no_activo')
  })

  it('evento completado: no se envia', () => {
    expect(reminderSkipReason(task(), evento({ event_status: 'completed' }), now)).toBe('evento_no_activo')
  })

  it('evento pausado: SI se envia, igual que hoy en los webhooks', () => {
    expect(reminderSkipReason(task(), evento({ event_status: 'paused' }), now)).toBeNull()
  })

  it('evento que no existe: no se envia', () => {
    expect(reminderSkipReason(task(), null, now)).toBe('evento_no_activo')
  })

  it('tarea que ya paso: no se envia', () => {
    const tarde = new Date('2026-08-12T00:00:00.000Z')
    expect(reminderSkipReason(task(), evento(), tarde)).toBe('tarea_ya_paso')
  })

  it('tarea sin fecha: se envia, no hay como saber que caduco', () => {
    expect(reminderSkipReason(task({ task_date: null }), evento(), now)).toBeNull()
  })
})

describe('resolveReminderRecipient', () => {
  it('sin asignado: al owner', () => {
    expect(resolveReminderRecipient(task(), evento(), [])).toBe('owner-1')
  })

  it('asignado colaborador activo: a el, no al owner', () => {
    const t = task({ assigned_to_user_id: 'colab-1' })
    const colabs = [{ user_id: 'colab-1', status: 'active' }]
    expect(resolveReminderRecipient(t, evento(), colabs)).toBe('colab-1')
  })

  it('asignado que perdio el acceso: cae al owner', () => {
    const t = task({ assigned_to_user_id: 'colab-1' })
    const colabs = [{ user_id: 'colab-1', status: 'revoked' }]
    expect(resolveReminderRecipient(t, evento(), colabs)).toBe('owner-1')
  })

  it('asignado que es el propio owner: al owner', () => {
    const t = task({ assigned_to_user_id: 'owner-1' })
    expect(resolveReminderRecipient(t, evento(), [])).toBe('owner-1')
  })

  it('asignado por nombre libre (sin user_id): cae al owner', () => {
    expect(resolveReminderRecipient(task({ assigned_to_user_id: null }), evento(), [])).toBe('owner-1')
  })

  it('evento sin owner: no hay a quien avisar', () => {
    expect(resolveReminderRecipient(task(), evento({ user_id: null }), [])).toBeNull()
  })
})

describe('reminderPushType', () => {
  it('categoria pago es pago por vencer', () => {
    expect(reminderPushType(task({ category: 'pago' }))).toBe('payment_due')
  })

  it('cualquier otra categoria es recordatorio de tarea', () => {
    expect(reminderPushType(task({ category: 'entrega' }))).toBe('task_reminders')
    expect(reminderPushType(task({ category: null }))).toBe('task_reminders')
  })
})

describe('pushTopic', () => {
  it('un uuid sin guiones mide exactamente 32, el limite de RFC 8030', () => {
    const topic = pushTopic('11111111-2222-3333-4444-555555555555')
    expect(topic).toBe('11111111222233334444555555555555')
    expect(topic.length).toBe(32)
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/notifications/reminders.test.ts`
Expected: FAIL, no encuentra el módulo `./reminders`.

- [ ] **Step 3: Escribir la implementacion minima**

Crear `lib/notifications/reminders.ts`:

```ts
import type { PushType } from '@/lib/types'

// task_date es `date` y task_time es `time without time zone`: no guardan zona.
// Mexico no aplica horario de verano desde 2022, asi que un offset fijo es
// exacto para el mercado actual. Solo afecta la caducidad, no el momento del
// envio, que lo gobierna reminder_date (timestamptz).
export const EVENT_UTC_OFFSET = '-06:00'

export const DEFAULT_REMINDER_TTL = 24 * 60 * 60

export type ReminderTask = {
  id: string
  event_id: string
  title: string | null
  category: string | null
  task_date: string | null
  task_time: string | null
  assigned_to_user_id: string | null
}

export type ReminderEvent = {
  id: string
  user_id: string | null
  name: string | null
  event_status: string | null
}

export type ReminderCollaborator = {
  user_id: string | null
  status: string | null
}

export type SkipReason = 'evento_no_activo' | 'tarea_ya_paso' | null

function normalizeTime(raw: string): string {
  return raw.length === 5 ? `${raw}:00` : raw.slice(0, 8)
}

export function taskMoment(task: ReminderTask): Date | null {
  if (!task.task_date) return null
  const time = task.task_time ? normalizeTime(task.task_time) : '23:59:59'
  const parsed = new Date(`${task.task_date}T${time}${EVENT_UTC_OFFSET}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function ttlSeconds(moment: Date | null, now: Date): number {
  if (!moment) return DEFAULT_REMINDER_TTL
  return Math.max(0, Math.floor((moment.getTime() - now.getTime()) / 1000))
}

export function reminderSkipReason(
  task: ReminderTask,
  event: ReminderEvent | null,
  now: Date,
): SkipReason {
  if (!event) return 'evento_no_activo'
  if (event.event_status === 'cancelled' || event.event_status === 'completed') {
    return 'evento_no_activo'
  }
  const moment = taskMoment(task)
  if (moment && moment.getTime() <= now.getTime()) return 'tarea_ya_paso'
  return null
}

export function resolveReminderRecipient(
  task: ReminderTask,
  event: ReminderEvent,
  collaborators: ReminderCollaborator[],
): string | null {
  const assigned = task.assigned_to_user_id
  if (assigned) {
    if (assigned === event.user_id) return assigned
    if (collaborators.some((c) => c.user_id === assigned && c.status === 'active')) return assigned
  }
  return event.user_id ?? null
}

export function reminderPushType(task: ReminderTask): PushType {
  return task.category === 'pago' ? 'payment_due' : 'task_reminders'
}

export function pushTopic(id: string): string {
  return id.replace(/-/g, '')
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/notifications/reminders.test.ts`
Expected: PASS, 23 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/reminders.ts lib/notifications/reminders.test.ts
git commit -m "feat(notificaciones): logica pura de recordatorios con TTL derivado del dato"
```

---

### Task 4: SQL de la columna, el indice y la funcion de reclamo

**Files:**
- Create: `docs/superpowers/plans/2026-08-01-notificaciones-preferencias.sql`

**Interfaces:**
- Consumes: nada.
- Produces: la columna `event_timeline_tasks.reminder_sent_at`, el índice parcial `event_timeline_tasks_reminder_pending_idx`, y la función RPC `claim_due_reminders(max_rows INT)` que devuelve `SETOF event_timeline_tasks`. La consume la Task 5.

**Nota:** este archivo NO se ejecuta en esta tarea. Se aplica en Supabase durante la Task 8, después de que el código esté en `origin/main`.

- [ ] **Step 1: Crear el archivo SQL**

```sql
-- Notificaciones: preferencias por tipo + cron de recordatorios
-- Aplicar en Supabase SOLO despues de pushear el codigo a origin/main
-- (regla de sincronia Supabase <-> Vercel).

-- 1. Anti-duplicado del cron.
ALTER TABLE event_timeline_tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 2. Indice parcial: solo indexa las filas que el cron puede llegar a tocar.
CREATE INDEX IF NOT EXISTS event_timeline_tasks_reminder_pending_idx
  ON event_timeline_tasks (reminder_date)
  WHERE reminder_sent_at IS NULL AND is_completed = false;

-- 3. Reclamo atomico. Va en una funcion porque supabase.update() no admite
--    LIMIT y el tope por corrida es necesario para acotar el tiempo de
--    ejecucion. FOR UPDATE SKIP LOCKED permite que dos corridas simultaneas
--    tomen filas distintas en vez de bloquearse o pisarse.
CREATE OR REPLACE FUNCTION claim_due_reminders(max_rows INT DEFAULT 200)
RETURNS SETOF event_timeline_tasks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE event_timeline_tasks
     SET reminder_sent_at = now()
   WHERE id IN (
     SELECT id
       FROM event_timeline_tasks
      WHERE reminder_sent_at IS NULL
        AND reminder_date IS NOT NULL
        AND reminder_date <= now()
        AND is_completed = false
      ORDER BY reminder_date
      LIMIT max_rows
      FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
$$;

-- Solo el service role la ejecuta; el cliente del navegador no debe poder
-- marcar recordatorios como enviados.
REVOKE EXECUTE ON FUNCTION claim_due_reminders(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_due_reminders(INT) TO service_role;
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-08-01-notificaciones-preferencias.sql
git commit -m "chore(sql): columna reminder_sent_at, indice parcial y claim_due_reminders"
```

---

### Task 5: La ruta `/api/cron/reminders`

**Files:**
- Create: `app/api/cron/reminders/route.ts`

**Interfaces:**
- Consumes: `sendPushToUsers` de `@/lib/push` (Task 2); `taskMoment`, `ttlSeconds`, `reminderSkipReason`, `resolveReminderRecipient`, `reminderPushType`, `pushTopic`, `ReminderTask`, `ReminderEvent`, `ReminderCollaborator` de `@/lib/notifications/reminders` (Task 3); la función `claim_due_reminders` (Task 4).
- Produces: `POST /api/cron/reminders`, que la Task 6 invoca.

- [ ] **Step 1: Crear la ruta**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUsers } from '@/lib/push'
import {
  taskMoment,
  ttlSeconds,
  reminderSkipReason,
  resolveReminderRecipient,
  reminderPushType,
  pushTopic,
  type ReminderTask,
  type ReminderEvent,
  type ReminderCollaborator,
} from '@/lib/notifications/reminders'

const MAX_ROWS = 200

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Comparacion en tiempo constante. Se digieren ambos lados porque
// timingSafeEqual exige buferes de la misma longitud y lanza si no lo son.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  return timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(secret).digest(),
  )
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = admin()
  const now = new Date()
  const stats = {
    claimed: 0,
    sent: 0,
    evento_no_activo: 0,
    tarea_ya_paso: 0,
    sin_destinatario: 0,
  }

  try {
    const { data, error } = await db.rpc('claim_due_reminders', { max_rows: MAX_ROWS })
    if (error) {
      console.error('[cron/reminders] el reclamo fallo:', error.message)
      return NextResponse.json({ error: 'el reclamo fallo' }, { status: 500 })
    }

    const claimed = (data ?? []) as ReminderTask[]
    stats.claimed = claimed.length
    if (claimed.length === 0) return NextResponse.json(stats)

    if (claimed.length === MAX_ROWS) {
      console.warn(`[cron/reminders] tope de ${MAX_ROWS} alcanzado; el resto va en la siguiente corrida`)
    }

    const eventIds = [...new Set(claimed.map((t) => t.event_id))]

    const [eventsRes, collabsRes] = await Promise.all([
      db.from('events').select('id, user_id, name, event_status').in('id', eventIds),
      db.from('event_collaborators').select('event_id, user_id, status').in('event_id', eventIds),
    ])

    if (eventsRes.error) console.error('[cron/reminders] eventos:', eventsRes.error.message)
    if (collabsRes.error) console.error('[cron/reminders] colaboradores:', collabsRes.error.message)

    const eventById = new Map<string, ReminderEvent>()
    for (const e of eventsRes.data ?? []) eventById.set(e.id, e as ReminderEvent)

    const collabsByEvent = new Map<string, ReminderCollaborator[]>()
    for (const c of collabsRes.data ?? []) {
      const list = collabsByEvent.get(c.event_id) ?? []
      list.push({ user_id: c.user_id, status: c.status })
      collabsByEvent.set(c.event_id, list)
    }

    for (const task of claimed) {
      const event = eventById.get(task.event_id) ?? null
      const skip = reminderSkipReason(task, event, now)
      if (skip) {
        stats[skip]++
        continue
      }

      const recipient = resolveReminderRecipient(
        task,
        event as ReminderEvent,
        collabsByEvent.get(task.event_id) ?? [],
      )
      if (!recipient) {
        stats.sin_destinatario++
        continue
      }

      await sendPushToUsers(
        [recipient],
        {
          title: (event as ReminderEvent).name ?? 'Anfiora',
          body: task.title ?? 'Tienes una tarea pendiente',
          url: `/events/${task.event_id}/timeline`,
          tag: `task-${task.id}`,
          renotify: true,
          ttl: ttlSeconds(taskMoment(task), now),
          topic: pushTopic(task.id),
        },
        reminderPushType(task),
      )

      stats.sent++
    }

    return NextResponse.json(stats)
  } catch (e) {
    console.error('[cron/reminders] fallo:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ...stats, error: 'fallo parcial' })
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: los mismos hallazgos preexistentes del repositorio, ninguno nuevo en `app/api/cron/`. Comparar contra `git stash && npm run lint` si hay duda.

- [ ] **Step 3: Probarla en local contra un secreto de prueba**

Agregar `CRON_SECRET=local-de-prueba` a `.env.local`, levantar `npm run dev` y correr:

```bash
curl -i -X POST -H "Authorization: Bearer equivocado" http://localhost:3000/api/cron/reminders
curl -i -X POST -H "Authorization: Bearer local-de-prueba" http://localhost:3000/api/cron/reminders
```

Expected: la primera responde **401**. La segunda responde **500** con `el reclamo fallo`, porque `claim_due_reminders` todavía no existe en la base — eso confirma que la autenticación pasa y que el error se reporta en vez de enterrarse.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/reminders/route.ts
git commit -m "feat(cron): ruta de recordatorios con reclamo atomico y conteo por motivo"
```

---

### Task 6: El workflow de GitHub Actions

**Files:**
- Create: `.github/workflows/reminders.yml`

**Interfaces:**
- Consumes: `POST /api/cron/reminders` (Task 5) y el secreto `CRON_SECRET` del repositorio.
- Produces: nada que consuma código.

**Nota:** nace **solo manual**. El disparo programado se agrega en la Task 8, después de verificar en producción. Así el cron no empieza a correr por el simple hecho de mergear.

- [ ] **Step 1: Crear el workflow**

```yaml
name: Recordatorios

# De momento solo manual. El disparo cada 15 minutos se habilita despues de
# verificar en produccion (ver el plan de despliegue).
on:
  workflow_dispatch:

jobs:
  disparar:
    runs-on: ubuntu-latest
    steps:
      - name: Llamar al cron de recordatorios
        run: |
          curl --fail --silent --show-error --max-time 60 \
            -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://anfiora.com/api/cron/reminders
```

- [ ] **Step 2: Verificar que el YAML es valido**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/reminders.yml','utf8');if(!s.includes('workflow_dispatch'))throw new Error('falta workflow_dispatch');if(s.includes('schedule:'))throw new Error('no debe traer schedule todavia');console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/reminders.yml
git commit -m "chore(cron): workflow de recordatorios, por ahora solo manual"
```

---

### Task 7: Las preferencias en `/perfil`

**Files:**
- Modify: `app/perfil/page.tsx`

**Interfaces:**
- Consumes: `PUSH_TYPES`, `PushType`, `NotificationPrefs` de `@/lib/types`; `readPrefs`, `withPref` de `@/lib/notifications/prefs` (Task 1).
- Produces: nada que consuma código.

- [ ] **Step 1: Agregar los imports**

En la línea 8, junto a los imports existentes:

```ts
import { PUSH_TYPES, type PushType, type NotificationPrefs } from '@/lib/types'
import { readPrefs, withPref } from '@/lib/notifications/prefs'
```

- [ ] **Step 2: Agregar el estado**

Después de la línea 127 (`const [pushMsg, setPushMsg] = ...`):

```ts
  const [prefs, setPrefs]         = useState<NotificationPrefs>({})
  const [prefsBusy, setPrefsBusy] = useState<PushType | null>(null)
```

- [ ] **Step 3: Cargar las preferencias**

En el `load()` del `useEffect`, cambiar el `select` de la línea 140 y agregar el `setPrefs`:

```ts
      const { data } = await supabase
        .from('users')
        .select('full_name, phone, plan, role, settings')
        .eq('id', user.id)
        .single()

      if (data) {
        setName(data.full_name || '')
        setPhone(data.phone || '')
        setPlan(data.plan || 'free')
        setRole(data.role || '')
        setPrefs(readPrefs(data.settings))
      }
```

- [ ] **Step 4: Agregar el manejador**

Junto a `sendTestPush`, después de la línea 343:

```ts
  const togglePref = async (type: PushType) => {
    const next = prefs[type] === false
    const previous = prefs
    setPrefsBusy(type)
    setPushMsg(null)
    setPrefs({ ...prefs, [type]: next })

    const { data: row } = await supabase.from('users').select('settings').eq('id', userId).single()
    const { data: updated, error } = await supabase
      .from('users')
      .update({ settings: withPref(row?.settings, type, next) })
      .eq('id', userId)
      .select('id')

    // Un UPDATE filtrado por RLS no da error, devuelve cero filas: hay que contarlas.
    if (error || !updated || updated.length === 0) {
      setPrefs(previous)
      setPushMsg({ type: 'error', text: 'No se pudo guardar la preferencia. Intenta de nuevo.' })
    }
    setPrefsBusy(null)
  }
```

- [ ] **Step 5: Agregar el bloque de la interfaz**

Entre el botón de prueba (que termina en la línea 531) y el `{pushMsg && ...}` de la línea 533:

```tsx
            {pushSupported && (
              <div className={`mt-6 border-t border-[#f0f0f0] pt-5 ${pushEnabled ? '' : 'opacity-50'}`}>
                <p className="text-xs font-semibold text-[#555]">Qué quieres recibir</p>
                <div className="mt-3 flex flex-col gap-3">
                  {PUSH_TYPES.map(({ type, label, hint }) => {
                    const on = prefs[type] !== false
                    const disabled = !pushEnabled || prefsBusy !== null
                    return (
                      <div key={type} className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm text-[#1D1E20]">{label}</p>
                          <p className="text-[11px] text-[#aaa]">{hint}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={label}
                          disabled={disabled}
                          onClick={() => togglePref(type)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                            ${on ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}
                            ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                              ${on ? 'translate-x-5' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
                {!pushEnabled && (
                  <p className="mt-3 text-[11px] text-[#aaa]">
                    Activa las notificaciones en este dispositivo para elegir qué recibir.
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 6: Verificar que compila y que el lint no empeora**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npx eslint app/perfil/page.tsx`
Expected: los mismos hallazgos que antes del cambio, ninguno nuevo.

- [ ] **Step 7: Verificar a mano en local**

Levantar `npm run dev`, entrar a `/perfil`:

- Con el dispositivo apagado, los tres interruptores se ven en gris y no responden.
- Al activar el dispositivo, los tres aparecen encendidos.
- Apagar uno, recargar la página: sigue apagado.
- Volver a encenderlo, recargar: sigue encendido.

- [ ] **Step 8: Commit**

```bash
git add app/perfil/page.tsx
git commit -m "feat(perfil): interruptores por tipo de notificacion"
```

---

### Task 8: Verificacion en preview y despliegue

**Files:**
- Modify: `.github/workflows/reminders.yml` (agregar el disparo programado, último paso)
- Modify: `CLAUDE.md` (documentar la feature)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la feature viva en producción.

**Esta tarea requiere a Diego.** Hay pasos que solo él puede ejecutar (Vercel, Supabase, secretos de GitHub, y la verificación visual). No marcar ningún paso como hecho sin su confirmación explícita.

- [ ] **Step 1: Confirmar que el PR #31 ya esta mergeado**

Run: `gh pr view 31 --json state,mergedAt`
Expected: `"state": "MERGED"`. Si sigue abierto, **detenerse**: es el primer paso del despliegue y toca el mismo archivo del dashboard.

- [ ] **Step 2: Pedir permiso a Diego y subir la rama**

```bash
git push -u origin feat/notificaciones-preferencias
gh pr create --base main --title "feat(notificaciones): preferencias por tipo y cron de recordatorios" --body "Ver docs/superpowers/specs/2026-08-01-notificaciones-preferencias-design.md"
```

- [ ] **Step 3: Diego verifica las llaves VAPID en preview**

En el despliegue de preview que genera el PR, entrar a `/perfil` y picar "Enviar notificación de prueba".

- Si llega: las llaves están bien en Preview. **Falta confirmar el scope Production** en el panel de Vercel — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` deben estar marcadas para Production, y `VAPID_SUBJECT` debe ser una URL `mailto:` o `https:`, no un correo pelado.
- Si no llega: revisar los logs de la función en Vercel antes de seguir.

- [ ] **Step 4: Diego verifica los interruptores en preview**

- Apagar "Respuestas de invitados", mandar un mensaje desde Telegram a un invitado de prueba: **no debe llegar push**.
- Volver a encenderlo, repetir: **debe llegar**.
- Picar el botón de prueba dos veces seguidas: **deben aparecer dos notificaciones**, no una que reemplaza a la otra.

- [ ] **Step 5: Mergear a main**

Con la aprobación de Diego. El auto-deploy de Vercel publica el código.

- [ ] **Step 6: Diego aplica el SQL en Supabase**

Ejecutar `docs/superpowers/plans/2026-08-01-notificaciones-preferencias.sql` en el editor SQL de Supabase. Verificar después:

```sql
SELECT count(*) FROM event_timeline_tasks WHERE reminder_sent_at IS NOT NULL;
SELECT * FROM claim_due_reminders(0);
```

Expected: el primero devuelve 0. El segundo devuelve cero filas sin error, lo que confirma que la función existe y es ejecutable.

- [ ] **Step 7: Diego carga el CRON_SECRET en los dos lados**

Generar uno: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

- En Vercel: variable `CRON_SECRET`, scope **Production**. Redeploy para que la tome.
- En GitHub: Settings → Secrets and variables → Actions → New repository secret, con el nombre `CRON_SECRET` y **el mismo valor**.

- [ ] **Step 8: Disparar el workflow a mano y leer el resultado**

En GitHub: Actions → Recordatorios → Run workflow.

Expected: verde. En los logs de Vercel debe verse la respuesta con el conteo (`claimed`, `sent`, y los motivos de descarte). Con 3 recordatorios activos en producción, `claimed` debería ser 3 o menos.

Si sale 401, el secreto no coincide entre Vercel y GitHub. Si sale 500, revisar que el SQL se haya aplicado.

- [ ] **Step 9: Encender el disparo programado**

Reemplazar el bloque `on:` de `.github/workflows/reminders.yml`:

```yaml
on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:
```

```bash
git add .github/workflows/reminders.yml
git commit -m "chore(cron): habilitar el disparo cada 15 minutos"
```

Pedir permiso a Diego antes de pushear.

- [ ] **Step 10: Documentar en CLAUDE.md**

Agregar a la sección "Contexto técnico importante":

```markdown
- **Notificaciones push:** el toggle de `/perfil` enciende el dispositivo; los interruptores por tipo viven en `users.settings.notifications` (JSONB) y se hacen cumplir dentro de `sendPushToUsers`, que exige `PushType` como tercer parametro. Ausencia de la llave significa activado. `sendTestPush` omite el filtro a proposito, para que el boton de prueba nunca mienta. Los envios llevan `TTL`, `Topic` y `Urgency` de RFC 8030; `Topic` esta limitado a 32 caracteres, por eso se usa el UUID sin guiones.
- **Cron de recordatorios:** `.github/workflows/reminders.yml` llama cada 15 min a `/api/cron/reminders` con `CRON_SECRET`. La ruta reclama tareas con la funcion `claim_due_reminders` (atomica, `FOR UPDATE SKIP LOCKED`, tope de 200) y avisa **solo al asignado**, o al owner si no hay. Marcha atras: deshabilitar el workflow en GitHub.
```

Corregir además la sección de schema, que sigue llamando `timeline_tasks` a la tabla y omite `reminder_sent_at`.

```bash
git add CLAUDE.md
git commit -m "docs: documentar preferencias de notificacion y cron de recordatorios"
```

- [ ] **Step 11: Verificacion final de punta a punta**

Diego crea una tarea en el timeline de un evento real con recordatorio a 15 minutos, asignada a un colaborador.

Expected: dentro de los siguientes 15 a 30 minutos, **al colaborador** le llega la notificación y **al owner no**.

---

## Notas de implementacion

**Diferencia deliberada con el spec.** El spec dice que la ruta del cron "responde 200 con el conteo" siempre. En el plan, un fallo del reclamo responde **500**: si la función RPC no existe o la base no responde, el cron está roto y GitHub debe marcarlo en rojo. Los fallos parciales —una tarea suelta que no se pudo enviar— sí responden 200 con el conteo, que es lo que el spec buscaba proteger.

**Orden de dependencias.** Las tareas 1 a 3 son independientes entre sí salvo que la 2 consume la 1. La 5 necesita la 2, la 3 y la 4. La 6 necesita la 5. La 7 solo necesita la 1. La 8 va al final y necesita todo.

**Lo que sigue fuera de alcance.** Actividad de colaborador como disparador, canales alternos, horario de silencio, silenciar un evento y campana in-app. Están en el spec como backlog.
