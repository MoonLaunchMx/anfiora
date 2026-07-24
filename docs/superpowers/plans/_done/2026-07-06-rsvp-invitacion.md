# RSVP Invitación digital — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada invitado recibe un link personalizado (`/invitacion/[slug]/[token]`) donde confirma su asistencia y la de sus acompañantes, ve los detalles del evento y engancha a playlist y mesa de regalos; el anfitrión configura y reparte los links desde una pantalla nueva "Invitación".

**Architecture:** Página pública sin login (patrón `/mesa/[token]`) servida por un server component con `generateMetadata` (OG dinámico) que monta un client component. Un API route con service role expone solo datos públicos-seguros por token y escribe las confirmaciones. La lógica pura vive aislada en `lib/invite.ts` con Vitest. La pantalla del anfitrión es un client component más dentro de `app/events/[id]/`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (service role en API routes), Vitest.

## Global Constraints

- Sin tablas nuevas en Supabase; solo columnas aditivas nullable (`guests.rsvp_token`, `event_settings.invite_config`).
- SQL a Supabase SOLO después de pushear el código de la rama (regla sincronía Supabase↔Vercel). Las columnas son aditivas/nullable: no rompen prod.
- Service role (`SUPABASE_SERVICE_ROLE_KEY`) solo en API routes; nunca en el cliente.
- UI en español CON acentos y ñ; mensajes de commit SIN acentos ni ñ, convencionales (`feat:`, `fix:`, `docs:`).
- Solo Tailwind CSS. CTA en teal `#48C9B0`. Fuentes `Josefin Sans` (display) y `General Sans` (body) vía `style={{ fontFamily }}`.
- Sin comentarios salvo WHY no-obvio.
- `RsvpStatus` tiene 6 valores; esta feature solo escribe `'confirmed'` y `'declined'`.
- Dependencias externas (otros agentes, solo lectura, render-if-present): itinerario del día (Timeline, agente B) y código de vestimenta como mood board (agente C). El código debe funcionar aunque esas columnas aún no existan (lectura defensiva).
- Vitest para lógica pura; UI y endpoints con I/O se verifican manual (local → preview → main).
- Ruta pública NO usa `/invite` (ya es la de colaboradores). Es `/invitacion/[slug]/[token]`.
- Commit cada tarea. `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` al final de cada mensaje de commit.

---

### Task 1: Lógica pura de invitación (`lib/invite.ts`)

**Files:**
- Create: `lib/invite.ts`
- Test: `lib/invite.test.ts`

**Interfaces:**
- Produces:
  - `type InviteConfig = { publicada: boolean; mensaje_bienvenida: string; fecha_limite: string | null; mostrar_playlist: boolean; mostrar_mesa: boolean }`
  - `defaultInviteConfig(): InviteConfig`
  - `mergeInviteConfig(raw: unknown): InviteConfig`
  - `randomToken(len?: number, rand?: () => number): string`
  - `slugifyEvent(event: { name: string; host_name?: string | null; host_name_2?: string | null }): string`
  - `resolveInviteHeading(event: { name: string; host_name?: string | null; host_name_2?: string | null }): string`
  - `resolveEventKicker(eventType: string | null | undefined): string`
  - `isInviteOpen(config: InviteConfig, todayISO: string): boolean`
  - `type RsvpSubmission = { guestAttends: boolean; guestAllergies: string[]; guestNotes: string | null; companions: { id?: string; name: string; attends: boolean; allergies: string[] }[] }`
  - `type RsvpUpdate = { guest: { rsvp_status: 'confirmed' | 'declined'; allergies: string[]; notes: string | null }; companions: { id?: string; name: string; rsvp_status: 'confirmed' | 'declined'; allergies: string[] }[] }`
  - `buildRsvpUpdate(sub: RsvpSubmission, opts: { deadlinePassed: boolean }): RsvpUpdate` (throws `Error('deadline_passed')`)

- [ ] **Step 1: Write the failing test**

