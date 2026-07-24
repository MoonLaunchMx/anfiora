# Puerta pública — Fase 1: corregir el modelo y poder editarlo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir `AccessMode` de 3 valores a `privada | publica`, mover la aprobación a un candado (`event_settings.requires_approval`), y permitir que el anfitrión edite el acceso del evento en `/configuracion`.

**Architecture:** El mapeo de los 17 tipos de evento vive como **dato** en `EVENT_TYPES` (patrón ya existente). Las reglas son **funciones puras** en `lib/features.ts` con tests de Vitest. La regla dura (privada nunca lleva cupo, precio ni aprobación) vive en `normalizeAccessFields`, que hace short-circuit **antes** de mirar los inputs, así no depende de ningún condicional de la UI.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-14-flujo-invitados-publicos-privados-design.md`

## Global Constraints

- **Nada visible al invitado en esta fase.** La puerta pública NO se construye aquí. Esta fase solo corrige el modelo y da dónde editarlo. Fin.
- **Worktree propio.** No trabajar en la carpeta principal. Al borrarlo: quitar el junction de `node_modules` a mano ANTES de `git worktree remove`, o vacía el `node_modules` de la carpeta principal.
- **Rama:** `feat/puerta-publica-invitados` (ya creada desde `main`, tiene el spec en `dd7e838`).
- **La migración va ANTES que el código** (Task 1). Va al revés de la "Regla crítica" de `CLAUDE.md`: esa regla aplica a valores nuevos en columnas que ya se leen, no a columnas nuevas. Si el código sale primero, el insert del modal truena.
- **El cliente de Supabase NO está tipado** (`createClient` sin genérico `Database`): `tsc` **no valida nombres de columna** en los inserts. Verificar a mano contra la base.
- **Nunca correr SQL en Supabase sin OK explícito de Diego.** Task 1 la corre él.
- **UI:** español con acentos, cero emojis, íconos Lucide, CTA teal `#48C9B0`, negro `#1D1E20` solo para dropdowns de filtro.
- **Commits:** convencionales (`feat:`, `fix:`, `refactor:`), **sin acentos ni ñ**.
- **Correr `npm test` y `npx tsc --noEmit` antes de cada commit.**

## Estructura de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `docs/superpowers/plans/sql/2026-07-14-requires-approval.sql` | La migración | Ya creado |
| `lib/features.ts` | `AccessMode`, `ACCESS_MODES`, helpers puros, `normalizeAccessFields` | Modificar |
| `lib/features.test.ts` | Tests de los helpers | Modificar |
| `lib/event-types.ts` | El mapeo de los 17 tipos como dato | Modificar |
| `lib/types.ts` | `EventSettings.requires_approval` | Modificar |
| `app/components/NewEventModal.tsx` | Paso 3: 2 tarjetas + toggle | Modificar |
| `app/events/[id]/configuracion/page.tsx` | Sección para editar el acceso | Modificar |

---

### Task 1: La migración (la corre Diego)

**Files:**
- Ya creado: `docs/superpowers/plans/sql/2026-07-14-requires-approval.sql`

**Interfaces:**
- Produces: la columna `event_settings.requires_approval` (boolean, not null, default false) que consumen las Tasks 3 y 4.

- [ ] **Step 1: Pedirle a Diego que corra el SQL**

Pegarle el contenido de `docs/superpowers/plans/sql/2026-07-14-requires-approval.sql` para que lo corra en el SQL Editor de Supabase. **No correrlo tú.** Es aditivo y no toca datos, pero la regla es que él lo corre.

- [ ] **Step 2: Verificar que quedó**

