# Puerta pública — Fase 2: la puerta gratis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un desconocido abra un link público, se registre con sus acompañantes y quede en la lista de invitados con su propia invitación personal — sin login, sin pago, respetando el cupo.

**Architecture:** La puerta **no es una página nueva**: es `/invitacion/[slug]/[token]` resuelta en *modo compartido*. Hoy `/api/invitacion/[token]` resuelve token → `guests.rsvp_token` → invitado → evento, y sin invitado da 404. Se bifurca esa resolución: si el token no es de ningún invitado, se busca en `event_settings.shared_token`. El alta va por ruta de API con **service role**, igual que ya hace todo ese endpoint — `guests` no tiene política RLS para `anon` y **la puerta no abre superficie anónima nueva**.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (service role en API routes), Tailwind v4, Vitest, `libphonenumber-js` vía `lib/phone.ts`.

## Global Constraints

- **Base:** rama `feat/puerta-publica-invitados` (PR #23, fase 1). Se sigue en la carpeta principal, **no** se crea worktree: la fase 1 ya vive ahí y `.next` de otra rama revienta Turbopack.
- **La puerta se honra solo si se cumplen las TRES:** el token es el `shared_token` del evento, `doc.meta.publicada === true`, y `access_mode === 'publica'`. Falla una → puerta cerrada.
- **Apagar la puerta = pasar el modo a `privada`.** No se crea un tercer interruptor. Los links personales siguen vivos.
- **Nunca se pisa el nombre de un invitado existente.** El dedupe reconoce y devuelve; no sobrescribe.
- **El teléfono se normaliza a E.164 con `toE164` de `lib/phone.ts`** antes de comparar. El código donante de `feat/forms` compara strings crudos: esa brecha se cierra aquí.
- **Acompañantes = filas reales en `party_members`** con `name: ''`. `party_size = 1 + N`. Guardar solo `party_size` haría que mesas cuente 1 donde se registraron 3.
- **Precio y `access_status` NO entran.** La fase 2 es gratis. Sin `amount_due`, sin `paid_at`, sin `hold_expires_at`, sin lista de espera.
- **Migración ANTES del código** (columnas nuevas). La corre Diego en Supabase; Claude nunca toca la base.
- **UI:** español con acentos, cero emojis, íconos Lucide, CTA `#48C9B0`, `#1D1E20` solo en dropdowns de filtro, mobile first.
- **Commits:** convencionales, sin acentos ni ñ.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `docs/superpowers/plans/sql/2026-07-15-puerta-fase-2.sql` | Migración: `shared_token`, `max_companions` |
| `lib/puerta.ts` | **Nuevo.** Lógica pura: cupo y parseo del registro |
| `lib/puerta.test.ts` | **Nuevo.** Tests de lo anterior |
| `lib/event-types.ts` | `defaultMaxCompanions` + `invitacion` en los públicos |
| `lib/features.ts` | `resolveMaxCompanions` |
| `lib/types.ts` | Campos nuevos de `event_settings` |
| `app/components/invitacion/types.ts` | `guest: InviteGuest \| null`, `mode: 'compartida'` |
| `app/components/invitacion/sections/RsvpSection.tsx` | Tolerar `guest` null |
| `app/components/invitacion/sections/SaludoSection.tsx` | Tolerar `guest` null |
| `app/components/invitacion/RegistroForm.tsx` | **Nuevo.** El formulario de la puerta |
| `app/api/invitacion/[token]/route.ts` | GET bifurcado a modo compartido |
| `app/api/invitacion/[token]/registro/route.ts` | **Nuevo.** POST de alta |
| `app/invitacion/[slug]/[token]/InvitacionClient.tsx` | Modo compartido + puerta cerrada |
| `app/events/[id]/invitacion/page.tsx` | Acuñar `shared_token` al publicar |
| `app/events/[id]/configuracion/page.tsx` | Mostrar y copiar el link público |

---

### Task 1: Migración y tipos

**Files:**
- Create: `docs/superpowers/plans/sql/2026-07-15-puerta-fase-2.sql`
- Modify: `lib/types.ts` (tipo `EventSettings`)

**Interfaces:**
- Produces: columnas `event_settings.shared_token` (text, nullable, unique) y `event_settings.max_companions` (int, nullable).

- [ ] **Step 1: Escribir el SQL**

```sql
-- Puerta publica fase 2. Correr ANTES de desplegar el codigo.
alter table event_settings add column if not exists shared_token text;
alter table event_settings add column if not exists max_companions integer;

-- El token es la llave de la puerta: debe ser unico y buscarse rapido.
create unique index if not exists event_settings_shared_token_key
  on event_settings (shared_token)
  where shared_token is not null;
```

- [ ] **Step 2: Diego lo corre en Supabase y confirma**

**PARAR AQUÍ.** No seguir sin confirmación explícita de Diego de que la migración corrió. El cliente de Supabase no está tipado (`createClient` sin genérico `Database`), así que `tsc` **no valida nombres de columna**: si el código sale antes que la migración, el fallo aparece en runtime, no en build.

Verificación que corre Diego:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'event_settings'
  and column_name in ('shared_token', 'max_companions');
```
Esperado: 2 filas, ambas `is_nullable = YES`.

- [ ] **Step 3: Agregar los campos al tipo**

En `lib/types.ts`, en el tipo `EventSettings`, junto a `requires_approval`:

```ts
  shared_token: string | null
  max_companions: number | null
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/sql/2026-07-15-puerta-fase-2.sql lib/types.ts
git commit -m "chore(puerta): migracion de shared token y max companions"
```

---

### Task 2: Los tipos públicos traen invitación y su máximo de acompañantes

**Files:**
- Modify: `lib/event-types.ts:11-43`
- Modify: `lib/features.ts` (agregar `resolveMaxCompanions`)
- Test: `lib/features.test.ts`

**Interfaces:**
- Consumes: `EventTypeConfig`, `AccessMode` de Task 1.
- Produces: `EventTypeConfig.defaultMaxCompanions: number` (requerido, como `defaultAccessMode`); `resolveMaxCompanions(eventTypeValue: string | null, stored: number | null): number`.

**Por qué:** de los 13 tipos públicos, solo 3 (cumpleaños, fiesta, despedida) traen `'invitacion'` en `defaultFeatures`. La puerta cuelga de la invitación, así que hoy una conferencia **no puede tener puerta**. Aprobado por Diego.

- [ ] **Step 1: Escribir el test que falla**

En `lib/features.test.ts`:

```ts
import { EVENT_TYPES } from './event-types'
import { resolveMaxCompanions } from './features'

describe('puerta publica: defaults por tipo', () => {
  it('todo tipo publico trae invitacion, porque la puerta cuelga de ella', () => {
    const sinInvitacion = EVENT_TYPES
      .filter(t => t.defaultAccessMode === 'publica')
      .filter(t => !(t.defaultFeatures || []).includes('invitacion'))
      .map(t => t.value)
    expect(sinInvitacion).toEqual([])
  })

  it('todo tipo declara su maximo de acompanantes', () => {
    for (const t of EVENT_TYPES) {
      expect(typeof t.defaultMaxCompanions).toBe('number')
      expect(t.defaultMaxCompanions).toBeGreaterThanOrEqual(0)
    }
  })

  it('lo guardado gana sobre el default', () => {
    expect(resolveMaxCompanions('boda', 3)).toBe(3)
  })

  it('sin nada guardado cae al default del tipo', () => {
    expect(resolveMaxCompanions('conferencia', null)).toBe(0)
  })

  it('un tipo desconocido no truena', () => {
    expect(resolveMaxCompanions('inventado', null)).toBe(1)
  })

  it('un guardado invalido cae al default', () => {
    expect(resolveMaxCompanions('boda', -2)).toBe(1)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run lib/features.test.ts`
Expected: FAIL — `resolveMaxCompanions is not a function` y la lista de tipos sin invitación no vacía.

- [ ] **Step 3: Agregar el campo al tipo de configuración**

En `lib/event-types.ts`, dentro de `EventTypeConfig` (L11-23), después de `defaultRequiresApproval: boolean`:

```ts
  defaultMaxCompanions: number
```

- [ ] **Step 4: Actualizar los 17 tipos**

Reemplazar `EVENT_TYPES` (L25-43). Cambios: `'invitacion'` agregado a `defaultFeatures` de los 10 tipos públicos que no lo traían, y `defaultMaxCompanions` en los 17. Los 4 privados (boda, xv, graduación, bautizo) **no cambian sus features**.

```ts
export const EVENT_TYPES: EventTypeConfig[] = [
  { value: 'boda',         label: 'Boda',          category: 'social',      icon: Gem,            hostLabel: 'Novia',                 host2Label: 'Novio',  showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'xv',           label: 'XV años',        category: 'social',      icon: Crown,          hostLabel: 'Festejada',             showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'cumpleanos',   label: 'Cumpleaños',     category: 'social',      icon: Cake,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'graduacion',   label: 'Graduación',     category: 'social',      icon: GraduationCap,  hostLabel: 'Graduado/a',            showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'bautizo',      label: 'Bautizo',        category: 'social',      icon: Sun,            hostLabel: 'Nombre del bautizado/a', showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'fiesta',       label: 'Fiesta',         category: 'social',      icon: PartyPopper,    hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['album', 'playlist', 'comida', 'vestimenta', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 2 },
  { value: 'despedida',    label: 'Despedida',      category: 'social',      icon: Wine,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 1 },
  { value: 'conferencia',  label: 'Conferencia',    category: 'corporativo', icon: Presentation,   hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 0 },
  { value: 'capacitacion', label: 'Capacitación',   category: 'corporativo', icon: Monitor,        hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['comida', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'teambuilding', label: 'Team Building',  category: 'corporativo', icon: UsersRound,     hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['album', 'comida', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'lanzamiento',  label: 'Lanzamiento',    category: 'corporativo', icon: Rocket,         hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 1 },
  { value: 'asamblea',     label: 'Asamblea',       category: 'corporativo', icon: Building2,      hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'retiro',       label: 'Retiro',         category: 'impacto',     icon: Tent,           hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'comida', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'congreso',     label: 'Congreso',       category: 'impacto',     icon: Mic,            hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 0 },
  { value: 'campamento',   label: 'Campamento',     category: 'impacto',     icon: Flame,          hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'playlist', 'comida', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'caridad',      label: 'Caridad',        category: 'impacto',     icon: HeartHandshake, hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 2 },
  { value: 'otro',         label: 'Otro',           category: 'social',      icon: CalendarDays,   hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 1 },
]
```

- [ ] **Step 5: Escribir `resolveMaxCompanions`**

En `lib/features.ts`, junto a `resolveRequiresApproval` (L101-111):

```ts
const DEFAULT_MAX_COMPANIONS = 1

export function resolveMaxCompanions(eventTypeValue: string | null, stored: number | null): number {
  const fallback = EVENT_TYPES.find(t => t.value === eventTypeValue)?.defaultMaxCompanions ?? DEFAULT_MAX_COMPANIONS
  if (stored === null || stored === undefined) return fallback
  if (!Number.isInteger(stored) || stored < 0) return fallback
  return stored
}
```

- [ ] **Step 6: Correr los tests**

Run: `npx vitest run lib/features.test.ts`
Expected: PASS.

- [ ] **Step 7: La suite completa, porque se tocó un tipo requerido**

Run: `npm test`
Expected: 303+ passing, cero fallos. `defaultMaxCompanions` es requerido: si algún test arma un `EventTypeConfig` a mano, truena aquí y hay que arreglarlo.

- [ ] **Step 8: Commit**

```bash
git add lib/event-types.ts lib/features.ts lib/features.test.ts
git commit -m "feat(puerta): los tipos publicos traen invitacion y maximo de acompanantes"
```

---

### Task 3: La lógica pura del cupo y del registro

**Files:**
- Create: `lib/puerta.ts`
- Test: `lib/puerta.test.ts`

**Interfaces:**
- Consumes: `toE164` de `lib/phone.ts` (L54).
- Produces:
  - `occupiedSeats(guests: { party_size: number | null }[]): number`
  - `seatsLeft(guestCap: number | null, occupied: number): number | null` — `null` = sin límite
  - `canFit(guestCap: number | null, occupied: number, partySize: number): boolean`
  - `parseRegistration(body: unknown, maxCompanions: number): Registration | null`
  - `type Registration = { name: string; phone: string; companions: number; partySize: number }`

- [ ] **Step 1: Escribir los tests que fallan**

`lib/puerta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { occupiedSeats, seatsLeft, canFit, parseRegistration } from './puerta'

describe('cupo', () => {
  it('el aforo suma party_size, no cabezas de fila', () => {
    expect(occupiedSeats([{ party_size: 3 }, { party_size: 2 }])).toBe(5)
  })

  it('un party_size nulo cuenta como una persona', () => {
    expect(occupiedSeats([{ party_size: null }, { party_size: 2 }])).toBe(3)
  })

  it('un party_size basura no rompe la cuenta', () => {
    expect(occupiedSeats([{ party_size: 0 }, { party_size: -4 }])).toBe(2)
  })

  it('sin cupo declarado no hay limite', () => {
    expect(seatsLeft(null, 500)).toBe(null)
  })

  it('los lugares que quedan nunca son negativos', () => {
    expect(seatsLeft(10, 14)).toBe(0)
  })

  it('cabe si alcanzan los lugares', () => {
    expect(canFit(10, 8, 2)).toBe(true)
  })

  it('no cabe si el grupo se pasa por uno', () => {
    expect(canFit(10, 8, 3)).toBe(false)
  })

  it('sin cupo siempre cabe', () => {
    expect(canFit(null, 9999, 5)).toBe(true)
  })
})

describe('parseo del registro', () => {
  const ok = { name: 'Ana Ruiz', phone: '5544332211', companions: 2 }

  it('normaliza el telefono a E.164', () => {
    expect(parseRegistration(ok, 3)?.phone).toBe('+525544332211')
  })

  it('el party_size incluye al que se registra', () => {
    expect(parseRegistration(ok, 3)?.partySize).toBe(3)
  })

  it('sin acompanantes el party_size es 1', () => {
    expect(parseRegistration({ ...ok, companions: 0 }, 3)?.partySize).toBe(1)
  })

  it('recorta los acompanantes al maximo del anfitrion', () => {
    expect(parseRegistration({ ...ok, companions: 9 }, 2)?.companions).toBe(2)
  })

  it('si el maximo es cero, va solo', () => {
    expect(parseRegistration({ ...ok, companions: 5 }, 0)?.companions).toBe(0)
  })

  it('un numero negativo de acompanantes se trata como cero', () => {
    expect(parseRegistration({ ...ok, companions: -3 }, 2)?.companions).toBe(0)
  })

  it('recorta espacios del nombre', () => {
    expect(parseRegistration({ ...ok, name: '  Ana Ruiz  ' }, 3)?.name).toBe('Ana Ruiz')
  })

  it('sin nombre no hay registro', () => {
    expect(parseRegistration({ ...ok, name: '   ' }, 3)).toBe(null)
  })

  it('un telefono impossible no pasa', () => {
    expect(parseRegistration({ ...ok, phone: '123' }, 3)).toBe(null)
  })

  it('sin telefono no hay registro, porque el telefono es la llave del dedupe', () => {
    expect(parseRegistration({ ...ok, phone: '' }, 3)).toBe(null)
  })

  it('un cuerpo que no es objeto no truena', () => {
    expect(parseRegistration(null, 3)).toBe(null)
    expect(parseRegistration('hola', 3)).toBe(null)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run lib/puerta.test.ts`
Expected: FAIL — no existe `./puerta`.

- [ ] **Step 3: Escribir `lib/puerta.ts`**

```ts
import { toE164 } from '@/lib/phone'

export type Registration = {
  name: string
  phone: string
  companions: number
  partySize: number
}

export function occupiedSeats(guests: { party_size: number | null }[]): number {
  return guests.reduce((sum, g) => {
    const n = Number(g.party_size)
    return sum + (Number.isFinite(n) && n > 0 ? n : 1)
  }, 0)
}

export function seatsLeft(guestCap: number | null, occupied: number): number | null {
  if (guestCap === null || guestCap === undefined) return null
  return Math.max(0, guestCap - occupied)
}

export function canFit(guestCap: number | null, occupied: number, partySize: number): boolean {
  const left = seatsLeft(guestCap, occupied)
  if (left === null) return true
  return partySize <= left
}

export function parseRegistration(body: unknown, maxCompanions: number): Registration | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name) return null

  const rawPhone = typeof b.phone === 'string' ? b.phone.trim() : ''
  if (!rawPhone) return null
  const phone = toE164(rawPhone)
  if (!phone) return null

  const raw = Number(b.companions)
  const asked = Number.isFinite(raw) ? Math.floor(raw) : 0
  const companions = Math.min(Math.max(0, asked), Math.max(0, maxCompanions))

  return { name, phone, companions, partySize: 1 + companions }
}
```

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run lib/puerta.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/puerta.ts lib/puerta.test.ts
git commit -m "feat(puerta): logica pura de cupo y parseo de registro"
```

---

### Task 4: El token público se acuña al publicar

**Files:**
- Modify: `app/events/[id]/invitacion/page.tsx:128-151` (`handlePublish`)

**Interfaces:**
- Consumes: `randomToken()` (ya existe en ese archivo, se usa en L143).
- Produces: `event_settings.shared_token` poblado tras publicar.

**Por qué aquí:** `handlePublish` **ya reparte tokens** — L136-145 le da `rsvp_token` a los invitados que no tenían. El token público se suma al mismo gesto. Decisión de Diego: "se crea al momento de crear la invitación". No hay botón aparte: la puerta ya exige `publicada`, un segundo interruptor sería para lo mismo.

**Nota de seguridad:** que el token exista no abre nada. Es una URL aleatoria: para entrar hay que tenerla. La puerta se honra solo con `access_mode === 'publica'` (Task 5), así que un evento privado con token acuñado no tiene puerta.

- [ ] **Step 1: Acuñar el token dentro de `handlePublish`**

Reemplazar el bloque `try` de `handlePublish` (L134-148) por:

```ts
    try {
      await persist(next)

      const { data: settings } = await supabase
        .from('event_settings')
        .select('shared_token')
        .eq('event_id', eventId)
        .maybeSingle()
      if (settings && !settings.shared_token) {
        await supabase
          .from('event_settings')
          .update({ shared_token: randomToken() })
          .eq('event_id', eventId)
          .is('shared_token', null)
      }

      const { data: pending, error } = await supabase
        .from('guests')
        .select('id')
        .eq('event_id', eventId)
        .is('rsvp_token', null)
      if (!error && pending && pending.length > 0) {
        await Promise.all(
          pending.map(g => supabase.from('guests').update({ rsvp_token: randomToken() }).eq('id', g.id)),
        )
      }
    } catch {
      // Ni el token compartido ni los rsvp_token deben bloquear la publicacion.
    } finally {
```

El `.is('shared_token', null)` en el UPDATE es la red: si dos pestañas publican a la vez, la segunda no pisa el token de la primera.

- [ ] **Step 2: Verificar a mano en local**

Run: `npm run dev`
1. Abrir `/events/<id>/invitacion` de un evento de prueba y picar **Publicar**.
2. Diego corre en Supabase: `select shared_token from event_settings where event_id = '<id>';`
   Esperado: un token, no null.
3. Picar **Publicar** otra vez.
4. Correr la misma consulta. **Esperado: el MISMO token.** Si cambió, el guardia falló y todos los links repartidos se rompieron.

- [ ] **Step 3: Commit**

```bash
git add "app/events/[id]/invitacion/page.tsx"
git commit -m "feat(puerta): acuna el token publico al publicar la invitacion"
```

---

### Task 5: El API resuelve el modo compartido

**Files:**
- Modify: `app/api/invitacion/[token]/route.ts:27-76`
- Modify: `app/invitacion/[slug]/[token]/page.tsx:15-56` (`generateMetadata`)

**Interfaces:**
- Consumes: `resolveDoc`, `AccessMode`, `resolveAccessMode` (`lib/features.ts:92-99`), `resolveMaxCompanions` (Task 2), `occupiedSeats`/`seatsLeft` (Task 3).
- Produces: el GET responde con `guest: null`, `mode: 'compartida'` y `puerta: { seatsLeft, maxCompanions, cerrada }` cuando el token es el del evento.

- [ ] **Step 1: Reemplazar `fetchGuestAndDoc` por una resolución bifurcada**

Sustituir `fetchGuestAndDoc` (L27-40) por:

```ts
type Resolved =
  | { kind: 'guest'; guest: GuestRow; eventId: string; settings: SettingsRow | null; doc: ReturnType<typeof resolveDoc> }
  | { kind: 'compartida'; guest: null; eventId: string; settings: SettingsRow | null; doc: ReturnType<typeof resolveDoc> }

type SettingsRow = {
  invite_config: unknown
  playlist_token: string | null
  registry_token: string | null
  access_mode: string | null
  guest_cap: number | null
  max_companions: number | null
}

async function fetchSettings(db: ReturnType<typeof admin>, eventId: string) {
  return safeSingle<SettingsRow>(
    db.from('event_settings')
      .select('invite_config, playlist_token, registry_token, access_mode, guest_cap, max_companions')
      .eq('event_id', eventId)
      .maybeSingle(),
  )
}

async function resolveToken(db: ReturnType<typeof admin>, token: string): Promise<Resolved | null> {
  const { data: guest } = await db
    .from('guests')
    .select('id, event_id, name, party_size, rsvp_status, allergies')
    .eq('rsvp_token', token)
    .maybeSingle<GuestRow>()

  if (guest) {
    const settings = await fetchSettings(db, guest.event_id)
    return { kind: 'guest', guest, eventId: guest.event_id, settings, doc: resolveDoc(settings?.invite_config, () => crypto.randomUUID()) }
  }

  // No es de ningun invitado: puede ser la puerta publica del evento.
  const shared = await safeSingle<{ event_id: string }>(
    db.from('event_settings').select('event_id').eq('shared_token', token).maybeSingle(),
  )
  if (!shared) return null

  const settings = await fetchSettings(db, shared.event_id)
  return { kind: 'compartida', guest: null, eventId: shared.event_id, settings, doc: resolveDoc(settings?.invite_config, () => crypto.randomUUID()) }
}
```

Nota: `guest_cap` vive en `events`, no en `event_settings`. Se corrige en el Step siguiente — aquí se deja el select de `event_settings` sin `guest_cap`:

```ts
      .select('invite_config, playlist_token, registry_token, access_mode, max_companions')
```
y `SettingsRow` sin `guest_cap`.

- [ ] **Step 2: Reescribir el GET**

Reemplazar el `GET` (L42-76):

```ts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const found = await resolveToken(db, token)
  if (!found || !found.doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { guest, settings, doc, eventId } = found

  const [event, members, dressRow, itin] = await Promise.all([
    safeSingle<{ name: string; event_type: string | null; event_date: string | null; event_time: string | null; venue: string | null; address: string | null; host_name: string | null; host_name_2: string | null; guest_cap: number | null }>(
      db.from('events').select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2, guest_cap').eq('id', eventId).maybeSingle(),
    ),
    guest
      ? safeList<{ id: string; name: string; rsvp_status: string; allergies: string[] | null }>(
          db.from('party_members').select('id, name, rsvp_status, allergies').eq('guest_id', guest.id).order('created_at', { ascending: true }),
        )
      : Promise.resolve([]),
    safeSingle<{ dress_code: unknown }>(
      db.from('event_settings').select('dress_code').eq('event_id', eventId).maybeSingle(),
    ),
    safeList<{ start_time: string; title: string; location: string | null; visible_to_guests: boolean; position: number }>(
      db.from('event_itinerary_moments').select('start_time, title, location, visible_to_guests, position').eq('event_id', eventId).eq('visible_to_guests', true),
    ),
  ])
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const accessMode = resolveAccessMode(event.event_type, settings?.access_mode ?? null)

  // La puerta se honra solo si las tres se cumplen: token del evento, publicada y modo publica.
  if (found.kind === 'compartida' && accessMode !== 'publica') {
    return NextResponse.json({ error: 'cerrada' }, { status: 403 })
  }

  const { event: _cap, ...rest } = { event }
  const eventOut = {
    name: event.name, event_type: event.event_type, event_date: event.event_date, event_time: event.event_time,
    venue: event.venue, address: event.address, host_name: event.host_name, host_name_2: event.host_name_2,
  }

  let puerta: { seatsLeft: number | null; maxCompanions: number; agotado: boolean } | null = null
  if (found.kind === 'compartida') {
    const all = await safeList<{ party_size: number | null }>(
      db.from('guests').select('party_size').eq('event_id', eventId),
    )
    const left = seatsLeft(event.guest_cap ?? null, occupiedSeats(all))
    puerta = {
      seatsLeft: left,
      maxCompanions: resolveMaxCompanions(event.event_type, settings?.max_companions ?? null),
      agotado: left !== null && left < 1,
    }
  }

  return NextResponse.json({
    event: eventOut,
    guest: guest
      ? { name: guest.name, party_size: guest.party_size, rsvp_status: guest.rsvp_status, allergies: guest.allergies || [] }
      : null,
    companions: members.map(m => ({ id: m.id, name: m.name, rsvp_status: m.rsvp_status, allergies: m.allergies || [] })),
    doc,
    dressCode: parseDressCode(dressRow?.dress_code),
    itinerary: curateForGuests(itin),
    tokens: { playlist: settings?.playlist_token ?? null, registry: settings?.registry_token ?? null },
    mode: found.kind === 'compartida' ? 'compartida' : 'personal',
    puerta,
  })
}
```

Borrar la línea muerta `const { event: _cap, ...rest } = { event }` — quedó de la extracción; **no dejarla**.

Agregar al bloque de imports (L3-7):
```ts
import { resolveAccessMode, resolveMaxCompanions } from '@/lib/features'
import { occupiedSeats, seatsLeft } from '@/lib/puerta'
```

- [ ] **Step 3: Que el POST de RSVP siga siendo solo para invitados**

En el `POST` (L96-103), reemplazar el uso de `fetchGuestAndDoc`:

```ts
  const found = await resolveToken(db, token)
  if (!found || !found.doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (found.kind !== 'guest') return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { guest, doc } = found
```

Sin esto, un POST de RSVP con el token compartido llegaría con `guest = null` y reventaría en `guest.id`.

- [ ] **Step 4: `generateMetadata` también resuelve el token compartido**

En `app/invitacion/[slug]/[token]/page.tsx`, reemplazar L19-20:

```ts
    const { data: guest } = await db.from('guests').select('event_id').eq('rsvp_token', token).maybeSingle()
    let eventId = guest?.event_id as string | undefined
    if (!eventId) {
      const { data: shared } = await db.from('event_settings').select('event_id').eq('shared_token', token).maybeSingle()
      eventId = shared?.event_id as string | undefined
    }
    if (!eventId) return FALLBACK_METADATA
```

Y sustituir los dos `guest.event_id` restantes (L25 y L33) por `eventId`.

Sin esto, el link público compartido en WhatsApp muestra "Invitación" genérica en vez del nombre del evento.

- [ ] **Step 5: Verificar en local**

Run: `npm run dev`
1. `curl http://localhost:3000/api/invitacion/<shared_token>` → JSON con `"guest":null`, `"mode":"compartida"`, `"puerta":{...}`.
2. `curl http://localhost:3000/api/invitacion/<rsvp_token_de_un_invitado>` → `"guest":{...}`, `"mode":"personal"`, `"puerta":null`.
3. Pasar el evento a **privada** en `/configuracion` → repetir (1) → **403 `cerrada`**.
4. `curl http://localhost:3000/api/invitacion/inventado` → 404.

- [ ] **Step 6: Commit**

```bash
git add "app/api/invitacion/[token]/route.ts" "app/invitacion/[slug]/[token]/page.tsx"
git commit -m "feat(puerta): el api resuelve el token compartido del evento"
```

---

### Task 6: El renderer tolera que no haya invitado

**Files:**
- Modify: `app/components/invitacion/types.ts:11-26`
- Modify: `app/components/invitacion/sections/RsvpSection.tsx:24-39`
- Modify: `app/components/invitacion/sections/SaludoSection.tsx:9-15`

**Interfaces:**
- Produces: `InviteCtx.guest: InviteGuest | null`, `InviteCtx.mode: 'preview' | 'public' | 'compartida'`.

**Por qué solo estos dos:** `InvitacionRenderer` no toca `ctx.guest` (solo `ctx.event`). De las 14 secciones, **únicamente** `RsvpSection` (L27-29) y `SaludoSection` (L14-15) lo leen. Todo lo demás cuelga del evento y se pinta igual.

- [ ] **Step 1: Aflojar el tipo**

En `types.ts`, L16 y L21:

```ts
  guest: InviteGuest | null
```
```ts
  mode: 'preview' | 'public' | 'compartida'
```

- [ ] **Step 2: Verificar que tsc encuentra exactamente los dos consumidores**

Run: `npx tsc --noEmit`
Expected: FAIL con errores en `RsvpSection.tsx` y `SaludoSection.tsx`. **Si aparece un tercer archivo, parar y avisar** — el mapa decía dos, y un tercero significa que algo no se auditó.

- [ ] **Step 3: `SaludoSection` saluda sin nombre**

En `SaludoSection.tsx`, donde hoy usa `ctx.guest.name` (L14-15), anteponer:

```ts
  const nombre = ctx.guest?.name?.trim() || ''
```
y usar `nombre` en lugar de `ctx.guest.name`. Donde el copy dependa de tener nombre, la rama sin nombre usa el saludo genérico de la sección (sin inventar un "Hola, invitado").

- [ ] **Step 4: `RsvpSection` no se pinta en modo compartido**

En `RsvpSection.tsx`, al inicio del componente (L90):

```ts
  if (ctx.mode === 'compartida' || !ctx.guest) return null
```

En modo compartido el RSVP no aplica: todavía no hay a quién confirmar. El registro (Task 8) lo sustituye. Esto además protege `buildRows(ctx)` (L24-39), que corre en el inicializador de `useState` y reventaría con `guest` null.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm test`
Expected: cero errores, 303+ tests passing.

- [ ] **Step 6: Commit**

```bash
git add app/components/invitacion/types.ts app/components/invitacion/sections/RsvpSection.tsx app/components/invitacion/sections/SaludoSection.tsx
git commit -m "feat(puerta): el renderer tolera invitacion sin invitado"
```

---

### Task 7: El alta

**Files:**
- Create: `app/api/invitacion/[token]/registro/route.ts`

**Interfaces:**
- Consumes: `parseRegistration`, `occupiedSeats`, `canFit` (Task 3); `resolveAccessMode`, `resolveMaxCompanions` (Task 2).
- Produces: `POST /api/invitacion/[token]/registro` → `{ rsvp_token: string; ya_estaba: boolean }` | `{ error: 'agotado' | 'cerrada' | 'bad_request' | 'not_found' }`.

**Las tres reglas de este endpoint:**
1. **Dedupe por teléfono E.164** dentro del evento. Si ya existe: **no se pisa el nombre**, se devuelve su `rsvp_token`. El código donante de `feat/forms` (`route.ts:86-88`) hace `UPDATE guests SET name` — eso sobrescribiría el nombre que el planner curó. No se copia ese comportamiento.
2. **Los acompañantes son filas de `party_members`**, no solo `party_size`.
3. **El cupo se revisa contra el aforo real** justo antes de insertar.

- [ ] **Step 1: Escribir la ruta**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveDoc } from '@/lib/invite/doc'
import { resolveAccessMode, resolveMaxCompanions } from '@/lib/features'
import { parseRegistration, occupiedSeats, canFit } from '@/lib/puerta'
import { logAction } from '@/lib/audit'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const { data: settings } = await db
    .from('event_settings')
    .select('event_id, invite_config, access_mode, max_companions')
    .eq('shared_token', token)
    .maybeSingle()
  if (!settings) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const doc = resolveDoc(settings.invite_config, () => crypto.randomUUID())
  if (!doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: event } = await db
    .from('events')
    .select('event_type, guest_cap')
    .eq('id', settings.event_id)
    .maybeSingle()
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (resolveAccessMode(event.event_type, settings.access_mode) !== 'publica') {
    return NextResponse.json({ error: 'cerrada' }, { status: 403 })
  }

  const maxCompanions = resolveMaxCompanions(event.event_type, settings.max_companions)
  const body = await req.json().catch(() => null)
  const reg = parseRegistration(body, maxCompanions)
  if (!reg) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { data: existing } = await db
    .from('guests')
    .select('id, rsvp_token')
    .eq('event_id', settings.event_id)
    .eq('phone', reg.phone)
    .maybeSingle()

  // Ya se habia registrado: se le devuelve SU invitacion. No se pisa el nombre
  // que pudo haber escrito el planner, ni se le cobra otro lugar del cupo.
  if (existing) {
    let rsvpToken = existing.rsvp_token as string | null
    if (!rsvpToken) {
      rsvpToken = randomToken()
      await db.from('guests').update({ rsvp_token: rsvpToken }).eq('id', existing.id)
    }
    return NextResponse.json({ rsvp_token: rsvpToken, ya_estaba: true })
  }

  const { data: all } = await db
    .from('guests')
    .select('party_size')
    .eq('event_id', settings.event_id)
  if (!canFit(event.guest_cap ?? null, occupiedSeats(all || []), reg.partySize)) {
    return NextResponse.json({ error: 'agotado' }, { status: 409 })
  }

  const rsvpToken = randomToken()
  const { data: created, error: insertError } = await db
    .from('guests')
    .insert({
      event_id: settings.event_id,
      name: reg.name,
      phone: reg.phone,
      party_size: reg.partySize,
      rsvp_status: 'confirmed',
      rsvp_token: rsvpToken,
    })
    .select('id')
    .single()
  if (insertError || !created) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  // Los acompanantes son filas reales: mesas y check-in derivan de ellas,
  // no de party_size. Sin nombre, que es una forma que el modelo ya soporta.
  if (reg.companions > 0) {
    await db.from('party_members').insert(
      Array.from({ length: reg.companions }, () => ({
        guest_id: created.id,
        event_id: settings.event_id,
        name: '',
        rsvp_status: 'confirmed',
      })),
    )
  }

  await db.rpc('increment_guests_by', { event_id_input: settings.event_id, amount: reg.partySize })

  try {
    await logAction({
      eventId: settings.event_id,
      action: 'guest.created',
      entityType: 'guest',
      entityId: created.id,
      entityLabel: reg.name,
    })
  } catch {
    // silent fail: nunca debe romper el registro del invitado
  }

  return NextResponse.json({ rsvp_token: rsvpToken, ya_estaba: false })
}
```

- [ ] **Step 2: Confirmar que `guest.created` existe en el tipo `AuditAction`**

Run: `npx tsc --noEmit`
Si `'guest.created'` no está en el union de `lib/audit.ts`, usar el valor que sí exista para el alta de invitado (revisar `AUDIT_ACTION_LABEL`). **No inventar un valor nuevo** — el tipo es la fuente.

- [ ] **Step 3: Verificar el camino feliz en local**

Con el evento de prueba en **pública**, `guest_cap = 5`, y `max_companions = 2`:

```bash
curl -X POST http://localhost:3000/api/invitacion/<shared_token>/registro \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Ruiz","phone":"5544332211","companions":2}'
```
Expected: `{"rsvp_token":"...","ya_estaba":false}`

Diego verifica en Supabase:
```sql
select g.name, g.phone, g.party_size, g.rsvp_status, count(pm.id) as miembros
from guests g left join party_members pm on pm.guest_id = g.id
where g.event_id = '<id>' group by g.id;
```
Esperado: `phone = '+525544332211'` (E.164, no crudo), `party_size = 3`, `miembros = 2`.

- [ ] **Step 4: Verificar el dedupe**

Repetir el mismo curl con **otro nombre** y el mismo teléfono.
Expected: `{"rsvp_token":"<EL MISMO de antes>","ya_estaba":true}`
Y en la base: **sigue habiendo una sola fila** y **el nombre sigue siendo "Ana Ruiz"**. Si el nombre cambió, el dedupe está pisando y hay que arreglarlo.

- [ ] **Step 5: Verificar el cupo**

Con `guest_cap = 5` y 3 lugares tomados, registrar a alguien con 2 acompañantes (pide 3, quedan 2):
Expected: HTTP 409, `{"error":"agotado"}`, y **cero filas nuevas** en `guests`.

- [ ] **Step 6: Commit**

```bash
git add "app/api/invitacion/[token]/registro/route.ts"
git commit -m "feat(puerta): alta de invitado publico con dedupe por telefono"
```

---

### Task 8: El formulario de la puerta

**Files:**
- Create: `app/components/invitacion/RegistroForm.tsx`
- Modify: `app/invitacion/[slug]/[token]/InvitacionClient.tsx`

**Interfaces:**
- Consumes: el GET de Task 5 (`mode`, `puerta`), el POST de Task 7.
- Produces: `<RegistroForm token maxCompanions botonClassName onDone />`.

**Comportamiento:** al registrarse, el navegador va a **su link personal** (`/invitacion/<slug>/<rsvp_token>`). Ahí ve su invitación completa, idéntica a la de una boda. Es la promesa del spec: *"un evento público se ve tan bonito como una boda, gratis"*.

- [ ] **Step 1: Escribir el formulario**

```tsx
'use client'

import { useState } from 'react'
import { formatAsYouType } from '@/lib/phone'

type Props = {
  token: string
  maxCompanions: number
  botonClassName?: string
  onDone: (rsvpToken: string) => void
}

export default function RegistroForm({ token, maxCompanions, botonClassName, onDone }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [companions, setCompanions] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/invitacion/${token}/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, companions }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(
          json?.error === 'agotado' ? 'Ya no quedan lugares para tu grupo.'
          : json?.error === 'cerrada' ? 'Los registros están cerrados.'
          : json?.error === 'bad_request' ? 'Revisa tu nombre y tu WhatsApp.'
          : 'No pudimos registrarte. Intenta de nuevo.',
        )
        return
      }
      onDone(json.rsvp_token as string)
    } catch {
      setError('No pudimos registrarte. Intenta de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <div>
        <label htmlFor="reg-name" className="mb-1 block text-xs font-medium text-[#666]">Tu nombre</label>
        <input id="reg-name" value={name} onChange={e => setName(e.target.value)} required className={inputClass} placeholder="Nombre y apellido" />
      </div>

      <div>
        <label htmlFor="reg-phone" className="mb-1 block text-xs font-medium text-[#666]">Tu WhatsApp</label>
        <input id="reg-phone" value={phone} onChange={e => setPhone(formatAsYouType(e.target.value))} required inputMode="tel" className={inputClass} placeholder="55 1234 5678" />
      </div>

      {maxCompanions > 0 && (
        <div>
          <label htmlFor="reg-companions" className="mb-1 block text-xs font-medium text-[#666]">¿Cuántos vienen contigo?</label>
          <select id="reg-companions" value={companions} onChange={e => setCompanions(Number(e.target.value))} className={inputClass}>
            {Array.from({ length: maxCompanions + 1 }, (_, i) => (
              <option key={i} value={i}>{i === 0 ? 'Vengo solo' : `${i}`}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">{error}</p>
      )}

      <button type="submit" disabled={sending} className={botonClassName || 'rounded-lg bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60'}>
        {sending ? 'Registrando...' : 'Confirmar mi lugar'}
      </button>
    </form>
  )
}
```

Si `maxCompanions` es 0 el campo **no se pinta** — nada de un contador clavado en cero que invita a intentarlo.

- [ ] **Step 2: Conectar `InvitacionClient` al modo compartido**

Cambios en `InvitacionClient.tsx`:

En `ApiData` (L13-21):
```ts
type ApiData = {
  event: InviteCtx['event']
  guest: InviteGuest | null
  companions: InviteCompanion[]
  doc: InviteDoc
  dressCode: DressCode | null
  itinerary: { start_time: string; title: string; location: string | null }[]
  tokens: { playlist: string | null; registry: string | null }
  mode: 'personal' | 'compartida'
  puerta: { seatsLeft: number | null; maxCompanions: number; agotado: boolean } | null
}
```

En `handleSubmit` (L77-81), proteger el spread de un guest nulo:
```ts
    setData(prev => prev && prev.guest ? {
      ...prev,
      guest: { ...prev.guest, rsvp_status: result.guest.rsvp_status, allergies: result.guest.allergies },
      companions: result.companions,
    } : prev)
```

En `ctx` (L84-95):
```ts
  const ctx: InviteCtx = {
    event: data.event,
    guest: data.guest,
    companions: data.companions,
    dressCode: data.dressCode,
    itinerary: data.itinerary,
    tokens: data.tokens,
    mode: data.mode === 'compartida' ? 'compartida' : 'public',
    onSubmit: data.mode === 'compartida' ? undefined : handleSubmit,
    deadlinePassed: !isInviteOpen(data.doc.meta, todayISO()),
    botonClassName: botonClass(data.doc.theme),
  }
```

Y el render (L97-103):
```tsx
  const registro = data.mode === 'compartida' && data.puerta && !data.puerta.agotado && !ctx.deadlinePassed

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      <PreviewBoundary>
        <InvitacionRenderer doc={data.doc} ctx={ctx} />
        {registro && (
          <section className="px-6 pb-16 pt-4">
            <h2 className="mb-4 text-center text-lg font-semibold text-[#1D1E20]">Confirma tu asistencia</h2>
            <RegistroForm
              token={token}
              maxCompanions={data.puerta!.maxCompanions}
              botonClassName={ctx.botonClassName}
              onDone={rsvpToken => { window.location.href = window.location.pathname.replace(/[^/]+$/, rsvpToken) }}
            />
          </section>
        )}
      </PreviewBoundary>
    </div>
  )
```

Importar arriba: `import RegistroForm from '@/app/components/invitacion/RegistroForm'`

- [ ] **Step 3: Verificar el flujo completo en el navegador**

Run: `npm run dev`
1. Abrir `/invitacion/<slug>/<shared_token>` → se ve la invitación **con su tema**, sin sección de RSVP, con el formulario abajo.
2. Registrarse con nombre, teléfono y 2 acompañantes.
3. **El navegador debe llegar solo a `/invitacion/<slug>/<rsvp_token>`** y ahí verse la invitación personal con su nombre.
4. Abrir el link personal en otra pestaña → sigue funcionando.

- [ ] **Step 4: Verificar que no se rompió el invitado privado**

Abrir el link personal de un invitado de un evento **privado** existente. Debe verse **igual que antes**: con su nombre, con su RSVP, sin formulario de registro. Ésta es la regresión que más importa: hay 971 invitados con link repartido.

- [ ] **Step 5: Commit**

```bash
git add app/components/invitacion/RegistroForm.tsx "app/invitacion/[slug]/[token]/InvitacionClient.tsx"
git commit -m "feat(puerta): formulario de registro en la invitacion compartida"
```

---

### Task 9: La puerta cerrada dice algo bonito

**Files:**
- Modify: `app/invitacion/[slug]/[token]/InvitacionClient.tsx:59-67`

**Interfaces:**
- Consumes: el 403 `cerrada` de Task 5 y `puerta.agotado` de Task 5.

**Por qué:** hoy cualquier fallo cae en "Invitación no disponible. Revisa el link que te compartieron" — que para un cupo lleno es mentira: el link está bien, lo que se acabó son los lugares. Y si el anfitrión pasa el evento a privada, el que abre el link se come un error crudo. Petición de Diego.

- [ ] **Step 1: Distinguir los tres finales**

Reemplazar el estado `notFound` por uno con causa. En L30:
```ts
  const [estado, setEstado] = useState<'ok' | 'no_existe' | 'cerrada'>('ok')
```

En el `load` (L36-46):
```ts
        const res = await fetch(`/api/invitacion/${token}`)
        if (!res.ok) {
          if (active) { setEstado(res.status === 403 ? 'cerrada' : 'no_existe'); setLoading(false) }
          return
        }
```
y en el `catch`: `setEstado('no_existe')`.

- [ ] **Step 2: Pintar los mensajes**

Reemplazar el bloque `if (notFound || !data)` (L59-67):

```tsx
  if (estado !== 'ok' || !data) {
    const cerrada = estado === 'cerrada'
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
        <Heart size={28} className="mb-3 text-[#d4a853]" />
        <h1 className="text-lg font-semibold text-[#1D1E20]">
          {cerrada ? 'Los registros están cerrados' : 'Invitación no disponible'}
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          {cerrada
            ? 'El anfitrión cerró los registros de este evento. Si crees que es un error, escríbele.'
            : 'Revisa el link que te compartieron.'}
        </p>
      </div>
    )
  }
```

- [ ] **Step 3: El cupo agotado, con el tema del evento**

El agotado **no** es una pantalla aparte: la invitación se ve completa (Task 8 ya la pinta) y en lugar del formulario va el aviso. En el render, sustituir la condición del Step 2 de Task 8:

```tsx
  const agotado = data.mode === 'compartida' && data.puerta?.agotado === true
  const registro = data.mode === 'compartida' && data.puerta && !data.puerta.agotado && !ctx.deadlinePassed
```

y después del `{registro && (...)}`:

```tsx
        {agotado && (
          <section className="px-6 pb-16 pt-4">
            <div className="mx-auto max-w-sm rounded-xl border border-[#e8e8e8] bg-white/70 px-5 py-6 text-center">
              <h2 className="text-base font-semibold text-[#1D1E20]">Ya no quedan lugares</h2>
              <p className="mt-1 text-sm text-[#888]">Este evento llegó a su cupo. Escríbele al anfitrión por si se libera alguno.</p>
            </div>
          </section>
        )}
```

El invitado ve la fiesta bonita y se entera de que se llenó — no un 404. La lista de espera (fase 5) aterriza justo aquí.

- [ ] **Step 4: Verificar los tres finales**

1. Token inventado → "Invitación no disponible".
2. Evento en **privada** con su `shared_token` → "Los registros están cerrados".
3. `guest_cap` puesto por debajo del aforo actual → la invitación completa + "Ya no quedan lugares", **sin formulario**.

- [ ] **Step 5: Commit**

```bash
git add "app/invitacion/[slug]/[token]/InvitacionClient.tsx"
git commit -m "feat(puerta): mensajes de puerta cerrada y cupo agotado"
```

---

### Task 10: El anfitrión ve y copia su link

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx` (pestaña Acceso, la de la fase 1)

**Interfaces:**
- Consumes: `event_settings.shared_token` (Task 4), `access_mode` (fase 1).

**Regla de dónde se enseña:** el link **solo aparece si el modo es `publica`**. Un evento privado con token acuñado no lo muestra — el token existe, la puerta no.

- [ ] **Step 1: Traer el token en el fetch de settings de la página**

Agregar `shared_token` al `select` de `event_settings` que ya hace esa página, y guardarlo en estado.

- [ ] **Step 2: Pintar el bloque en la pestaña Acceso**

Debajo del selector de modo, solo cuando `accessMode === 'publica'`:

```tsx
{accessMode === 'publica' && (
  <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-4">
    <h3 className="text-sm font-semibold text-[#1D1E20]">Link público</h3>
    {sharedToken ? (
      <>
        <p className="mt-1 text-xs text-[#888]">Compártelo y cualquiera podrá registrarse. Si cambias el evento a privada, este link deja de funcionar.</p>
        <div className="mt-2.5 flex items-center gap-2">
          <input
            readOnly
            value={`${origin}/invitacion/${slug}/${sharedToken}`}
            className="min-w-0 flex-1 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#666]"
          />
          <button
            onClick={() => { navigator.clipboard.writeText(`${origin}/invitacion/${slug}/${sharedToken}`); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
          >
            {copiado ? <Check size={13} /> : <Copy size={13} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </>
    ) : (
      <p className="mt-1 text-xs text-[#888]">
        Publica la invitación del evento para generar el link público.
      </p>
    )}
  </div>
)}
```

`origin` sale de `window.location.origin` en un `useEffect` (no en render: no existe en el servidor). `slug` se arma igual que en `RepartoLinks.tsx` — **reusar esa función, no escribir otra**.

- [ ] **Step 3: Verificar**

1. Evento público con invitación publicada → aparece el link, el botón copia.
2. Evento público **sin** publicar → "Publica la invitación del evento para generar el link público".
3. Pasar a **privada** → el bloque desaparece.
4. Pegar el link copiado en una ventana de incógnito → carga la puerta.

- [ ] **Step 4: Verificación final de toda la rama**

```bash
npm test
npx tsc --noEmit
npm run build
```
Expected: 322+ passing (303 previos + los ~19 de `lib/puerta.test.ts` + los de Task 2), tsc limpio, build verde.

Lint **solo de los archivos tocados** — `npm run lint` es `eslint` sin args y barre el repo entero (56k problems preexistentes). Comparar contra `main`, no contra cero.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/configuracion/page.tsx"
git commit -m "feat(puerta): link publico visible y copiable en la pestana acceso"
```

---

## Lo que NO entra (y por qué)

- **Borrador vs publicado.** Hallazgo de esta sesión, verificado: `updateDoc` (`app/events/[id]/invitacion/page.tsx:122-126`) autoguarda el documento completo 800ms después de teclear, y la ruta pública lee **ese mismo documento**. No hay dos versiones. Publicada una invitación, **cada edición está en vivo al instante** en los links ya repartidos, sin aviso. Es real y es de Diego, pero es una feature propia que toca el editor completo. Su propio momento.
- **Precio, apartado, aprobación, lista de espera.** Fases 3, 4 y 5.
- **Nombres de acompañantes.** El toggle de Partiful; fuera de alcance por spec.
- **Regenerar el `shared_token`** para revocar un link que ya circuló. El modelo lo aguanta (es una columna); no se pide todavía.
- **Gatear por PRO.** Trabado por precios.
- **La pestaña Acceso no está gateada por `canAdmin`.** Deuda de la fase 1, sigue abierta.
