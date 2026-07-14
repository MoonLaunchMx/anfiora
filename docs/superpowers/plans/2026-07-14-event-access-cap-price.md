# ANF-054 — Modo de acceso, cupo y precio en la creacion del evento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al crear un evento se guarde como entra la gente (`access_mode`), cuanta cabe (`guest_cap`) y cuanto cuesta entrar (`ticket_price`). Nada los lee todavia.

**Architecture:** El mapeo tipo -> acceso vive como **dato** en `EVENT_TYPES` (campo `defaultAccessMode`), exactamente igual que el `defaultFeatures` que ya existe. `lib/features.ts` expone los helpers, espejo de los de features. `NewEventModal` pasa de 3 a 4 pasos y gana un paso "Acceso" entre Datos y Herramientas. Toda la logica de decision es pura y testeable; el resto es UI y un insert.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase (browser client), Framer Motion, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-14-event-access-cap-price-design.md`

## Global Constraints

- **Worktree:** `C:\Users\diego\Documents\anfiora\.claude\worktrees\access-cap-price`. Rama `feature/ANF-054-event-access-cap-price`, mergeada con `origin/main` en `dec015a` (RLS Fase 1). **No trabajar en el checkout principal** (esta en `feat/forms`, que esta congelada).
- **Antes de creerle a cualquier build o test: `git fetch origin && git merge origin/main`.** `origin/main` se mueve mientras esta rama trabaja. Un verde contra una base vieja no vale nada.
- **`lib/types.ts`: NO agregar `planner_name`.** La columna existe en la DB desde RLS Fase 1 y se usa sin tipo en `app/events/[id]/page.tsx:841` y `app/perfil/page.tsx:209`, pero **no** esta en el tipo `Event`. Es un cabo suelto ajeno a ANF-054. La Task 4 reemplaza el bloque `Event` completo: **copiar el bloque tal como esta al momento de editar**, no desde este plan a ciegas, por si alguien lo agrego mientras tanto.
- **Si hay que borrar este worktree:** quitar a mano el junction de `node_modules` ANTES (`(Get-Item $ruta -Force).Delete()`). `git worktree remove` lo sigue y vacia el `node_modules` de la carpeta principal.
- **NUNCA** `git push`. **NUNCA** tocar Supabase: el SQL lo escribe Claude, lo corre Diego.
- **`feat/forms` no se toca.** Queda congelada como donante.
- Mobile first. UI en espanol **con acentos y ñ**. Sin emojis. Solo Tailwind (sin inline styles).
- Iconos **Lucide React**. Nunca SVG manual, nunca emoji.
- Teal `#48C9B0` solo en CTA y seleccion. Texto `#1D1E20`. Bordes `#e8e8e8` / `#e0e0e0`.
- Inputs numericos **nativos** (`type="number"`) para cupo y precio.
- Sin comentarios en el codigo salvo cuando el WHY sea no-obvio.
- Commits convencionales **sin acentos ni ñ** en el mensaje.
- Copy exacto de la nota de precio: `Anfiora no procesa el pago. Tú recibes el dinero directo.`
- Copy exacto de la linea de privada: `Este evento va por lista de invitados: sin cupo ni cobro.`
- Los 3 valores de `AccessMode` son enums TEXT en la DB: `'privada' | 'aprobacion' | 'abierta'`. Sin acentos, exactamente asi.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `docs/superpowers/plans/sql/2026-07-14-access-cap-price.sql` | Crear: migracion. La corre Diego en Supabase. |
| `lib/features.ts` | Modificar: tipo `AccessMode`, catalogo `ACCESS_MODES` (label/desc/icono), y los helpers `getDefaultAccessMode` / `resolveAccessMode` / `normalizeAccessFields`. |
| `lib/event-types.ts` | Modificar: campo `defaultAccessMode` en `EventTypeConfig` y en los 17 tipos. Es el mapeo. |
| `lib/features.test.ts` | Crear: Vitest de los tres helpers y del mapeo completo. |
| `lib/types.ts` | Modificar: re-export de `AccessMode`, campos nuevos en `Event` y `EventSettings`. |
| `app/components/NewEventModal.tsx` | Modificar: 4 pasos, paso Acceso, insert de los 3 campos. |

**Por que los helpers van en `lib/features.ts` y no en un archivo nuevo:** el archivo tiene 65 lineas y ya es el hogar del patron identico (`FEATURES` con iconos + `getDefaultFeatures` + `resolveFeatures` leyendo de `EVENT_TYPES`). Un `lib/access.ts` separado duplicaria el patron sin ganar nada.

---

### Task 1: Migracion SQL (la corre Diego)