Pedirle que corra:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'event_settings' and column_name = 'requires_approval';
```

Esperado: una fila — `requires_approval | boolean | NO | false`.

**No avanzar a la Task 2 sin esa fila.** Si no está, el insert del modal en la Task 3 truena con un error crudo de Postgres que `tsc` no puede prevenir.

---

### Task 2: El modelo de 2 valores

Un solo task porque cambiar `AccessMode` rompe de inmediato los 17 `EVENT_TYPES`, `ACCESS_MODES` y `resolveAccessMode`. Partirlo dejaría el repo sin compilar entre commits.

**Files:**
- Modify: `lib/features.ts:9` (`AccessMode`), `:19-23` (`ACCESS_MODES`), `:82-92` (helpers), `:114-124` (`normalizeAccessFields`)
- Modify: `lib/event-types.ts:21` (`EventTypeConfig`), `:25-41` (los 17 tipos)
- Modify: `lib/types.ts` (`EventSettings`)
- Test: `lib/features.test.ts`

**Interfaces:**
- Produces:
  - `type AccessMode = 'privada' | 'publica'`
  - `ACCESS_MODES: AccessModeConfig[]` — 2 entradas
  - `getDefaultAccessMode(eventTypeValue: string | null): AccessMode`
  - `getDefaultRequiresApproval(eventTypeValue: string | null): boolean`
  - `resolveAccessMode(eventTypeValue: string | null, stored: string | null | undefined): AccessMode`
  - `resolveRequiresApproval(eventTypeValue: string | null, storedMode: string | null | undefined, storedFlag: boolean | null | undefined): boolean`
  - `normalizeAccessFields(input: { accessMode: AccessMode; guestCap: string; ticketPrice: string; requiresApproval: boolean }): { guest_cap: number | null; ticket_price: number | null; requires_approval: boolean }`
  - `EventTypeConfig.defaultAccessMode: AccessMode` y `EventTypeConfig.defaultRequiresApproval: boolean` (ambos **requeridos**: obligan a los 17 a declararlos)

**El remapeo de los 17 tipos** (verificado contra `lib/features.test.ts` en `main`):

| Antes | Tipos | Ahora |
|---|---|---|
| `privada` | boda, xv, bautizo, graduacion | `privada` + `false` |
| `abierta` | cumpleanos, fiesta, conferencia, congreso, caridad | `publica` + `false` |
| `aprobacion` | despedida, capacitacion, teambuilding, lanzamiento, asamblea, retiro, campamento, otro | `publica` + `true` |

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar los `describe` de `getDefaultAccessMode` y `resolveAccessMode` en `lib/features.test.ts`, y agregar los nuevos. Dejar intactos los tests de features (`getDefaultFeatures` / `resolveFeatures`).

```ts
import { describe, it, expect } from 'vitest'
import {
  getDefaultAccessMode, getDefaultRequiresApproval,
  resolveAccessMode, resolveRequiresApproval,
  normalizeAccessFields, ACCESS_MODES,
} from './features'
import { EVENT_TYPES } from './event-types'

describe('getDefaultAccessMode', () => {
  it('los eventos de lista curada son privados', () => {
    for (const t of ['boda', 'xv', 'bautizo', 'graduacion']) {
      expect(getDefaultAccessMode(t)).toBe('privada')
    }
  })

  it('todo lo demas es publico', () => {
    for (const t of ['cumpleanos', 'fiesta', 'conferencia', 'congreso', 'caridad',
                     'despedida', 'capacitacion', 'teambuilding', 'lanzamiento',
                     'asamblea', 'retiro', 'campamento', 'otro']) {
      expect(getDefaultAccessMode(t)).toBe('publica')
    }
  })

  it('cae en publica si el tipo no existe o es null', () => {
    expect(getDefaultAccessMode('inexistente')).toBe('publica')
    expect(getDefaultAccessMode(null)).toBe('publica')
  })
})

describe('getDefaultRequiresApproval', () => {
  it('los que antes eran aprobacion piden aprobacion', () => {
    for (const t of ['despedida', 'capacitacion', 'teambuilding', 'lanzamiento',
                     'asamblea', 'retiro', 'campamento', 'otro']) {
      expect(getDefaultRequiresApproval(t)).toBe(true)
    }
  })

  it('los que antes eran abierta no piden aprobacion', () => {
    for (const t of ['cumpleanos', 'fiesta', 'conferencia', 'congreso', 'caridad']) {
      expect(getDefaultRequiresApproval(t)).toBe(false)
    }
  })

  it('los privados nunca piden aprobacion', () => {
    for (const t of ['boda', 'xv', 'bautizo', 'graduacion']) {
      expect(getDefaultRequiresApproval(t)).toBe(false)
    }
  })
})