Create `lib/invite.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  defaultInviteConfig, mergeInviteConfig, randomToken, slugifyEvent,
  resolveInviteHeading, resolveEventKicker, isInviteOpen, buildRsvpUpdate,
} from './invite'

describe('randomToken', () => {
  it('respeta longitud y alfabeto sin ambiguos', () => {
    const seq = [0, 0.2, 0.5, 0.9, 0.1, 0.7, 0.3, 0.99]
    let i = 0
    const rand = () => seq[i++ % seq.length]
    const t = randomToken(8, rand)
    expect(t).toHaveLength(8)
    expect(t).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]+$/)
    expect(t).not.toMatch(/[0O1lIo]/)
  })
})

describe('slugifyEvent', () => {
  it('dos anfitriones -> nombres con y', () => {
    expect(slugifyEvent({ name: 'Boda', host_name: 'Ana', host_name_2: 'Mateo' })).toBe('ana-y-mateo')
  })
  it('sin anfitriones -> nombre del evento sin acentos', () => {
    expect(slugifyEvent({ name: 'Cumpleaños de Adrián' })).toBe('cumpleanos-de-adrian')
  })
})

describe('resolveInviteHeading', () => {
  it('dos anfitriones', () => {
    expect(resolveInviteHeading({ name: 'X', host_name: 'Ana', host_name_2: 'Mateo' })).toBe('Ana & Mateo')
  })
  it('un anfitrion', () => {
    expect(resolveInviteHeading({ name: 'X', host_name: 'Ana' })).toBe('Ana')
  })
  it('ninguno -> nombre del evento', () => {
    expect(resolveInviteHeading({ name: 'Posada 2026' })).toBe('Posada 2026')
  })
})

describe('resolveEventKicker', () => {
  it('boda', () => { expect(resolveEventKicker('boda')).toBe('Nuestra boda') })
  it('default neutral', () => { expect(resolveEventKicker(null)).toBe('Te invitamos') })
})

describe('mergeInviteConfig', () => {
  it('rellena defaults desde objeto vacio', () => {
    expect(mergeInviteConfig({})).toEqual(defaultInviteConfig())
  })
  it('respeta valores dados y descarta basura', () => {
    const c = mergeInviteConfig({ publicada: true, fecha_limite: '2026-02-28', mostrar_playlist: false, extra: 1 })
    expect(c.publicada).toBe(true)
    expect(c.fecha_limite).toBe('2026-02-28')
    expect(c.mostrar_playlist).toBe(false)
    expect(c.mostrar_mesa).toBe(true)
  })
})

describe('isInviteOpen', () => {
  const base = { ...defaultInviteConfig(), publicada: true }
  it('borrador cerrado', () => { expect(isInviteOpen({ ...base, publicada: false }, '2026-01-01')).toBe(false) })
  it('sin fecha limite -> abierto', () => { expect(isInviteOpen({ ...base, fecha_limite: null }, '2026-01-01')).toBe(true) })
  it('antes de la fecha -> abierto', () => { expect(isInviteOpen({ ...base, fecha_limite: '2026-02-28' }, '2026-02-01')).toBe(true) })
  it('despues de la fecha -> cerrado', () => { expect(isInviteOpen({ ...base, fecha_limite: '2026-02-28' }, '2026-03-01')).toBe(false) })
})

describe('buildRsvpUpdate', () => {
  it('confirma invitado y acompanantes', () => {
    const out = buildRsvpUpdate({
      guestAttends: true, guestAllergies: ['Vegetariano'], guestNotes: 'Llegamos tarde',
      companions: [{ id: 'c1', name: 'Sofia', attends: true, allergies: [] }],
    }, { deadlinePassed: false })
    expect(out.guest).toEqual({ rsvp_status: 'confirmed', allergies: ['Vegetariano'], notes: 'Llegamos tarde' })
    expect(out.companions[0]).toEqual({ id: 'c1', name: 'Sofia', rsvp_status: 'confirmed', allergies: [] })
  })
  it('declina', () => {
    const out = buildRsvpUpdate({ guestAttends: false, guestAllergies: [], guestNotes: null, companions: [] }, { deadlinePassed: false })
    expect(out.guest.rsvp_status).toBe('declined')
  })
  it('rechaza si la fecha limite paso', () => {
    expect(() => buildRsvpUpdate({ guestAttends: true, guestAllergies: [], guestNotes: null, companions: [] }, { deadlinePassed: true }))
      .toThrow('deadline_passed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- invite`
Expected: FAIL (no existe `./invite`).

- [ ] **Step 3: Write minimal implementation**

Create `lib/invite.ts`:

```ts
export type InviteConfig = {
  publicada: boolean
  mensaje_bienvenida: string
  fecha_limite: string | null
  mostrar_playlist: boolean
  mostrar_mesa: boolean
}

export function defaultInviteConfig(): InviteConfig {
  return {
    publicada: false,
    mensaje_bienvenida: 'Nos encantaría que nos acompañes en este día tan especial.',
    fecha_limite: null,
    mostrar_playlist: true,
    mostrar_mesa: true,
  }
}

export function mergeInviteConfig(raw: unknown): InviteConfig {
  const d = defaultInviteConfig()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  return {
    publicada: typeof r.publicada === 'boolean' ? r.publicada : d.publicada,
    mensaje_bienvenida: typeof r.mensaje_bienvenida === 'string' ? r.mensaje_bienvenida : d.mensaje_bienvenida,
    fecha_limite: typeof r.fecha_limite === 'string' && r.fecha_limite ? r.fecha_limite : d.fecha_limite,
    mostrar_playlist: typeof r.mostrar_playlist === 'boolean' ? r.mostrar_playlist : d.mostrar_playlist,
    mostrar_mesa: typeof r.mostrar_mesa === 'boolean' ? r.mostrar_mesa : d.mostrar_mesa,
  }
}

const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'

export function randomToken(len = 10, rand: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += TOKEN_ALPHABET[Math.floor(rand() * TOKEN_ALPHABET.length)]
  }
  return out
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function slugifyEvent(event: { name: string; host_name?: string | null; host_name_2?: string | null }): string {
  const base = event.host_name && event.host_name_2
    ? `${event.host_name} y ${event.host_name_2}`
    : event.host_name || event.name || 'evento'
  return stripAccents(base)
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'evento'
}

export function resolveInviteHeading(event: { name: string; host_name?: string | null; host_name_2?: string | null }): string {
  if (event.host_name && event.host_name_2) return `${event.host_name} & ${event.host_name_2}`
  if (event.host_name) return event.host_name
  return event.name
}

const KICKERS: Record<string, string> = {
  boda: 'Nuestra boda',
  cumpleanos: 'Mi cumpleaños',
  bautizo: 'Nuestro bautizo',
  corporativo: 'Te invitamos',
  fiesta: 'Nos vamos de fiesta',
}

export function resolveEventKicker(eventType: string | null | undefined): string {
  if (eventType && KICKERS[eventType]) return KICKERS[eventType]
  return 'Te invitamos'
}

export function isInviteOpen(config: InviteConfig, todayISO: string): boolean {
  if (!config.publicada) return false
  if (!config.fecha_limite) return true
  return todayISO <= config.fecha_limite
}

export type RsvpSubmission = {
  guestAttends: boolean
  guestAllergies: string[]
  guestNotes: string | null
  companions: { id?: string; name: string; attends: boolean; allergies: string[] }[]
}

export type RsvpUpdate = {
  guest: { rsvp_status: 'confirmed' | 'declined'; allergies: string[]; notes: string | null }
  companions: { id?: string; name: string; rsvp_status: 'confirmed' | 'declined'; allergies: string[] }[]
}

export function buildRsvpUpdate(sub: RsvpSubmission, opts: { deadlinePassed: boolean }): RsvpUpdate {
  if (opts.deadlinePassed) throw new Error('deadline_passed')
  return {
    guest: {
      rsvp_status: sub.guestAttends ? 'confirmed' : 'declined',
      allergies: sub.guestAllergies,
      notes: sub.guestNotes,
    },
    companions: sub.companions.map(c => ({
      id: c.id,
      name: c.name,
      rsvp_status: c.attends ? 'confirmed' : 'declined',
      allergies: c.allergies,
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- invite`
Expected: PASS (todos los `describe`).