**Files:**
- Create: `docs/superpowers/plans/sql/2026-07-14-access-cap-price.sql`

**Interfaces:**
- Consumes: nada.
- Produces: las columnas `event_settings.access_mode` (text), `events.guest_cap` (int), `events.ticket_price` (numeric). Todas nullable. La Task 6 escribe estas tres columnas y **falla en runtime si esta task no se corrio**.

**Contexto critico:** Anfiora tiene UNA sola base de Supabase. `localhost:3000` pega a la base de **produccion**. Por eso la migracion tiene que correr antes incluso de la verificacion local, no solo antes del deploy. Correrla antes es inofensivo: las columnas son nullable y nadie las lee.

- [ ] **Step 1: Escribir el archivo de migracion**

Crear `docs/superpowers/plans/sql/2026-07-14-access-cap-price.sql`:

```sql
-- ANF-054 — modo de acceso, cupo y precio del evento.
-- CORRER ESTO ANTES de deployar el codigo: el insert de NewEventModal escribe
-- estas tres columnas y revienta la creacion de eventos si no existen.
-- Las tres son nullable y nadie las lee todavia -> correrlas antes es inofensivo.

alter table event_settings add column if not exists access_mode text;
alter table events        add column if not exists guest_cap int;
alter table events        add column if not exists ticket_price numeric;
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-07-14-access-cap-price.sql
git commit -m "chore(events): migracion de access mode, guest cap y ticket price"
```

- [ ] **Step 3: PARAR y entregarle el SQL a Diego**

**No continuar con las demas tasks hasta que Diego confirme que corrio el SQL en Supabase.**
Las tasks 2 a 5 (logica y tipos) no dependen de la DB y podrian correr antes, pero la Task 6
(insert) y la Task 7 (verificacion local) fallan sin las columnas.

Decirle a Diego, literal: el SQL esta en `docs/superpowers/plans/sql/2026-07-14-access-cap-price.sql`,
son tres `ALTER TABLE` aditivos y nullable, y necesito que lo corra en el SQL editor de Supabase
antes de que yo pueda verificar nada en local.

---

### Task 2: Tipo `AccessMode` + el mapeo de los 17 tipos

**Files:**
- Modify: `lib/features.ts` (agregar `AccessMode`, `ACCESS_MODES`, `getDefaultAccessMode`, `resolveAccessMode`)
- Modify: `lib/event-types.ts` (agregar `defaultAccessMode` a `EventTypeConfig` y a los 17 tipos)
- Test: `lib/features.test.ts` (crear)

**Interfaces:**
- Consumes: `EVENT_TYPES` de `lib/event-types.ts`.
- Produces:
  - `export type AccessMode = 'privada' | 'aprobacion' | 'abierta'` (en `lib/features.ts`)
  - `export interface AccessModeConfig { key: AccessMode; label: string; description: string; icon: React.ElementType }`
  - `export const ACCESS_MODES: AccessModeConfig[]` — los 3, en orden privada -> aprobacion -> abierta
  - `export function getDefaultAccessMode(eventTypeValue: string | null): AccessMode`
  - `export function resolveAccessMode(eventTypeValue: string | null, stored: string | null | undefined): AccessMode`
  - `EventTypeConfig.defaultAccessMode: AccessMode` — **requerido**, no opcional: obliga a que los 17 lo declaren.

**Nota sobre el import circular:** `event-types.ts` ya importa `FeatureKey` de `./features` con `import type`, y `features.ts` importa `EVENT_TYPES` de `./event-types` como valor. Funciona porque el import de tipo se borra en compilacion. `AccessMode` entra por el mismo camino: se agrega al `import type` que ya existe.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/features.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getDefaultAccessMode, resolveAccessMode } from './features'
import { EVENT_TYPES } from './event-types'