describe('los 17 tipos declaran su acceso', () => {
  it('cada tipo tiene un modo valido', () => {
    for (const t of EVENT_TYPES) {
      expect(['privada', 'publica']).toContain(t.defaultAccessMode)
      expect(typeof t.defaultRequiresApproval).toBe('boolean')
    }
  })

  it('ningun tipo privado pide aprobacion', () => {
    for (const t of EVENT_TYPES.filter(t => t.defaultAccessMode === 'privada')) {
      expect(t.defaultRequiresApproval).toBe(false)
    }
  })
})

describe('ACCESS_MODES', () => {
  it('son exactamente dos: privada y publica', () => {
    expect(ACCESS_MODES.map(m => m.key)).toEqual(['privada', 'publica'])
  })
})

describe('resolveAccessMode', () => {
  it('lo guardado gana sobre el default del tipo', () => {
    expect(resolveAccessMode('boda', 'publica')).toBe('publica')
    expect(resolveAccessMode('conferencia', 'privada')).toBe('privada')
  })

  it('lectura tolerante: los valores viejos de 3 se leen como publica', () => {
    expect(resolveAccessMode('boda', 'abierta')).toBe('publica')
    expect(resolveAccessMode('boda', 'aprobacion')).toBe('publica')
  })

  it('sin nada guardado cae al default del tipo', () => {
    expect(resolveAccessMode('boda', null)).toBe('privada')
    expect(resolveAccessMode('conferencia', undefined)).toBe('publica')
  })

  it('basura cae al default del tipo', () => {
    expect(resolveAccessMode('boda', 'lo-que-sea')).toBe('privada')
    expect(resolveAccessMode('boda', '')).toBe('privada')
  })
})

describe('resolveRequiresApproval', () => {
  it('un evento privado nunca pide aprobacion, aunque la bandera diga que si', () => {
    expect(resolveRequiresApproval('otro', 'privada', true)).toBe(false)
  })

  it('la bandera guardada gana en un evento publico', () => {
    expect(resolveRequiresApproval('conferencia', 'publica', true)).toBe(true)
    expect(resolveRequiresApproval('otro', 'publica', false)).toBe(false)
  })

  it('lectura tolerante: el viejo aprobacion implica que si', () => {
    expect(resolveRequiresApproval('conferencia', 'aprobacion', null)).toBe(true)
  })

  it('lectura tolerante: el viejo abierta implica que no', () => {
    expect(resolveRequiresApproval('otro', 'abierta', null)).toBe(false)
  })

  it('sin bandera cae al default del tipo', () => {
    expect(resolveRequiresApproval('otro', null, null)).toBe(true)
    expect(resolveRequiresApproval('conferencia', null, undefined)).toBe(false)
  })
})