- [ ] **Step 5: Commit**

```bash
git add lib/invite.ts lib/invite.test.ts
git commit -m "feat(invitacion): logica pura de invitacion con tests" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tipos + migración SQL documentada

**Files:**
- Modify: `lib/types.ts` (agregar `rsvp_token` a `Guest`, `dress_code` a `Event`, tipo `DayItineraryItem`, re-export `InviteConfig`)
- Create: `docs/superpowers/plans/sql/2026-07-06-invitacion.sql`

**Interfaces:**
- Consumes: `InviteConfig` de `lib/invite.ts`.
- Produces: `Guest.rsvp_token?: string | null`, `Event.dress_code?: string | null`, `type DayItineraryItem = { hora: string; titulo: string; subtitulo?: string | null }`.

- [ ] **Step 1: Editar `lib/types.ts`**

En `export type Guest = { ... }` agregar la propiedad (después de `attention_reason`):

```ts
  rsvp_token?: string | null
```

En `export type Event = { ... }` agregar (después de `event_category`):

```ts
  dress_code?: string | null
```

Cerca de los tipos de evento, agregar:

```ts
export type DayItineraryItem = { hora: string; titulo: string; subtitulo?: string | null }
export type { InviteConfig } from './invite'
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run build`
Expected: compila sin errores de tipo relacionados a estos cambios (build completo puede tardar; basta que no haya error TS en `lib/types.ts`). Alternativa rápida: `npx tsc --noEmit`.

- [ ] **Step 3: Escribir el SQL aditivo (documentado, NO se ejecuta aquí)**

Create `docs/superpowers/plans/sql/2026-07-06-invitacion.sql`:

```sql
-- Aditivo y nullable: no rompe prod. Aplicar en Supabase SOLO tras pushear la rama.
alter table guests add column if not exists rsvp_token text unique;
alter table event_settings add column if not exists invite_config jsonb;

-- Dependencias de OTROS agentes (NO las crea esta feature; referencia por si hace falta probar en local):
-- alter table events add column if not exists dress_code text;
-- alter table event_settings add column if not exists day_itinerary jsonb;
```

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts docs/superpowers/plans/sql/2026-07-06-invitacion.sql
git commit -m "feat(invitacion): tipos aditivos + SQL de invitacion documentado" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: API GET pública (`/api/invitacion/[token]`)

**Files:**
- Create: `app/api/invitacion/[token]/route.ts`

**Interfaces:**
- Consumes: `mergeInviteConfig`, `isInviteOpen` de `lib/invite.ts`.
- Produces (respuesta JSON del GET):
  ```ts
  {
    event: { id, name, event_date, event_time, event_type, venue, address, host_name, host_name_2 },
    guest: { id, name, party_size, rsvp_status, allergies, notes },
    party_members: { id, name, rsvp_status, allergies }[],
    config: { mensaje_bienvenida, fecha_limite, mostrar_playlist, mostrar_mesa },
    open: boolean,                 // isInviteOpen
    playlist_token: string | null, // solo si mostrar_playlist
    registry_token: string | null, // solo si mostrar_mesa
    dress_code: string | null,     // best-effort (agente C)
    day_itinerary: DayItineraryItem[] | null, // best-effort (agente B)
  }
  ```
  Estados: token inexistente → 404 `{error:'not_found'}`; invitación en borrador → 404 `{error:'no_publicada'}`.

- [ ] **Step 1: Escribir el route handler**

Create `app/api/invitacion/[token]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mergeInviteConfig, isInviteOpen, buildRsvpUpdate, type RsvpSubmission } from '@/lib/invite'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Lectura best-effort: si la columna aun no existe (otro agente), regresa null sin romper.
async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try { const { data, error } = await p; return error ? null : data } catch { return null }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const { data: guest } = await db
    .from('guests')
    .select('id, event_id, name, party_size, rsvp_status, allergies, notes')
    .eq('rsvp_token', token)
    .maybeSingle()
  if (!guest) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: event }, { data: settings }, { data: members }] = await Promise.all([
    db.from('events').select('id, name, event_date, event_time, event_type, venue, address, host_name, host_name_2').eq('id', guest.event_id).maybeSingle(),
    db.from('event_settings').select('invite_config, playlist_token, registry_token').eq('event_id', guest.event_id).maybeSingle(),
    db.from('party_members').select('id, name, rsvp_status, allergies').eq('guest_id', guest.id).order('created_at', { ascending: true }),
  ])
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const config = mergeInviteConfig(settings?.invite_config)
  if (!config.publicada) return NextResponse.json({ error: 'no_publicada' }, { status: 404 })

  const dressRow = await safeSingle(db.from('events').select('dress_code').eq('id', guest.event_id).maybeSingle())
  const itinRow = await safeSingle(db.from('event_settings').select('day_itinerary').eq('event_id', guest.event_id).maybeSingle())

  return NextResponse.json({
    event,
    guest: { id: guest.id, name: guest.name, party_size: guest.party_size, rsvp_status: guest.rsvp_status, allergies: guest.allergies || [], notes: guest.notes || null },
    party_members: members || [],
    config: { mensaje_bienvenida: config.mensaje_bienvenida, fecha_limite: config.fecha_limite, mostrar_playlist: config.mostrar_playlist, mostrar_mesa: config.mostrar_mesa },
    open: isInviteOpen(config, todayISO()),
    playlist_token: config.mostrar_playlist ? (settings?.playlist_token || null) : null,
    registry_token: config.mostrar_mesa ? (settings?.registry_token || null) : null,
    dress_code: (dressRow as { dress_code?: string } | null)?.dress_code || null,
    day_itinerary: (itinRow as { day_itinerary?: unknown } | null)?.day_itinerary as (null | { hora: string; titulo: string; subtitulo?: string | null }[]) || null,
  })
}
```

- [ ] **Step 2: Verificación manual (local)**

Requisito: aplicar el SQL de Task 2 en Supabase y en un evento de prueba poner `event_settings.invite_config = {"publicada": true}` y a un invitado `guests.rsvp_token = 'PRUEBA01'`.

Run: `npm run dev`, luego en otra terminal:
```bash
curl -s http://localhost:3000/api/invitacion/PRUEBA01 | jq
```
Expected: JSON con `event`, `guest`, `party_members`, `config`, `open: true`. Probar token inválido:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/invitacion/NOEXISTE
```
Expected: `404`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/invitacion/[token]/route.ts"
git commit -m "feat(invitacion): API GET publica acotada por token" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Página del invitado — render (LOCAL MILESTONE)