describe('getDefaultAccessMode', () => {
  it('las celebraciones de lista curada son privadas', () => {
    expect(getDefaultAccessMode('boda')).toBe('privada')
    expect(getDefaultAccessMode('xv')).toBe('privada')
    expect(getDefaultAccessMode('bautizo')).toBe('privada')
    expect(getDefaultAccessMode('graduacion')).toBe('privada')
  })

  it('los eventos de boleto y cupo son abiertos', () => {
    expect(getDefaultAccessMode('conferencia')).toBe('abierta')
    expect(getDefaultAccessMode('congreso')).toBe('abierta')
    expect(getDefaultAccessMode('caridad')).toBe('abierta')
    expect(getDefaultAccessMode('fiesta')).toBe('abierta')
    expect(getDefaultAccessMode('cumpleanos')).toBe('abierta')
  })

  it('los grupos cerrados self-serve piden aprobacion', () => {
    expect(getDefaultAccessMode('despedida')).toBe('aprobacion')
    expect(getDefaultAccessMode('capacitacion')).toBe('aprobacion')
    expect(getDefaultAccessMode('teambuilding')).toBe('aprobacion')
    expect(getDefaultAccessMode('lanzamiento')).toBe('aprobacion')
    expect(getDefaultAccessMode('asamblea')).toBe('aprobacion')
    expect(getDefaultAccessMode('retiro')).toBe('aprobacion')
    expect(getDefaultAccessMode('campamento')).toBe('aprobacion')
    expect(getDefaultAccessMode('otro')).toBe('aprobacion')
  })

  it('tipo desconocido o null cae en aprobacion', () => {
    expect(getDefaultAccessMode('inexistente')).toBe('aprobacion')
    expect(getDefaultAccessMode(null)).toBe('aprobacion')
  })

  it('los 17 tipos declaran un modo valido', () => {
    expect(EVENT_TYPES).toHaveLength(17)
    for (const t of EVENT_TYPES) {
      expect(['privada', 'aprobacion', 'abierta']).toContain(t.defaultAccessMode)
    }
  })
})