describe('normalizeAccessFields', () => {
  it('privada borra cupo, precio y aprobacion aunque vengan llenos', () => {
    expect(normalizeAccessFields({
      accessMode: 'privada', guestCap: '100', ticketPrice: '500', requiresApproval: true,
    })).toEqual({ guest_cap: null, ticket_price: null, requires_approval: false })
  })

  it('publica respeta lo que se tecleo', () => {
    expect(normalizeAccessFields({
      accessMode: 'publica', guestCap: '100', ticketPrice: '500', requiresApproval: true,
    })).toEqual({ guest_cap: 100, ticket_price: 500, requires_approval: true })
  })

  it('publica sin cupo ni precio los deja nulos y respeta la aprobacion', () => {
    expect(normalizeAccessFields({
      accessMode: 'publica', guestCap: '', ticketPrice: '', requiresApproval: false,
    })).toEqual({ guest_cap: null, ticket_price: null, requires_approval: false })
  })

  it('un cupo invalido o pasado de la cota se vuelve nulo', () => {
    for (const cap of ['0', '-5', 'abc', '1.5', '1000001']) {
      expect(normalizeAccessFields({
        accessMode: 'publica', guestCap: cap, ticketPrice: '', requiresApproval: false,
      }).guest_cap).toBeNull()
    }
  })

  it('un precio de cero es valido (evento publico gratis con registro)', () => {
    expect(normalizeAccessFields({
      accessMode: 'publica', guestCap: '', ticketPrice: '0', requiresApproval: false,
    }).ticket_price).toBe(0)
  })
})
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npm test -- features`
Expected: FAIL. `getDefaultRequiresApproval` y `resolveRequiresApproval` no existen; `defaultRequiresApproval` no existe en `EventTypeConfig`; `normalizeAccessFields` no acepta `requiresApproval`.

- [ ] **Step 3: Actualizar `lib/event-types.ts`**

En la interfaz (línea 21), reemplazar `defaultAccessMode: AccessMode` por:

```ts
  defaultAccessMode: AccessMode
  defaultRequiresApproval: boolean
```

Y en los 17 tipos, cambiar cada `defaultAccessMode` según la tabla de arriba y agregarle `defaultRequiresApproval`. Los 4 privados quedan así:

```ts
defaultAccessMode: 'privada', defaultRequiresApproval: false
```

Los 5 que decían `'abierta'` (cumpleanos, fiesta, conferencia, congreso, caridad):

```ts
defaultAccessMode: 'publica', defaultRequiresApproval: false
```

Los 8 que decían `'aprobacion'` (despedida, capacitacion, teambuilding, lanzamiento, asamblea, retiro, campamento, otro):

```ts
defaultAccessMode: 'publica', defaultRequiresApproval: true
```

- [ ] **Step 4: Actualizar `lib/features.ts`**

Reemplazar la línea 9 y el bloque `ACCESS_MODES` (19-23):

```ts
export type AccessMode = 'privada' | 'publica'

export interface AccessModeConfig {
  key: AccessMode
  label: string
  description: string
  icon: React.ElementType
}

export const ACCESS_MODES: AccessModeConfig[] = [
  { key: 'privada', label: 'Invitación directa', description: 'Tú armas la lista. Cada invitado recibe su propio link.', icon: Lock },
  { key: 'publica', label: 'Link público',       description: 'Compartes un link y la gente se registra sola.',        icon: Globe },
]
```

En el import de `lucide-react` de la línea 2, quitar `UserCheck` si ya no lo usa nadie más en el archivo (lo usaba la tarjeta de `aprobacion`). **Ojo:** el toggle de la Task 4 sí lo va a usar, pero lo importa desde `NewEventModal.tsx`, no desde aquí.

Reemplazar los helpers (82-92):

```ts
export function getDefaultAccessMode(eventTypeValue: string | null): AccessMode {
  return EVENT_TYPES.find(t => t.value === eventTypeValue)?.defaultAccessMode ?? 'publica'
}

export function getDefaultRequiresApproval(eventTypeValue: string | null): boolean {
  return EVENT_TYPES.find(t => t.value === eventTypeValue)?.defaultRequiresApproval ?? true
}

// Lectura tolerante: 'abierta' y 'aprobacion' son el modelo viejo de 3 valores.
// La base tenia 0 filas con valor al migrar (verificado 14-jul), pero leerlos
// cuesta una linea y evita que un dato viejo se lea como basura.
export function resolveAccessMode(
  eventTypeValue: string | null,
  stored: string | null | undefined,
): AccessMode {
  if (stored === 'privada' || stored === 'publica') return stored
  if (stored === 'abierta' || stored === 'aprobacion') return 'publica'
  return getDefaultAccessMode(eventTypeValue)
}