**Files:**
- Create: `app/invitacion/[slug]/[token]/page.tsx` (server component + `generateMetadata`)
- Create: `app/invitacion/[slug]/[token]/InvitacionClient.tsx` (`'use client'`)

**Interfaces:**
- Consumes: respuesta del GET de Task 3; `resolveInviteHeading`, `resolveEventKicker` de `lib/invite.ts`.
- Produces: la UI del invitado (render + estado local del formulario; el submit se cablea en Task 5).

- [ ] **Step 1: Server component con metadata dinámica**

Create `app/invitacion/[slug]/[token]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import InvitacionClient from './InvitacionClient'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const db = admin()
  const { data: guest } = await db.from('guests').select('event_id').eq('rsvp_token', token).maybeSingle()
  if (!guest) return { title: 'Invitación' }
  const { data: event } = await db.from('events').select('name, event_date, venue, host_name, host_name_2').eq('id', guest.event_id).maybeSingle()
  if (!event) return { title: 'Invitación' }
  const heading = event.host_name && event.host_name_2 ? `${event.host_name} & ${event.host_name_2}` : (event.host_name || event.name)
  const desc = [event.event_date, event.venue].filter(Boolean).join(' · ')
  return {
    title: `${heading} — Invitación`,
    description: desc || 'Estás invitado. Confirma tu asistencia.',
    openGraph: { title: `${heading} — Invitación`, description: desc, type: 'website' },
  }
}

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <InvitacionClient token={token} />
}
```

- [ ] **Step 2: Client component (render con estado local, sin submit todavía)**

Create `app/invitacion/[slug]/[token]/InvitacionClient.tsx`. Reproduce la estética del mockup aprobado (crema, Josefin, teal). Debe: cargar el GET, manejar `loading` / `not_found` / `no_publicada`, y renderizar hero + saludo + formulario (pills, chips de alergias, nota) + detalles + itinerario (si `day_itinerary`) + dress code (si `dress_code`) + enganches (si tokens) + footer. Los estados especiales muestran pantalla amable.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { resolveInviteHeading, resolveEventKicker } from '@/lib/invite'

const cream = '#FBF7F0'
const teal = '#48C9B0'
const josefin = { fontFamily: "'Josefin Sans', sans-serif" }