describe('resolveAccessMode', () => {
  it('respeta el valor guardado', () => {
    expect(resolveAccessMode('boda', 'abierta')).toBe('abierta')
    expect(resolveAccessMode('conferencia', 'privada')).toBe('privada')
  })

  it('evento viejo (columna null) cae en el default del tipo', () => {
    expect(resolveAccessMode('boda', null)).toBe('privada')
    expect(resolveAccessMode('conferencia', undefined)).toBe('abierta')
  })

  it('valor basura en la columna cae en el default del tipo', () => {
    expect(resolveAccessMode('boda', 'lo-que-sea')).toBe('privada')
    expect(resolveAccessMode('boda', '')).toBe('privada')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- lib/features.test.ts`
Expected: FAIL. Vitest no resuelve `getDefaultAccessMode` ni `resolveAccessMode` (no existen), y `t.defaultAccessMode` no compila.

- [ ] **Step 3: Agregar `defaultAccessMode` a `lib/event-types.ts`**

Cambiar la linea 7 (el `import type`):

```ts
import type { FeatureKey, AccessMode } from './features'
```

Agregar el campo a `EventTypeConfig` (despues de `defaultFeatures?`):

```ts
export interface EventTypeConfig {
  value: string
  label: string
  category: EventCategory
  icon: React.ElementType
  hostLabel?: string
  host2Label?: string
  showOrg?: boolean
  showVenue?: boolean
  defaultFeatures?: FeatureKey[]
  defaultAccessMode: AccessMode
}
```

Reemplazar el array `EVENT_TYPES` completo (los 17, cada uno con su `defaultAccessMode` al final):

```ts
export const EVENT_TYPES: EventTypeConfig[] = [
  { value: 'boda',         label: 'Boda',          category: 'social',      icon: Gem,            hostLabel: 'Novia',                 host2Label: 'Novio',  showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada' },
  { value: 'xv',           label: 'XV años',        category: 'social',      icon: Crown,          hostLabel: 'Festejada',             showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada' },
  { value: 'cumpleanos',   label: 'Cumpleaños',     category: 'social',      icon: Cake,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'abierta' },
  { value: 'graduacion',   label: 'Graduación',     category: 'social',      icon: GraduationCap,  hostLabel: 'Graduado/a',            showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada' },
  { value: 'bautizo',      label: 'Bautizo',        category: 'social',      icon: Sun,            hostLabel: 'Nombre del bautizado/a', showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada' },
  { value: 'fiesta',       label: 'Fiesta',         category: 'social',      icon: PartyPopper,    hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['album', 'playlist', 'comida', 'vestimenta', 'invitacion'], defaultAccessMode: 'abierta' },
  { value: 'despedida',    label: 'Despedida',      category: 'social',      icon: Wine,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'aprobacion' },
  { value: 'conferencia',  label: 'Conferencia',    category: 'corporativo', icon: Presentation,   hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas'], defaultAccessMode: 'abierta' },
  { value: 'capacitacion', label: 'Capacitación',   category: 'corporativo', icon: Monitor,        hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['comida'], defaultAccessMode: 'aprobacion' },
  { value: 'teambuilding', label: 'Team Building',  category: 'corporativo', icon: UsersRound,     hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['album', 'comida'], defaultAccessMode: 'aprobacion' },
  { value: 'lanzamiento',  label: 'Lanzamiento',    category: 'corporativo', icon: Rocket,         hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album'], defaultAccessMode: 'aprobacion' },
  { value: 'asamblea',     label: 'Asamblea',       category: 'corporativo', icon: Building2,      hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas'], defaultAccessMode: 'aprobacion' },
  { value: 'retiro',       label: 'Retiro',         category: 'impacto',     icon: Tent,           hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'comida'], defaultAccessMode: 'aprobacion' },
  { value: 'congreso',     label: 'Congreso',       category: 'impacto',     icon: Mic,            hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas'], defaultAccessMode: 'abierta' },
  { value: 'campamento',   label: 'Campamento',     category: 'impacto',     icon: Flame,          hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'playlist', 'comida'], defaultAccessMode: 'aprobacion' },
  { value: 'caridad',      label: 'Caridad',        category: 'impacto',     icon: HeartHandshake, hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album'], defaultAccessMode: 'abierta' },
  { value: 'otro',         label: 'Otro',           category: 'social',      icon: CalendarDays,   hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist'], defaultAccessMode: 'aprobacion' },
]
```

- [ ] **Step 4: Agregar el tipo, el catalogo y los helpers a `lib/features.ts`**

Cambiar la linea 2 (el import de Lucide) para sumar los 3 iconos nuevos:

```ts
import { LayoutGrid, Gift, Images, Music2, UtensilsCrossed, Shirt, MailOpen, Lock, UserCheck, Globe } from 'lucide-react'
```

Agregar despues de `export type EnabledFeatures = ...` (linea 7):

```ts
export type AccessMode = 'privada' | 'aprobacion' | 'abierta'

export interface AccessModeConfig {
  key: AccessMode
  label: string
  description: string
  icon: React.ElementType
}

export const ACCESS_MODES: AccessModeConfig[] = [
  { key: 'privada',    label: 'Invitación directa', description: 'Tú armas la lista. Cada invitado recibe su propio link.',   icon: Lock },
  { key: 'aprobacion', label: 'Con aprobación',     description: 'Un link. Se registran solos y tú apruebas cada solicitud.', icon: UserCheck },
  { key: 'abierta',    label: 'Abierta',            description: 'Un link. Cualquiera se registra y la lista se llena sola.', icon: Globe },
]
```

Agregar al final del archivo:

```ts
export function getDefaultAccessMode(eventTypeValue: string | null): AccessMode {
  return EVENT_TYPES.find(t => t.value === eventTypeValue)?.defaultAccessMode ?? 'aprobacion'
}

export function resolveAccessMode(
  eventTypeValue: string | null,
  stored: string | null | undefined,
): AccessMode {
  if (stored === 'privada' || stored === 'aprobacion' || stored === 'abierta') return stored
  return getDefaultAccessMode(eventTypeValue)
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npm test -- lib/features.test.ts`
Expected: PASS. 8 tests verdes.

- [ ] **Step 6: Verificar que nada mas se rompio**

Run: `npx tsc --noEmit`
Expected: sin errores.

Se verifico al escribir el plan que `EventTypeConfig` **solo** se construye en el array de
`lib/event-types.ts` — `NewEventModal` lo usa como tipo (`useState<EventTypeConfig | null>`) pero
nunca arma un literal, y `OnboardingModal` / `configuracion` solo leen `EVENT_TYPES`. Por eso el
campo puede ser requerido sin romper nada. Este tsc lo confirma.

- [ ] **Step 7: Commit**

```bash
git add lib/features.ts lib/event-types.ts lib/features.test.ts
git commit -m "feat(events): mapeo de tipo de evento a modo de acceso"
```

---

### Task 3: `normalizeAccessFields` — la regla dura de privada

**Files:**
- Modify: `lib/features.ts` (agregar `normalizeAccessFields` y sus dos helpers privados)
- Test: `lib/features.test.ts` (agregar un `describe`)

**Interfaces:**
- Consumes: `AccessMode` de la Task 2.
- Produces:
  ```ts
  export function normalizeAccessFields(input: {
    accessMode: AccessMode
    guestCap: string
    ticketPrice: string
  }): { guest_cap: number | null; ticket_price: number | null }
  ```
  Las llaves de salida usan **snake_case** a proposito: se hace spread directo dentro del insert a Supabase en la Task 6.

**Por que es su propia task:** es la regla de negocio dura ("privada nunca lleva cupo ni precio") y el unico lugar donde se puede colar un bug silencioso — un cupo que se guarda cuando no debia, o un `0` que se guarda como `null`. Merece su propia puerta de revision.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `lib/features.test.ts`, y sumar `normalizeAccessFields` al import de arriba
(que queda `import { getDefaultAccessMode, resolveAccessMode, normalizeAccessFields } from './features'`):

```ts
describe('normalizeAccessFields', () => {
  it('privada borra cupo y precio aunque vengan llenos', () => {
    expect(normalizeAccessFields({ accessMode: 'privada', guestCap: '100', ticketPrice: '500' }))
      .toEqual({ guest_cap: null, ticket_price: null })
  })

  it('abierta guarda cupo y precio', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '100', ticketPrice: '500' }))
      .toEqual({ guest_cap: 100, ticket_price: 500 })
  })

  it('aprobacion guarda cupo y precio', () => {
    expect(normalizeAccessFields({ accessMode: 'aprobacion', guestCap: '30', ticketPrice: '0' }))
      .toEqual({ guest_cap: 30, ticket_price: 0 })
  })

  it('vacio o espacios es null: sin limite y gratis', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: '   ' }))
      .toEqual({ guest_cap: null, ticket_price: null })
  })

  it('el precio acepta decimales', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: '250.50' }).ticket_price)
      .toBe(250.5)
  })

  it('el cupo rechaza decimales, cero y negativos', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '10.5', ticketPrice: '' }).guest_cap).toBeNull()
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '0', ticketPrice: '' }).guest_cap).toBeNull()
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '-5', ticketPrice: '' }).guest_cap).toBeNull()
  })

  it('el precio rechaza negativos y basura', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: '-1' }).ticket_price).toBeNull()
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: 'abc' }).ticket_price).toBeNull()
  })

  it('el cupo rechaza basura', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: 'muchos', ticketPrice: '' }).guest_cap).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- lib/features.test.ts`
Expected: FAIL con `normalizeAccessFields is not a function` / error de tipo en el import.

- [ ] **Step 3: Implementar en `lib/features.ts`**

Agregar al final del archivo:

```ts
function parseCap(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

function parsePrice(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function normalizeAccessFields(input: {
  accessMode: AccessMode
  guestCap: string
  ticketPrice: string
}): { guest_cap: number | null; ticket_price: number | null } {
  if (input.accessMode === 'privada') return { guest_cap: null, ticket_price: null }
  return {
    guest_cap: parseCap(input.guestCap),
    ticket_price: parsePrice(input.ticketPrice),
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- lib/features.test.ts`
Expected: PASS. 16 tests verdes (8 de la Task 2 + 8 de esta).

- [ ] **Step 5: Commit**

```bash
git add lib/features.ts lib/features.test.ts
git commit -m "feat(events): normaliza cupo y precio segun el modo de acceso"
```

---

### Task 4: Tipos de dominio en `lib/types.ts`

**Files:**
- Modify: `lib/types.ts` (linea 100 `Event`, linea 121 `EventSettings`, linea 146 zona de re-exports)

**Interfaces:**
- Consumes: `AccessMode` de `lib/features.ts` (Task 2).
- Produces: `Event.guest_cap`, `Event.ticket_price`, `EventSettings.access_mode`, y `AccessMode` re-exportado desde `lib/types.ts`.

**Por que los campos van opcionales (`?`):** `CLAUDE.md` prohibe tocar `lib/types.ts` sin confirmar compatibilidad con todo lo que usa el tipo. `Event` ya usa `?` para los campos que se agregaron despues (`host_name?`, `organization?`, `event_category?`) — este es el mismo caso. Opcional garantiza que ningun literal existente deje de compilar, y en esta fase nada lee los campos.

- [ ] **Step 1: Agregar los campos a `Event`**

Reemplazar el bloque `export type Event = { ... }` (linea 100-119) por:

```ts
export type Event = {
  id: string
  user_id: string
  name: string
  event_date: string | null
  event_end_date: string | null
  event_time: string | null
  event_type: string | null
  event_status: EventStatus
  venue: string | null
  address: string | null
  total_guests: number
  guest_tags: string[]
  currency: Currency
  created_at: string
  host_name?: string | null
  host_name_2?: string | null
  organization?: string | null
  event_category?: string | null
  guest_cap?: number | null
  ticket_price?: number | null
}
```

- [ ] **Step 2: Agregar el campo a `EventSettings`**

En el bloque `export type EventSettings = { ... }` (linea 121-137), agregar despues de la linea
`enabled_features: import('./features').EnabledFeatures | null`:

```ts
  access_mode?: import('./features').AccessMode | null
```

Se usa la forma `import('./features').X` porque es exactamente como el archivo ya declara
`enabled_features` y `dress_code`.

- [ ] **Step 3: Re-exportar `AccessMode`**

Agregar junto al re-export que ya existe en la linea 146 (`export type { InviteDoc } from './invite/schema'`):

```ts
export type { AccessMode } from './features'
```

- [ ] **Step 4: Verificar que nada se rompio**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm test`
Expected: PASS, toda la suite (incluido `lib/types.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts
git commit -m "feat(events): tipos de access mode, guest cap y ticket price"
```

---

### Task 5: `NewEventModal` — de 3 a 4 pasos con el paso Acceso

**Files:**
- Modify: `app/components/NewEventModal.tsx`

**Interfaces:**
- Consumes: `ACCESS_MODES`, `getDefaultAccessMode`, `AccessMode` de `lib/features.ts` (Task 2).
- Produces: los estados `accessMode` / `guestCap` / `ticketPrice` que la Task 6 lee para el insert.

**Alcance de esta task:** solo la UI y el estado. **El insert NO se toca aqui** (es la Task 6). Al terminar esta task el modal se ve y navega bien, pero todavia no guarda los campos nuevos.

- [ ] **Step 1: Actualizar los imports**

Linea 10, sumar lo nuevo:

```ts
import { FEATURES, ALWAYS_ON_FEATURES, ACCESS_MODES, getDefaultFeatures, getDefaultAccessMode, type FeatureKey, type AccessMode } from '@/lib/features'
```

- [ ] **Step 2: Ampliar el estado a 4 pasos**

Linea 28, cambiar el tipo del step:

```ts
  const [step, setStep]                   = useState<1 | 2 | 3 | 4>(1)
```

Despues de la linea 41 (`const [features, setFeatures] = ...`), agregar:

```ts
  const [accessMode, setAccessMode]       = useState<AccessMode>('aprobacion')
  const [guestCap, setGuestCap]           = useState('')
  const [ticketPrice, setTicketPrice]     = useState('')
```

- [ ] **Step 3: Resetear los campos nuevos**

En `resetForm` (linea 60-69), despues de `setFeatures(getDefaultFeatures('otro'))`:

```ts
    setAccessMode('aprobacion')
    setGuestCap('')
    setTicketPrice('')
```

- [ ] **Step 4: Precargar el acceso al elegir el tipo**

Reemplazar `handleSelectType` (linea 77-82):

```ts
  const handleSelectType = (type: EventTypeConfig) => {
    setEventType(type)
    setFeatures(getDefaultFeatures(type.value))
    setAccessMode(getDefaultAccessMode(type.value))
    setStep(2)
    setError('')
  }
```

- [ ] **Step 5: Arreglar la navegacion para 4 pasos**

Reemplazar `handleBack` y `handleNext` (lineas 84-94):

```ts
  const handleBack = () => {
    setStep(prev => (prev === 4 ? 3 : prev === 3 ? 2 : 1))
    setError('')
  }

  const handleNext = () => {
    if (step === 2) {
      if (!name.trim()) { setError('El nombre del evento es obligatorio'); return }
      if (!date)        { setError('La fecha del evento es obligatoria'); return }
      setError('')
      setStep(3)
      return
    }
    if (step === 3) {
      setError('')
      setStep(4)
    }
  }
```

- [ ] **Step 6: Renombrar el paso de herramientas a `renderStep4`**

El bloque que hoy se llama `renderStep3` (lineas 335-401, el de las herramientas) **no cambia por
dentro**. Solo cambia su nombre y su comentario de seccion:

```ts
  // ─── Paso 4 — Herramientas ───────────────────────────────────────────────

  const renderStep4 = () => {
```

El resto del cuerpo queda **identico**, incluida la linea final
`<p className="text-center text-[11px] text-[#aaa]">Puedes cambiar esto después en Configuración</p>`.

- [ ] **Step 7: Escribir el nuevo `renderStep3` (Acceso)**

Insertar **antes** de `renderStep4`:

```tsx
  // ─── Paso 3 — Acceso ─────────────────────────────────────────────────────

  const renderStep3 = () => {
    if (!eventType) return null
    const recommended = getDefaultAccessMode(eventType.value)

    return (
      <div className="flex flex-col gap-4">

        <div className="flex flex-col gap-2">
          {ACCESS_MODES.map(m => {
            const Icon = m.icon
            const on = accessMode === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setAccessMode(m.key)}
                className={
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition ' +
                  (on ? 'border-[#c8ede7] bg-[#f0fdfb]' : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]')
                }
              >
                <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (on ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                  <Icon size={18} className={on ? 'text-[#0F6E56]' : 'text-[#888]'} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#1D1E20]">{m.label}</p>
                    {recommended === m.key && (
                      <span className="rounded-full border border-[#f0e2c0] bg-[#fffbf0] px-2 py-0.5 text-[10px] font-semibold text-[#c49a3a]">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#888]">{m.description}</p>
                </div>
                <div className={
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ' +
                  (on ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#ddd] bg-white')
                }>
                  {on && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </button>
            )
          })}
        </div>

        {accessMode === 'privada' ? (
          <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5 text-xs text-[#888]">
            Este evento va por lista de invitados: sin cupo ni cobro.
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#555]">
                Cupo máximo
                <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={guestCap}
                onChange={e => setGuestCap(e.target.value)}
                placeholder="Sin límite"
                className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#555]">
                Precio del boleto
                <span className="ml-1 font-normal text-[#bbb]">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={ticketPrice}
                  onChange={e => setTicketPrice(e.target.value)}
                  placeholder="Gratis"
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 pr-14 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#aaa]">
                  MXN
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#aaa]">Anfiora no procesa el pago. Tú recibes el dinero directo.</p>
            </div>
          </>
        )}

      </div>
    )
  }
```

- [ ] **Step 8: Actualizar el stepper del header**

Reemplazar el array de pasos (linea 436):

```tsx
                    {([[1, 'Tipo'], [2, 'Datos'], [3, 'Acceso'], [4, 'Herramientas']] as [number, string][]).map(([n, label], i) => (
```

- [ ] **Step 9: Actualizar el titulo y el subtitulo del header**

Reemplazar el `<h2>` y el `<p>` que le sigue (lineas 467-476):

```tsx
              <h2 className="mt-3 text-lg font-bold text-[#1D1E20]">
                {step === 1
                  ? 'Nuevo evento'
                  : step === 3
                    ? '¿Cómo confirmas invitados?'
                    : eventType?.label ?? 'Nuevo evento'}
              </h2>
              <p className="mt-0.5 text-xs text-[#888]">
                {step === 1
                  ? 'Elige el tipo para personalizar los campos'
                  : step === 2
                    ? 'Completa los datos del evento'
                    : step === 3
                      ? 'Define quién puede sumarse a tu evento'
                      : 'Activa las herramientas de tu evento'}
              </p>
```

- [ ] **Step 10: Enrutar el render al paso correcto**

Reemplazar la linea 489:

```tsx
                  {step === 1 ? renderStep1() : step === 2 ? renderStep2() : step === 3 ? renderStep3() : renderStep4()}
```

- [ ] **Step 11: Arreglar el footer**

Reemplazar el bloque condicional del footer (lineas 511-526):

```tsx
                  {step < 4 ? (
                    <button
                      onClick={handleNext}
                      className="flex-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
                    >
                      Siguiente
                    </button>
                  ) : (
                    <button
                      onClick={handleCreate}
                      disabled={loading}
                      className="flex-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
                    >
                      {loading ? 'Creando evento...' : 'Crear evento'}
                    </button>
                  )}
```

- [ ] **Step 12: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 13: Commit**

```bash
git add app/components/NewEventModal.tsx
git commit -m "feat(events): paso de acceso en el modal de creacion, ahora de cuatro pasos"
```

---

### Task 6: Guardar los tres campos

**Files:**
- Modify: `app/components/NewEventModal.tsx` (`handleCreate`, lineas 96-147)

**Interfaces:**
- Consumes: `normalizeAccessFields` de `lib/features.ts` (Task 3); los estados `accessMode` / `guestCap` / `ticketPrice` (Task 5); las columnas de la Task 1.
- Produces: nada. Es la hoja del arbol.

**BLOQUEADA por la Task 1.** Sin las columnas en Supabase, este insert falla y rompe la creacion
de eventos incluso en local (Anfiora tiene una sola base y `localhost` pega a produccion).

- [ ] **Step 1: Sumar `normalizeAccessFields` al import**

Linea 10:

```ts
import { FEATURES, ALWAYS_ON_FEATURES, ACCESS_MODES, getDefaultFeatures, getDefaultAccessMode, normalizeAccessFields, type FeatureKey, type AccessMode } from '@/lib/features'
```

- [ ] **Step 2: Escribir el insert**

En `handleCreate`, despues de la guarda de `user` y antes del insert a `events`:

```ts
    const access = normalizeAccessFields({ accessMode, guestCap, ticketPrice })
```

Reemplazar el objeto del insert a `events` (lineas 108-121) por:

```ts
      .insert({
        user_id:        user.id,
        name:           name.trim(),
        event_type:     eventType.value,
        event_category: eventType.category,
        event_date:     date,
        event_end_date: endDate || null,
        event_time:     time || null,
        venue:          venue.trim() || null,
        host_name:      hostName.trim() || null,
        host_name_2:    hostName2.trim() || null,
        organization:   organization.trim() || null,
        total_guests:   0,
        guest_cap:      access.guest_cap,
        ticket_price:   access.ticket_price,
      })
```

Reemplazar el objeto del insert a `event_settings` (lineas 133-139) por:

```ts
      .insert({
        event_id:          eventData.id,
        playlist_token:    generatePlaylistToken(),
        message_templates: [],
        template_names:    [],
        enabled_features:  features,
        access_mode:       accessMode,
      })
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm test`
Expected: PASS, toda la suite.

- [ ] **Step 4: Commit**

```bash
git add app/components/NewEventModal.tsx
git commit -m "feat(events): add access mode, guest cap and ticket price to creation"
```

---

### Task 7: Verificacion end-to-end en local

**Files:** ninguno (solo verificacion).

**BLOQUEADA por la Task 1** (columnas) y la Task 6 (insert).

**Ojo:** `npm run build` mata el dev server (gotcha conocido de este repo). Correr el build al
final, no en medio de la verificacion manual.

- [ ] **Step 1: Suite completa**

```bash
npx tsc --noEmit
npm run lint
npm test
```
Expected: los tres limpios.

- [ ] **Step 2: Levantar el dev server**

Run: `npm run dev`
Expected: arranca en `http://localhost:3000`.

- [ ] **Step 3: Verificar el camino de la boda (privada)**

En `/dashboard`, crear un evento nuevo:
1. Paso 1: elegir **Boda**.
2. Paso 2: nombre y fecha. Siguiente.
3. Paso 3: confirmar que **"Invitación directa" viene pre-seleccionada con el badge "Recomendado"**,
   que **NO** se ven los campos de cupo y precio, y que sale la linea
   "Este evento va por lista de invitados: sin cupo ni cobro."
4. Paso 4: las herramientas de siempre. Crear evento.
5. En Supabase (solo lectura), confirmar: `events.guest_cap = NULL`, `events.ticket_price = NULL`,
   `event_settings.access_mode = 'privada'`.

- [ ] **Step 4: Verificar el camino de la conferencia (abierta, con cupo y precio)**

1. Paso 1: elegir **Conferencia**.
2. Paso 3: confirmar que **"Abierta" viene pre-seleccionada**, que aparecen cupo y precio, que el
   precio muestra `MXN` y la nota "Anfiora no procesa el pago. Tú recibes el dinero directo."
3. Poner cupo `250` y precio `1500.50`. Crear.
4. En Supabase: `guest_cap = 250`, `ticket_price = 1500.50`, `access_mode = 'abierta'`.

- [ ] **Step 5: Verificar la regla dura de privada**

1. Crear una **Fiesta** (default `abierta`).
2. Paso 3: llenar cupo `50` y precio `200`.
3. **Cambiar el acceso a "Invitación directa"** — los campos deben desaparecer. Crear.
4. En Supabase: `guest_cap = NULL`, `ticket_price = NULL`, `access_mode = 'privada'`.
   Este es el test que atrapa el bug de guardar un cupo que el usuario ya no puede ver.

- [ ] **Step 6: Verificar los defaults sin tocar nada**

Crear un evento de tipo **Despedida** dandole Siguiente sin tocar el paso 3.
En Supabase: `access_mode = 'aprobacion'`, cupo y precio `NULL`.

- [ ] **Step 7: Verificar que los eventos viejos no se rompieron**

Abrir un evento creado antes de esta rama. Debe cargar normal, con sus tres columnas en `NULL`.
Nada las lee, asi que no debe cambiar ningun comportamiento.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 9: Reportarle a Diego**

Resumir que se verifico y que se observo. **No** declarar nada "listo" sin haber corrido los pasos
y visto la salida. Si algo fallo, decirlo con la salida cruda.

Siguiente decision de Diego (fuera de este plan): merge y push, y si va a preview antes.

---

## Notas de handoff

- **Nada se pushea.** Al terminar, la rama vive local en el worktree.
- **Deuda registrada en el spec (seccion 10):** editar el acceso en `/configuracion` es
  **bloqueante** de la fase 2. No se puede shipear la pagina publica sin eso.
- **`feat/forms` sigue congelada** como donante para la pagina publica del evento.
- **`CLAUDE.md` esta desactualizado** en dos puntos que se confirmaron leyendo el codigo:
  lista `app/events/new/page.tsx`, que no existe; y su "Regla critica" de sincronia
  Supabase-Vercel se lee al reves de lo que ANF-054 necesita (ver spec, seccion 7).
  Actualizarlo es su propio PR, no entra aqui.