export function resolveRequiresApproval(
  eventTypeValue: string | null,
  storedMode: string | null | undefined,
  storedFlag: boolean | null | undefined,
): boolean {
  if (resolveAccessMode(eventTypeValue, storedMode) === 'privada') return false
  if (storedMode === 'aprobacion') return true
  if (storedMode === 'abierta') return false
  if (typeof storedFlag === 'boolean') return storedFlag
  return getDefaultRequiresApproval(eventTypeValue)
}
```

Reemplazar `normalizeAccessFields` (114-124):

```ts
export function normalizeAccessFields(input: {
  accessMode: AccessMode
  guestCap: string
  ticketPrice: string
  requiresApproval: boolean
}): { guest_cap: number | null; ticket_price: number | null; requires_approval: boolean } {
  if (input.accessMode === 'privada') {
    return { guest_cap: null, ticket_price: null, requires_approval: false }
  }
  return {
    guest_cap: parseCap(input.guestCap),
    ticket_price: parsePrice(input.ticketPrice),
    requires_approval: input.requiresApproval,
  }
}
```

- [ ] **Step 5: Actualizar `lib/types.ts`**

En el tipo `EventSettings`, junto a `access_mode`:

```ts
  access_mode?: import('./features').AccessMode | null
  requires_approval?: boolean | null
```

- [ ] **Step 6: Correr los tests y ver que pasan**

Run: `npm test -- features`
Expected: PASS, todos.

Run: `npx tsc --noEmit`
Expected: limpio. Si truena en `NewEventModal.tsx` por `ACCESS_MODES` o por `normalizeAccessFields`, es esperado — se arregla en la Task 3. Anotar el error y seguir; **no** commitear con `tsc` roto: hacer la Task 3 antes de commitear si el error aparece.

- [ ] **Step 7: Correr toda la suite, no solo features**

Run: `npm test`
Expected: PASS, cero fallos. En `main` había 299 tests; el total cambia porque los `describe` de acceso se reescribieron.

Si falla algo fuera de `features.test.ts`, es que alguien más consumía los valores viejos. Encontrarlo con:

```bash
git grep -n "'aprobacion'\|'abierta'" -- 'lib/*.ts' 'app/**/*.tsx' | grep -v test
```

- [ ] **Step 8: Commit**

```bash
git add lib/features.ts lib/features.test.ts lib/event-types.ts lib/types.ts
git commit -m "refactor(acceso): AccessMode a privada|publica y aprobacion como candado

La aprobacion no es un modo hermano de abierta: es la misma mecanica con
un candado. Los 17 tipos recolapsan a privada|publica + defaultRequiresApproval.
resolveAccessMode lee tolerante los valores viejos de 3."
```

---

### Task 3: El modal — 2 tarjetas y un toggle

**Files:**
- Modify: `app/components/NewEventModal.tsx:10` (import), `:86` (default al elegir tipo), `:120` (normalize), `:151-158` (insert de settings), `:356-400` (paso 3)

**Interfaces:**
- Consumes: `ACCESS_MODES`, `getDefaultAccessMode`, `getDefaultRequiresApproval`, `normalizeAccessFields` de la Task 2.
- Produces: el evento se crea con `event_settings.requires_approval` escrito.

- [ ] **Step 1: Actualizar el import (línea 10)**

```ts
import { FEATURES, ALWAYS_ON_FEATURES, ACCESS_MODES, getDefaultFeatures, getDefaultAccessMode, getDefaultRequiresApproval, normalizeAccessFields, type FeatureKey, type AccessMode } from '@/lib/features'
```

Y agregar `UserCheck` al import de `lucide-react` del archivo.

- [ ] **Step 2: Agregar el estado del candado**

Junto al `useState` de `accessMode`:

```ts
const [requiresApproval, setRequiresApproval] = useState(false)
```

En `resetForm`, agregar `setRequiresApproval(false)`.

- [ ] **Step 3: Que el tipo de evento fije el default (línea 86)**

Donde hoy dice `setAccessMode(getDefaultAccessMode(type.value))`, agregar debajo:

```ts
    setRequiresApproval(getDefaultRequiresApproval(type.value))