type Data = {
  event: { id: string; name: string; event_date: string | null; event_time: string | null; event_type: string | null; venue: string | null; address: string | null; host_name: string | null; host_name_2: string | null }
  guest: { id: string; name: string; party_size: number; rsvp_status: string; allergies: string[]; notes: string | null }
  party_members: { id: string; name: string; rsvp_status: string; allergies: string[] }[]
  config: { mensaje_bienvenida: string; fecha_limite: string | null; mostrar_playlist: boolean; mostrar_mesa: boolean }
  open: boolean
  playlist_token: string | null
  registry_token: string | null
  dress_code: string | null
  day_itinerary: { hora: string; titulo: string; subtitulo?: string | null }[] | null
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const [y, m, day] = d.split('T')[0].split('-').map(Number)
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${day} de ${meses[m - 1]} de ${y}`
}

export default function InvitacionClient({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'not_found' | 'no_publicada'>('loading')
  const [guestAttends, setGuestAttends] = useState(true)
  const [companions, setCompanions] = useState<{ id?: string; name: string; attends: boolean }[]>([])

  useEffect(() => {
    fetch(`/api/invitacion/${token}`)
      .then(async r => {
        if (r.status === 404) {
          const j = await r.json().catch(() => ({}))
          setState(j.error === 'no_publicada' ? 'no_publicada' : 'not_found')
          return null
        }
        return r.json()
      })
      .then((j: Data | null) => {
        if (!j) return
        setData(j)
        setGuestAttends(j.guest.rsvp_status !== 'declined')
        const reserved = Math.max(0, (j.guest.party_size || 1) - 1)
        const base = j.party_members.map(m => ({ id: m.id, name: m.name, attends: m.rsvp_status !== 'declined' }))
        while (base.length < reserved) base.push({ name: '', attends: true })
        setCompanions(base)
        setState('ok')
      })
      .catch(() => setState('not_found'))
  }, [token])

  if (state === 'loading') return <div style={{ minHeight: '100vh', background: cream }} />
  if (state === 'not_found' || state === 'no_publicada') {
    return (
      <div style={{ minHeight: '100vh', background: cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: '#6E6459' }}>
          <div style={{ ...josefin, fontSize: 26, color: '#2C2823', marginBottom: 8 }}>Invitación no disponible</div>
          <p>{state === 'no_publicada' ? 'Esta invitación aún no está publicada.' : 'No encontramos esta invitación.'}</p>
        </div>
      </div>
    )
  }

  const d = data!
  const heading = resolveInviteHeading(d.event)
  const kicker = resolveEventKicker(d.event.event_type)

  return (
    <div style={{ minHeight: '100vh', background: cream, color: '#2C2823' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <section style={{ padding: '40px 26px', textAlign: 'center', color: '#fff', background: 'radial-gradient(140% 120% at 30% 15%, #8FB8AE 0%, #5E8C86 42%, #3B5E5C 100%)' }}>
          <div style={{ ...josefin, fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', opacity: .9 }}>{kicker}</div>
          <div style={{ ...josefin, fontSize: 40, margin: '12px 0 6px' }}>{heading}</div>
          <div style={{ fontSize: 13.5, opacity: .95 }}>{fmtDate(d.event.event_date)}{d.event.venue ? ` · ${d.event.venue}` : ''}</div>
        </section>

        <section style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ ...josefin, fontSize: 26 }}>Hola, {d.guest.name}</div>
          <p style={{ color: '#6E6459', fontSize: 14, marginTop: 7 }}>{d.config.mensaje_bienvenida}</p>
        </section>

        <section style={{ padding: '0 22px 26px' }}>
          <div style={{ background: '#fff', border: '1px solid #EAE1D2', borderRadius: 20, padding: 20 }}>
            <div style={{ ...josefin, fontSize: 18, textAlign: 'center', marginBottom: 18 }}>Confirma tu asistencia</div>

            <div style={{ paddingBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 9 }}>{d.guest.name}</div>
              <div style={{ display: 'flex', gap: 9 }}>
                <button onClick={() => setGuestAttends(true)} style={pill(guestAttends)}>Asisto</button>
                <button onClick={() => setGuestAttends(false)} style={pill(!guestAttends, true)}>No podré</button>
              </div>
            </div>

            {companions.map((c, i) => (
              <div key={i} style={{ paddingTop: 14, borderTop: '1px solid #F0E9DB' }}>
                <input
                  value={c.name}
                  onChange={e => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder="Nombre de tu acompañante"
                  style={{ width: '100%', marginBottom: 9, padding: '10px 12px', border: '1.4px solid #EAE1D2', borderRadius: 12, fontSize: 13.5 }}
                />
                <div style={{ display: 'flex', gap: 9 }}>
                  <button onClick={() => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, attends: true } : x))} style={pill(c.attends)}>Asiste</button>
                  <button onClick={() => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, attends: false } : x))} style={pill(!c.attends, true)}>No irá</button>
                </div>
              </div>
            ))}

            <button disabled style={{ width: '100%', marginTop: 18, padding: 15, border: 0, borderRadius: 14, background: teal, color: '#fff', fontWeight: 600, fontSize: 15, opacity: .6 }}>
              Confirmar asistencia
            </button>
            {d.config.fecha_limite && <div style={{ textAlign: 'center', fontSize: 11.5, color: '#9C9184', marginTop: 11 }}>Confirma antes del {fmtDate(d.config.fecha_limite)}</div>}
          </div>
        </section>

        <section style={{ padding: '10px 24px 26px' }}>
          <div style={{ ...josefin, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: '#BF9538', marginBottom: 14 }}>Los detalles</div>
          <Detail titulo="Cuándo" texto={`${fmtDate(d.event.event_date)}${d.event.event_time ? ` · ${d.event.event_time}` : ''}`} />
          {(d.event.venue || d.event.address) && <Detail titulo="Dónde" texto={[d.event.venue, d.event.address].filter(Boolean).join(' · ')} />}
          {d.dress_code && <Detail titulo="Código de vestimenta" texto={d.dress_code} />}
        </section>

        {d.day_itinerary && d.day_itinerary.length > 0 && (
          <section style={{ padding: '0 24px 26px' }}>
            <div style={{ ...josefin, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: '#BF9538', marginBottom: 14 }}>Itinerario del día</div>
            {d.day_itinerary.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '8px 0' }}>
                <div style={{ ...josefin, fontWeight: 600, color: '#BF9538', width: 64 }}>{it.hora}</div>
                <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{it.titulo}</div>{it.subtitulo && <div style={{ fontSize: 12, color: '#9C9184' }}>{it.subtitulo}</div>}</div>
              </div>
            ))}
          </section>
        )}

        {(d.playlist_token || d.registry_token) && (
          <section style={{ padding: '0 24px 26px' }}>
            <div style={{ ...josefin, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: '#BF9538', marginBottom: 14 }}>Sé parte de la fiesta</div>
            {d.playlist_token && <LinkCard titulo="Sugiere una canción" sub="Ayúdanos a armar la playlist" href={`/playlist/${d.playlist_token}`} />}
            {d.registry_token && <LinkCard titulo="Mesa de regalos" sub="Detalles para los anfitriones" href={`/mesa/${d.registry_token}`} />}
          </section>
        )}

        <section style={{ textAlign: 'center', padding: '30px 24px 44px', background: '#F4EEE2' }}>
          <div style={{ ...josefin, fontSize: 19 }}>Con cariño, {heading}</div>
          <div style={{ fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase', color: '#9C9184', marginTop: 14 }}>Hecho con Anfiora</div>
        </section>
      </div>
    </div>
  )
}

function pill(on: boolean, isNo = false): React.CSSProperties {
  return {
    flex: 1, padding: '11px 8px', borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
    border: on ? `1.4px solid ${isNo ? '#E4D3C6' : teal}` : '1.4px solid #EAE1D2',
    background: on ? (isNo ? '#F4EDE6' : teal) : '#fff',
    color: on ? (isNo ? '#9A6A4E' : '#fff') : '#6E6459',
  }
}

function Detail({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ padding: '13px 0', borderTop: '1px solid #F0E9DB' }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: '#6E6459', marginTop: 2 }}>{texto}</div>
    </div>
  )
}

function LinkCard({ titulo, sub, href }: { titulo: string; sub: string; href: string }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, background: '#fff', border: '1px solid #EAE1D2', marginTop: 11, textDecoration: 'none', color: 'inherit' }}>
      <div><div style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</div><div style={{ fontSize: 12, color: '#6E6459' }}>{sub}</div></div>
      <div style={{ marginLeft: 'auto', color: '#9C9184' }}>›</div>
    </a>
  )
}
```

- [ ] **Step 3: Verificación manual (local) — este es el hito "verlo en local"**

Con el SQL aplicado y el evento de prueba de Task 3 (invitación `publicada: true`, invitado con `rsvp_token='PRUEBA01'` y 1-2 `party_members`):

Run: `npm run dev` y abrir `http://localhost:3000/invitacion/prueba/PRUEBA01`
Expected: se ve la invitación completa (hero, saludo, formulario con pills, detalles, enganches). El botón "Confirmar" está deshabilitado (se cablea en Task 5). Probar `http://localhost:3000/invitacion/prueba/NOEXISTE` → pantalla "Invitación no disponible".

- [ ] **Step 4: Commit**

```bash
git add "app/invitacion"
git commit -m "feat(invitacion): pagina publica del invitado (render + metadata OG)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: API POST + cablear confirmación

**Files:**
- Modify: `app/api/invitacion/[token]/route.ts` (agregar `POST`)
- Modify: `app/invitacion/[slug]/[token]/InvitacionClient.tsx` (alergias/nota + submit + estados enviado/cerrado)

**Interfaces:**
- Consumes: `buildRsvpUpdate`, `isInviteOpen`, `mergeInviteConfig` de `lib/invite.ts`.
- Produces: `POST /api/invitacion/[token]` body `{ guestAttends, guestAllergies, guestNotes, companions:[{id?,name,attends,allergies}] }` → `{ ok: true }` | 404 | 410 `{error:'cerrada'}`.

- [ ] **Step 1: Agregar `POST` al route**

Añadir al final de `app/api/invitacion/[token]/route.ts`:

```ts
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let body: RsvpSubmission
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_body' }, { status: 400 }) }

  const db = admin()
  const { data: guest } = await db.from('guests').select('id, event_id').eq('rsvp_token', token).maybeSingle()
  if (!guest) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: settings } = await db.from('event_settings').select('invite_config').eq('event_id', guest.event_id).maybeSingle()
  const config = mergeInviteConfig(settings?.invite_config)
  if (!isInviteOpen(config, todayISO())) return NextResponse.json({ error: 'cerrada' }, { status: 410 })

  let update
  try {
    update = buildRsvpUpdate(body, { deadlinePassed: false })
  } catch {
    return NextResponse.json({ error: 'cerrada' }, { status: 410 })
  }

  const { error: gErr } = await db.from('guests')
    .update({ rsvp_status: update.guest.rsvp_status, allergies: update.guest.allergies, notes: update.guest.notes })
    .eq('id', guest.id)
  if (gErr) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })

  for (const c of update.companions) {
    const name = c.name.trim().slice(0, 120)
    if (c.id) {
      await db.from('party_members').update({ name, rsvp_status: c.rsvp_status, allergies: c.allergies }).eq('id', c.id).eq('guest_id', guest.id)
    } else if (name) {
      await db.from('party_members').insert({ guest_id: guest.id, event_id: guest.event_id, name, rsvp_status: c.rsvp_status, allergies: c.allergies })
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Cablear alergias, nota y submit en el cliente**

En `InvitacionClient.tsx`: agregar estado `allergies: string[]` y `notes: string` (inicializados de `d.guest`), chips de alergias comunes (`['Vegetariano','Vegano','Sin gluten','Nueces','Mariscos']`) toggleables, un `<textarea>` para la nota, estado `sending`/`sent`, y `submit()` que hace `POST`. Si `!d.open`, el bloque de confirmar se muestra en modo lectura ("Confirmaciones cerradas") sin botón. Tras `sent`, mostrar confirmación ("¡Gracias! Tu respuesta quedó guardada.").

```tsx
// nuevos estados
const [allergies, setAllergies] = useState<string[]>([])
const [notes, setNotes] = useState('')
const [sending, setSending] = useState(false)
const [sent, setSent] = useState(false)

// dentro del .then que setea data:
setAllergies(j.guest.allergies || [])
setNotes(j.guest.notes || '')

const COMMON = ['Vegetariano', 'Vegano', 'Sin gluten', 'Nueces', 'Mariscos']
const toggleAllergy = (a: string) => setAllergies(xs => xs.includes(a) ? xs.filter(x => x !== a) : [...xs, a])

async function submit() {
  setSending(true)
  const res = await fetch(`/api/invitacion/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guestAttends,
      guestAllergies: allergies,
      guestNotes: notes.trim() || null,
      companions: companions.map(c => ({ id: c.id, name: c.name, attends: c.attends, allergies: [] })),
    }),
  })
  setSending(false)
  if (res.ok) setSent(true)
}
```

Reemplazar el `<button disabled>` del CTA por: si `sent` → mensaje de gracias; si `!d.open` → texto "Confirmaciones cerradas"; si no → `<button onClick={submit} disabled={sending}>` habilitado (quitar `opacity:.6`). Insertar los chips de alergias y el textarea de nota justo antes del CTA (bloque `extras` del mockup).

- [ ] **Step 3: Verificación manual (local)**

Run: `npm run dev`, abrir `/invitacion/prueba/PRUEBA01`, marcar asistencia, alergias y nota, y "Confirmar asistencia".
Expected: aparece "¡Gracias!". En Supabase, `guests.rsvp_status` = `confirmed`/`declined`, `allergies` y `notes` guardados, y `party_members` actualizados/insertados. Recargar el link muestra el estado guardado. Poner `fecha_limite` en el pasado → el bloque muestra "Confirmaciones cerradas" y el `POST` responde 410.

- [ ] **Step 4: Commit**

```bash
git add "app/api/invitacion/[token]/route.ts" "app/invitacion"
git commit -m "feat(invitacion): confirmar asistencia escribe a guests y party_members" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Pantalla del anfitrión + entrada de nav

**Files:**
- Create: `app/events/[id]/invitacion/page.tsx` (`'use client'`)
- Modify: `app/events/[id]/layout.tsx` (una `NavItem` "Invitación")

**Interfaces:**
- Consumes: `mergeInviteConfig`, `defaultInviteConfig`, `randomToken`, `slugifyEvent` de `lib/invite.ts`; `supabase` de `lib/supabase.ts`.
- Produces: pantalla que lee/escribe `event_settings.invite_config` (vía supabase browser) y genera `guests.rsvp_token` faltantes al publicar.

- [ ] **Step 1: Agregar la NavItem en `layout.tsx`**

En el import de `lucide-react` (línea 6) agregar `MailOpen`. Insertar en `NAV_ITEMS` (después del item "Timeline", antes de "Comida"):

```tsx
  {
    type: 'item',
    label: 'Invitación', labelMobile: 'Invitación', path: '/invitacion', adminOnly: false,
    iconOutline: <MailOpen width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <MailOpen width={18} height={18} strokeWidth={2.5} />,
  },
```

- [ ] **Step 2: Crear la pantalla de configuración**

Create `app/events/[id]/invitacion/page.tsx`. Debe: cargar `event` + `event_settings` (invite_config) + `guests` (id, name, phone, rsvp_status, rsvp_token); permitir editar `mensaje_bienvenida`, `fecha_limite`, `mostrar_playlist`, `mostrar_mesa`; botón "Publicar invitación" que setea `publicada: true`, genera `rsvp_token` para los invitados que no lo tengan (uno por uno con `randomToken`, update por id) y guarda `invite_config`; y lista los invitados con su link `/invitacion/{slug}/{token}` y botones copiar + WhatsApp (WhatsApp se completa en Task 7). Guardar config con `update({ invite_config }).eq('event_id', id)`.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { mergeInviteConfig, defaultInviteConfig, randomToken, slugifyEvent, type InviteConfig } from '@/lib/invite'