```

- [ ] **Step 4: Pasar el candado al normalize (línea 120)**

```ts
    const access = normalizeAccessFields({ accessMode, guestCap, ticketPrice, requiresApproval })
```

- [ ] **Step 5: Escribirlo al crear (líneas 151-158)**

En el insert de `event_settings`, agregar la columna:

```ts
        access_mode:       accessMode,
        requires_approval: access.requires_approval,
```

**Usar `access.requires_approval`, NO `requiresApproval`.** El del estado puede venir en `true` si el usuario prendió el toggle y luego se cambió a privada; el normalizado ya lo forzó a `false`. Es la regla dura y por eso vive en la función pura.

- [ ] **Step 6: El paso 3 — 2 tarjetas y el toggle**

Reemplazar el bloque de `renderStep3` (356-400). Las tarjetas quedan igual (el `.map` de `ACCESS_MODES` ahora produce 2), y se agrega el toggle **debajo, solo cuando es pública**:

```tsx
        {accessMode === 'publica' && (
          <button
            type="button"
            onClick={() => setRequiresApproval(v => !v)}
            className="flex items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white p-3 text-left transition hover:border-[#d0d0d0]"
          >
            <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (requiresApproval ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
              <UserCheck size={18} className={requiresApproval ? 'text-[#0F6E56]' : 'text-[#888]'} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#1D1E20]">Aprobar cada solicitud</p>
              <p className="mt-0.5 text-xs text-[#888]">
                {requiresApproval
                  ? 'Nadie entra a la lista hasta que tú lo apruebes.'
                  : 'Quien abra el link se registra y ya está en la lista.'}
              </p>
            </div>
            <div className={
              'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ' +
              (requiresApproval ? 'justify-end bg-[#48C9B0]' : 'justify-start bg-[#ddd]')
            }>
              <div className="h-4 w-4 rounded-full bg-white" />
            </div>
          </button>
        )}
```

Este bloque va **entre** el `.map` de tarjetas y el bloque de `accessMode === 'privada' ? ... : (` que ya existe para cupo y precio.

- [ ] **Step 7: Verificar los tipos**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 8: Verificar a mano en local**

Run: `npm run dev`

Comprobar en `http://localhost:3000/dashboard`, creando un evento:
1. Tipo **Boda** → paso 3 muestra **"Invitación directa"** seleccionada, **sin toggle**, y el aviso de "sin cupo ni cobro".
2. Tipo **Conferencia** → **"Link público"** seleccionada, toggle **apagado**, y aparecen cupo y precio.
3. Tipo **Otro** → **"Link público"**, toggle **prendido**.
4. Elegir Conferencia, prender el toggle, teclear cupo 50, cambiar a "Invitación directa", y crear.
   **Verificar en Supabase:** `events.guest_cap` y `ticket_price` en `null`, y `event_settings.requires_approval` en `false`. Ésa es la regla dura funcionando.

```sql
select e.name, e.guest_cap, e.ticket_price, s.access_mode, s.requires_approval
from events e join event_settings s on s.event_id = e.id
order by e.created_at desc limit 4;
```

- [ ] **Step 9: Commit**

```bash
git add app/components/NewEventModal.tsx
git commit -m "feat(acceso): paso 3 del modal con 2 tarjetas y toggle de aprobacion"
```

---

### Task 4: Editar el acceso en configuración

Es el bloqueante real: hoy el acceso solo se escribe al crear y **no hay dónde cambiarlo**. Invisible mientras nada lea la columna; trampa el día que la puerta la lea.

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx` — `TABS` (98-102), `loadEvent` (311-335), `handleSave` (380-401), y el render de la pestaña nueva

**Interfaces:**
- Consumes: `ACCESS_MODES`, `resolveAccessMode`, `resolveRequiresApproval`, `normalizeAccessFields` de la Task 2.
- Produces: `event_settings.access_mode` y `requires_approval` editables; `events.guest_cap` y `ticket_price` editables.

Va en **pestaña propia** (`Acceso`), no dentro de `Evento`: la pestaña Evento ya trae nombre, tipo, fechas, sede, anfitriones y organización, y el archivo va en 1,060 líneas.

- [ ] **Step 1: Agregar la pestaña (líneas 98-102)**

```ts
const TABS: TabItem[] = [
  { key: 'evento',   label: 'Evento',   icon: Settings2 },
  { key: 'acceso',   label: 'Acceso',   icon: Lock },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'equipo',   label: 'Equipo',   icon: Users },
]
```

Agregar **solo `Lock` y `UserCheck`** al import de `lucide-react` (`Lock` para el ícono de la pestaña, `UserCheck` para el toggle). **`Globe` no se importa aquí:** el ícono de cada tarjeta viene de `m.icon` a través de `ACCESS_MODES`, y un import sin usar truena el lint.

Importar los helpers:

```ts
import { ACCESS_MODES, resolveAccessMode, resolveRequiresApproval, normalizeAccessFields, type AccessMode } from '@/lib/features'
```

**Nota sobre el autosave:** los cambios se marcan con `scheduleAutoSave()` (línea 416), que es el patrón de todos los inputs de la pestaña Evento — **no** tocar `hasChangesRef` a mano, o el campo no se guarda solo. El stale closure que mordió con `host_name_2` ya está resuelto: `handleSaveRef.current = handleSave` se reasigna en cada render (línea 414), así que el estado nuevo se captura bien sin trabajo extra.

- [ ] **Step 2: Agregar el estado**

Junto a los demás `useState`:

```ts
  const [accessMode, setAccessMode] = useState<AccessMode>('privada')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [guestCap, setGuestCap] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
```

- [ ] **Step 3: Cargarlo (dentro de `loadEvent`)**

En el bloque `if (eventData)`, agregar:

```ts
      setGuestCap(eventData.guest_cap != null ? String(eventData.guest_cap) : '')
      setTicketPrice(eventData.ticket_price != null ? String(eventData.ticket_price) : '')
```

Y donde se procesa `settingsData`, agregar (usa `eventData.event_type` porque el default sale del tipo):

```ts
      const tipo = eventData?.event_type || null
      setAccessMode(resolveAccessMode(tipo, settingsData?.access_mode))
      setRequiresApproval(resolveRequiresApproval(tipo, settingsData?.access_mode, settingsData?.requires_approval))
```

**Ojo con el orden:** esas líneas necesitan `eventData`, así que van **después** del bloque que lo lee, no antes.

- [ ] **Step 4: Guardarlo (dentro de `handleSave`)**

Antes del update de `events` (línea 380):

```ts
    const access = normalizeAccessFields({ accessMode, guestCap, ticketPrice, requiresApproval })
```

Agregar al update de `events`:

```ts
      guest_cap:    access.guest_cap,
      ticket_price: access.ticket_price,
```

Y al upsert de `event_settings` (395-401):

```ts
      access_mode:       accessMode,
      requires_approval: access.requires_approval,
```

- [ ] **Step 5: Renderizar la pestaña**

Agregar después del bloque de `{activeTab === 'evento' && (...)}`. Reusa el mismo patrón visual del paso 3 del modal, para que el anfitrión vea lo mismo que vio al crear:

```tsx
          {activeTab === 'acceso' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {ACCESS_MODES.map(m => {
                  const Icon = m.icon
                  const on = accessMode === m.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => { setAccessMode(m.key); scheduleAutoSave() }}
                      className={
                        'flex items-center gap-3 rounded-xl border p-3 text-left transition ' +
                        (on ? 'border-[#c8ede7] bg-[#f0fdfb]' : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]')
                      }
                    >
                      <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (on ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                        <Icon size={18} className={on ? 'text-[#0F6E56]' : 'text-[#888]'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1D1E20]">{m.label}</p>
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
                  <button
                    type="button"
                    onClick={() => { setRequiresApproval(v => !v); scheduleAutoSave() }}
                    className="flex items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white p-3 text-left transition hover:border-[#d0d0d0]"
                  >
                    <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (requiresApproval ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                      <UserCheck size={18} className={requiresApproval ? 'text-[#0F6E56]' : 'text-[#888]'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1D1E20]">Aprobar cada solicitud</p>
                      <p className="mt-0.5 text-xs text-[#888]">
                        {requiresApproval
                          ? 'Nadie entra a la lista hasta que tú lo apruebes.'
                          : 'Quien abra el link se registra y ya está en la lista.'}
                      </p>
                    </div>
                    <div className={
                      'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ' +
                      (requiresApproval ? 'justify-end bg-[#48C9B0]' : 'justify-start bg-[#ddd]')
                    }>
                      <div className="h-4 w-4 rounded-full bg-white" />
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#666]">Cupo máximo</label>
                      <input
                        type="number"
                        value={guestCap}
                        onChange={e => { setGuestCap(e.target.value); scheduleAutoSave() }}
                        placeholder="Sin límite"
                        className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#666]">Precio por persona</label>
                      <input
                        type="number"
                        value={ticketPrice}
                        onChange={e => { setTicketPrice(e.target.value); scheduleAutoSave() }}
                        placeholder="Gratis"
                        className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-[#f0e2c0] bg-[#fffbf0] px-3 py-2.5 text-xs text-[#8a6d1f]">
                El link público para que la gente se registre llega en la siguiente entrega. Por ahora esto define cómo entra la gente a tu evento.
              </div>
            </div>
          )}
```

El último aviso es **honestidad de producto**: en esta fase el modo se puede elegir pero la puerta todavía no existe. Se quita en la fase 2.

- [ ] **Step 6: Verificar los tipos**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 7: Verificar a mano en local**

Run: `npm run dev`

En `/events/<id>/configuracion`, pestaña **Acceso**:
1. Un evento viejo (de los 46 con `access_mode` en null) muestra el default de su tipo: una boda abre en "Invitación directa".
2. Cambiar a "Link público", prender aprobación, poner cupo 50 y precio 500, Guardar, **recargar**: todo sigue ahí.
3. Cambiar a "Invitación directa", Guardar, **recargar**: cupo y precio desaparecen y en la base están en `null`.
4. Comprobar con:

```sql
select e.name, e.guest_cap, e.ticket_price, s.access_mode, s.requires_approval
from events e join event_settings s on s.event_id = e.id
where e.id = '<id-del-evento-de-prueba>';
```

- [ ] **Step 8: Commit**

```bash
git add app/events/\[id\]/configuracion/page.tsx
git commit -m "feat(acceso): pestana Acceso en configuracion para editar la puerta"
```

---

### Task 5: Cerrar la fase

- [ ] **Step 1: Verificación completa**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Todo debe pasar. **Ojo:** el build mata el dev server; levantarlo de nuevo si se sigue trabajando.

- [ ] **Step 2: Actualizar el changelog**

En `lib/changelog.ts`, subir `CURRENT_VERSION` y agregar el release. Copy sugerido: *"Ahora decides cómo entra la gente a tu evento: por invitación directa o con un link público, con la opción de aprobar cada solicitud."*

```bash
git add lib/changelog.ts
git commit -m "chore(changelog): release del modo de acceso editable"
```

- [ ] **Step 3: Reportarle a Diego y esperar OK**

Decirle qué se hizo, qué se verificó y **pedirle permiso** para el push y el PR. **No pushear sin OK explícito.**

---

## Fuera de esta fase

- La página pública, el `shared_token`, el registro, el dedupe → **fase 2**
- `access_status`, filtros y bulk de aprobación → **fase 3**
- `amount_due`, `paid_at`, `hold_expires_at`, `payment_info` → **fase 4**
- Lista de espera → **fase 5**
- La deuda de la base (`forms` sin RLS, columnas muertas en `guests`, deriva de tipos) → **su propio momento**, ver la sección final del spec