type GuestRow = { id: string; name: string; phone: string | null; rsvp_status: string; rsvp_token: string | null }
const teal = '#48C9B0'

export default function InvitacionConfigPage() {
  const { id } = useParams<{ id: string }>()
  const [ev, setEv] = useState<{ name: string; host_name: string | null; host_name_2: string | null } | null>(null)
  const [cfg, setCfg] = useState<InviteConfig>(defaultInviteConfig())
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: s }, { data: g }] = await Promise.all([
        supabase.from('events').select('name, host_name, host_name_2').eq('id', id).maybeSingle(),
        supabase.from('event_settings').select('invite_config').eq('event_id', id).maybeSingle(),
        supabase.from('guests').select('id, name, phone, rsvp_status, rsvp_token').eq('event_id', id).order('name'),
      ])
      setEv(e as never)
      setCfg(mergeInviteConfig(s?.invite_config))
      setGuests((g as GuestRow[]) || [])
    })()
  }, [id])

  const slug = ev ? slugifyEvent(ev) : 'evento'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const linkFor = (t: string) => `${origin}/invitacion/${slug}/${t}`

  async function saveConfig(next: InviteConfig) {
    setCfg(next)
    await supabase.from('event_settings').update({ invite_config: next }).eq('event_id', id)
  }

  async function publicar() {
    setSaving(true)
    const missing = guests.filter(g => !g.rsvp_token)
    for (const g of missing) {
      const token = randomToken()
      await supabase.from('guests').update({ rsvp_token: token }).eq('id', g.id)
      g.rsvp_token = token
    }
    setGuests([...guests])
    await saveConfig({ ...cfg, publicada: true })
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Invitación</h1>
        <button onClick={publicar} disabled={saving} className="rounded-xl px-4 py-2 text-white font-semibold" style={{ background: teal }}>
          {cfg.publicada ? 'Actualizar' : 'Publicar invitación'}
        </button>
      </div>

      <div className="rounded-2xl border border-[#e8e8e8] bg-white p-5 space-y-4 mb-6">
        <label className="block text-sm">
          <span className="text-[#666]">Mensaje de bienvenida</span>
          <textarea value={cfg.mensaje_bienvenida} onChange={e => setCfg({ ...cfg, mensaje_bienvenida: e.target.value })} onBlur={() => saveConfig(cfg)} className="mt-1 w-full rounded-lg border border-[#e8e8e8] p-2" rows={2} />
        </label>
        <label className="block text-sm">
          <span className="text-[#666]">Fecha límite para confirmar</span>
          <input type="date" value={cfg.fecha_limite || ''} onChange={e => saveConfig({ ...cfg, fecha_limite: e.target.value || null })} className="mt-1 block rounded-lg border border-[#e8e8e8] p-2" />
        </label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.mostrar_playlist} onChange={e => saveConfig({ ...cfg, mostrar_playlist: e.target.checked })} /> Mostrar playlist</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.mostrar_mesa} onChange={e => saveConfig({ ...cfg, mostrar_mesa: e.target.checked })} /> Mostrar mesa de regalos</label>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden">
        {guests.map(g => (
          <div key={g.id} className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0] last:border-0">
            <div>
              <div className="font-medium">{g.name}</div>
              <div className="text-xs text-[#999]">{g.rsvp_status}</div>
            </div>
            <div className="flex gap-2">
              {g.rsvp_token
                ? <button onClick={() => navigator.clipboard.writeText(linkFor(g.rsvp_token!))} className="text-xs rounded-lg border border-[#e8e8e8] px-3 py-1.5">Copiar link</button>
                : <span className="text-xs text-[#bbb]">Publica para generar link</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificación manual (local)**

Run: `npm run dev`, entrar a un evento → nav "Invitación". Editar mensaje/fecha/toggles → recargar y verificar que persisten. "Publicar invitación" → verificar en Supabase que los `guests` sin token ahora tienen `rsvp_token` y que `invite_config.publicada = true`. "Copiar link" copia una URL `/invitacion/{slug}/{token}` que abre la página del invitado.

- [ ] **Step 4: Commit**

```bash
git add "app/events/[id]/invitacion/page.tsx" "app/events/[id]/layout.tsx"
git commit -m "feat(invitacion): pantalla del anfitrion + entrada de nav" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Envío por WhatsApp + selección múltiple

**Files:**
- Modify: `app/events/[id]/invitacion/page.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: botón "WhatsApp" por invitado (abre `wa.me` con el link) y acción de selección múltiple para copiar todos los links.

- [ ] **Step 1: Agregar envío por WhatsApp y copiar en lote**

En `page.tsx`: helper que arma el mensaje y abre `wa.me`. Agregar botón "WhatsApp" junto a "Copiar link", y un botón superior "Copiar todos los links" que junta nombre + link de los invitados con token.

```tsx
function waLink(phone: string | null, text: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(text)}`
}

const msgFor = (name: string, link: string) => `Hola ${name}, te comparto nuestra invitación: ${link}`

// botón por fila (junto a "Copiar link"):
// <a href={waLink(g.phone, msgFor(g.name, linkFor(g.rsvp_token!)))} target="_blank" rel="noreferrer"
//    className="text-xs rounded-lg px-3 py-1.5 text-white" style={{ background: teal }}>WhatsApp</a>

// botón de lote (arriba de la lista):
function copiarTodos() {
  const lines = guests.filter(g => g.rsvp_token).map(g => `${g.name}: ${linkFor(g.rsvp_token!)}`)
  navigator.clipboard.writeText(lines.join('\n'))
}
```

- [ ] **Step 2: Verificación manual (local)**

Run: `npm run dev`, en la pantalla "Invitación" con la invitación publicada: el botón "WhatsApp" abre `wa.me` con el mensaje y el link; "Copiar todos los links" copia la lista completa.
Expected: mensaje "Hola {nombre}, te comparto nuestra invitación: {link}".

- [ ] **Step 3: Commit**

```bash
git add "app/events/[id]/invitacion/page.tsx"
git commit -m "feat(invitacion): reparto de links por whatsapp y copia en lote" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (hecho por el autor del plan)

**Spec coverage:**
- Página del invitado (render + RSVP) → Task 4 + Task 5.
- Escritura a guests/party_members + alergias/nota → Task 5.
- Ruta `/invitacion/[slug]/[token]` + slug + token → Task 4 + Task 6 (generación de token).
- OG/preview WhatsApp → Task 4 (`generateMetadata`).
- Datos nuevos (`rsvp_token`, `invite_config`) sin tablas nuevas → Task 2.
- Lectura render-if-present de itinerario/dress code → Task 3 (`safeSingle`) + Task 4 (render condicional).
- Pantalla del anfitrión + nav "Invitación" → Task 6.
- Reparto de links por WhatsApp (1-a-1 + lote) → Task 7.
- Estados borde (token inválido, borrador, fecha límite) → Task 3/4/5.
- Agnóstico al tipo de evento → Task 1 (`resolveInviteHeading`/`resolveEventKicker`) usados en Task 4.
- Convivencia con omnicanal (mismos `rsvp_status`) → Task 5 escribe los mismos campos.
- Vitest lógica pura → Task 1.

**Placeholder scan:** sin TBD/TODO; el código de cada paso es real. Task 5 y 7 describen ediciones sobre archivos ya creados con los fragmentos exactos a insertar.

**Type consistency:** `InviteConfig`, `RsvpSubmission`, `buildRsvpUpdate`, `mergeInviteConfig`, `isInviteOpen`, `randomToken`, `slugifyEvent`, `resolveInviteHeading`, `resolveEventKicker` se definen en Task 1 y se consumen con las mismas firmas en Tasks 3-6. La respuesta del GET (Task 3) coincide con el tipo `Data` del cliente (Task 4).

## Verificación final (antes de merge)
1. `npm test` verde.
2. `npm run build` sin errores.
3. Flujo manual completo local → aplicar SQL en Supabase (tras push de la rama) → preview Vercel → main con OK de Diego.
