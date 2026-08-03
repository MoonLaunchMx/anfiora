# Dashboard v2 — banner único y tablero acomodable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la anatomía del contexto evento del dashboard por un banner de cuatro cifras que el planner elige y, debajo, un tablero de cajas que acomoda y guarda.

**Architecture:** `ContextoEvento.tsx` deja de dibujar la pantalla y pasa a componer tres piezas: la barra de "Personalizar", `BannerEvento` (fijo en su lugar, con cifras elegibles) y `Tablero` (acomodable). El estado del acomodo —cifras, cajas y ocultas— lo carga y persiste un solo dueño, el hook `useTablero`, y baja por props. La lógica pura —qué existe, dónde cae la primera vez, cómo se mezcla lo guardado con lo nuevo— vive probada en `lib/dashboard/tablero.ts`. `lib/dashboard/` (types, metrics, salud, urgencias, load) no se toca.

**Tech Stack:** Next.js 16 App Router, React 19.2.3, TypeScript, Tailwind v4, Supabase, Vitest, Lucide, `react-grid-layout` 2.2.4.

**Spec:** `docs/superpowers/specs/2026-08-02-dashboard-v2-banner-y-tablero-design.md` (addendum, con la enmienda del 3-ago sobre cifras elegibles) sobre `docs/superpowers/specs/2026-08-01-dashboard-v2-design.md`.

## Global Constraints

- Cuadrícula de **4 columnas**. `x`, `y`, `w`, `h` van siempre en casillas, nunca en pixeles.
- El banner muestra **exactamente cuatro cifras**, ni tres ni cinco. Las de fábrica son `invitados`, `presupuesto`, `proveedores`, `tareas`.
- El JSON guardado lleva `"v": 1`. Forma exacta: `{ v, cifras: [id x4], cajas: [{id,x,y,w,h}], ocultas: [id] }`. `cifras` ausente o mal formado significa "las de fábrica" — los tableros guardados antes de la enmienda abren sin migrar nada.
- `dashboard_layout` es **nullable y sin default**: `NULL` significa "nunca lo personalizaron" y la app deriva todo al vuelo.
- Las herramientas del evento se resuelven **siempre** con `resolveFeatures(event_type, enabled_features)` de `lib/features.ts`. Llave ausente **no** significa apagada — nunca leer el JSON crudo.
- El botón "Personalizar" solo se muestra al **dueño** del evento (`m.event.is_shared === false`) y solo en **escritorio** (`lg:`). Las políticas de `INSERT`/`UPDATE` de `event_settings` son `is_event_owner(event_id)`; un colaborador guardaría cero filas sin recibir error.
- Todo `update`/`upsert` que dependa de RLS se verifica **contando filas con `.select()`**, no revisando `error`. Un `UPDATE` filtrado por RLS devuelve cero filas sin excepción.
- UI en **español con acentos**. Sin emojis. Solo Tailwind. Iconos de Lucide.
- Teal `#48C9B0` para botones de acción. El negro `#1D1E20` solo para dropdowns de filtro — no se usa en este plan.
- Tests con Vitest **solo en lógica pura**. La UI se verifica a mano (local → preview → main).
- Commits convencionales, sin acentos ni eñes.
- Nunca `git push` a `main` ni cambios en Supabase sin OK explícito de Diego.

---

### Task 1: Cimiento — dependencia y columna

Desbloquea todo lo demás: sin la columna, la Task 3 lee un campo inexistente; sin la librería, la Task 7 no compila. **Incluye un checkpoint humano.**

**Files:**
- Modify: `package.json`
- Create: `docs/superpowers/plans/sql/2026-08-03-dashboard-layout.sql`

**Interfaces:**
- Consumes: nada.
- Produce: la dependencia `react-grid-layout` y la columna `public.event_settings.dashboard_layout jsonb`.

- [ ] **Step 1: Instalar la librería**

`react-grid-layout` 2.2.4 trae sus propios tipos (`dist/index.d.ts`), así que **no** se instala `@types/react-grid-layout` — hacerlo provocaría definiciones duplicadas.

```bash
npm install react-grid-layout@2.2.4
```

- [ ] **Step 2: Verificar que quedó instalada y con tipos**

Run: `npm ls react-grid-layout`
Expected: imprime `react-grid-layout@2.2.4`, sin `UNMET DEPENDENCY`.

Run: `node -e "console.log(require.resolve('react-grid-layout/dist/index.d.ts'))"`
Expected: imprime una ruta dentro de `node_modules`, sin lanzar `MODULE_NOT_FOUND`.

- [ ] **Step 3: Versionar el SQL**

Crear `docs/superpowers/plans/sql/2026-08-03-dashboard-layout.sql`:

```sql
-- Dashboard v2: cifras del banner y acomodo del tablero, por evento.
-- Nullable y sin default a proposito: NULL = nunca lo personalizaron y la app
-- deriva todo al vuelo. Asi no hay que migrar las filas ya existentes.
alter table public.event_settings
  add column if not exists dashboard_layout jsonb;

-- Comprobacion (debe devolver 1):
select count(*)
from information_schema.columns
where table_schema = 'public'
  and table_name = 'event_settings'
  and column_name = 'dashboard_layout';
```

- [ ] **Step 4: CHECKPOINT HUMANO — Diego corre el ALTER**

Pedirle a Diego que ejecute el `alter table` en Supabase y confirme que la comprobación devuelve `1`.

**El orden importa y va al revés de lo que dice `CLAUDE.md`:** cuando el código nuevo **lee o escribe** una columna nueva, la migración va **primero**. Anfiora tiene una sola base, así que `localhost:3000` pega a producción — la columna tiene que existir antes incluso de la verificación local. Es aditiva y nullable: ningún código de hoy la toca, así que correrla antes es inerte para producción.

No avanzar a la Task 3 hasta tener esa confirmación. Las Tasks 2, 5 y 6 sí pueden avanzar sin ella.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json docs/superpowers/plans/sql/2026-08-03-dashboard-layout.sql
git commit -m "chore(dashboard): agrega react-grid-layout y versiona el sql del acomodo"
```

---

### Task 2: Catálogo de cifras y cajas (lógica pura)

**Files:**
- Create: `lib/dashboard/tablero.ts`
- Test: `lib/dashboard/tablero.test.ts`

**Interfaces:**
- Consumes: `EnabledFeatures`, `FeatureKey`, `resolveFeatures` de `@/lib/features`.
- Produce:
  - `type CifraId = 'invitados' | 'presupuesto' | 'proveedores' | 'tareas' | 'regalos' | 'mesas' | 'atencion' | 'organizacion'`
  - `type CajaId = 'atencion' | 'pendientes' | 'mesas' | 'regalos' | 'actividad' | 'equipo'`
  - `type Caja = { id: CajaId; x: number; y: number; w: number; h: number }`
  - `type Acomodo = { v: 1; cifras: CifraId[]; cajas: Caja[]; ocultas: CajaId[] }`
  - `const COLUMNAS = 4`, `const CIFRAS_EN_BANNER = 4`
  - `const CIFRAS: { id: CifraId; titulo: string; feature: FeatureKey | null; requiereDinero: boolean }[]`
  - `const CIFRAS_BASE: CifraId[]`
  - `const CATALOGO: { id: CajaId; titulo: string; feature: FeatureKey | null; w: number; h: number }[]`
  - `cifrasDisponibles(eventType, enabled, puedeVerDinero): CifraId[]`
  - `mezclarCifras(guardadas: CifraId[] | null, disponibles: CifraId[]): CifraId[]`
  - `cambiarCifra(a: Acomodo, indice: number, nueva: CifraId): Acomodo`
  - `cajasDisponibles(eventType, enabled): CajaId[]`
  - `acomodoInicial(cifras: CifraId[], disponibles: CajaId[]): Acomodo`
  - `parseAcomodo(raw: unknown): Acomodo | null`
  - `mezclarAcomodo(guardado, cifrasDisp, cajasDisp): Acomodo`
  - `quitarCaja(a, id): Acomodo`, `agregarCaja(a, id): Acomodo`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `lib/dashboard/tablero.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  CATALOGO, CIFRAS_BASE, CIFRAS_EN_BANNER, COLUMNAS,
  acomodoInicial, agregarCaja, cajasDisponibles, cambiarCifra, cifrasDisponibles,
  mezclarAcomodo, mezclarCifras, parseAcomodo, quitarCaja,
  type Acomodo, type CajaId, type CifraId,
} from './tablero'

describe('cifrasDisponibles', () => {
  it('el dueno de una boda puede elegir las ocho', () => {
    expect(cifrasDisponibles('boda', null, true)).toHaveLength(8)
  })

  it('sin acceso a montos desaparecen presupuesto, proveedores y regalos', () => {
    const ids = cifrasDisponibles('boda', null, false)
    expect(ids).not.toContain('presupuesto')
    expect(ids).not.toContain('proveedores')
    expect(ids).not.toContain('regalos')
    expect(ids).toContain('invitados')
    expect(ids).toContain('tareas')
  })

  it('una herramienta apagada saca su cifra', () => {
    expect(cifrasDisponibles('boda', { mesas: false }, true)).not.toContain('mesas')
  })

  it('una llave ausente no significa apagada: cae al default del tipo', () => {
    expect(cifrasDisponibles('boda', { playlist: true }, true)).toContain('mesas')
  })
})

describe('mezclarCifras', () => {
  it('sin nada guardado devuelve las de fabrica disponibles', () => {
    expect(mezclarCifras(null, cifrasDisponibles('boda', null, true))).toEqual(CIFRAS_BASE)
  })

  it('conserva la eleccion guardada y su orden', () => {
    const elegidas: CifraId[] = ['mesas', 'tareas', 'invitados', 'organizacion']
    expect(mezclarCifras(elegidas, cifrasDisponibles('boda', null, true))).toEqual(elegidas)
  })

  it('siempre devuelve exactamente cuatro', () => {
    expect(mezclarCifras(['invitados'], cifrasDisponibles('boda', null, true))).toHaveLength(CIFRAS_EN_BANNER)
    const seis: CifraId[] = ['invitados', 'tareas', 'mesas', 'regalos', 'atencion', 'organizacion']
    expect(mezclarCifras(seis, cifrasDisponibles('boda', null, true))).toHaveLength(CIFRAS_EN_BANNER)
  })

  it('una cifra que dejo de aplicar cae a la siguiente de fabrica y no deja hueco', () => {
    const elegidas: CifraId[] = ['presupuesto', 'proveedores', 'invitados', 'tareas']
    const r = mezclarCifras(elegidas, cifrasDisponibles('boda', null, false))
    expect(r).toHaveLength(CIFRAS_EN_BANNER)
    expect(r).not.toContain('presupuesto')
    expect(r).not.toContain('proveedores')
    expect(new Set(r).size).toBe(CIFRAS_EN_BANNER)
  })
})

describe('cambiarCifra', () => {
  const base: Acomodo = { v: 1, cifras: [...CIFRAS_BASE], cajas: [], ocultas: [] }

  it('reemplaza la cifra de esa posicion', () => {
    expect(cambiarCifra(base, 1, 'mesas').cifras).toEqual(['invitados', 'mesas', 'proveedores', 'tareas'])
  })

  it('si la nueva ya estaba en otra posicion, las intercambia en vez de duplicar', () => {
    const r = cambiarCifra(base, 0, 'tareas')
    expect(r.cifras).toEqual(['tareas', 'presupuesto', 'proveedores', 'invitados'])
    expect(new Set(r.cifras).size).toBe(CIFRAS_EN_BANNER)
  })

  it('un indice fuera de rango no cambia nada', () => {
    expect(cambiarCifra(base, 9, 'mesas')).toBe(base)
  })
})

describe('cajasDisponibles', () => {
  it('las cajas sin herramienta siempre estan', () => {
    const ids = cajasDisponibles('boda', {})
    expect(ids).toEqual(expect.arrayContaining(['atencion', 'pendientes', 'actividad', 'equipo']))
  })

  it('una herramienta apagada explicitamente saca su caja', () => {
    const ids = cajasDisponibles('boda', { regalos: false })
    expect(ids).not.toContain('regalos')
    expect(ids).toContain('mesas')
  })

  it('enabled_features null cae a legacy: mesas y regalos encendidas', () => {
    const ids = cajasDisponibles('boda', null)
    expect(ids).toContain('mesas')
    expect(ids).toContain('regalos')
  })

  it('respeta el orden del catalogo', () => {
    const ids = cajasDisponibles('boda', null)
    expect(ids).toEqual(CATALOGO.map(c => c.id).filter(id => ids.includes(id)))
  })
})

describe('acomodoInicial', () => {
  it('coloca cada caja dentro de la cuadricula', () => {
    const a = acomodoInicial(CIFRAS_BASE, cajasDisponibles('boda', null))
    for (const c of a.cajas) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x + c.w).toBeLessThanOrEqual(COLUMNAS)
    }
  })

  it('no encima dos cajas en la misma casilla', () => {
    const a = acomodoInicial(CIFRAS_BASE, cajasDisponibles('boda', null))
    const ocupadas = new Set<string>()
    for (const c of a.cajas) {
      for (let x = c.x; x < c.x + c.w; x++) {
        for (let y = c.y; y < c.y + c.h; y++) {
          const llave = `${x},${y}`
          expect(ocupadas.has(llave)).toBe(false)
          ocupadas.add(llave)
        }
      }
    }
  })

  it('nace en version 1, sin ocultas y con las cifras que le dieron', () => {
    const a = acomodoInicial(CIFRAS_BASE, ['atencion'])
    expect(a.v).toBe(1)
    expect(a.ocultas).toEqual([])
    expect(a.cifras).toEqual(CIFRAS_BASE)
  })
})

describe('parseAcomodo', () => {
  it('acepta un acomodo bien formado', () => {
    const raw = {
      v: 1,
      cifras: ['invitados', 'mesas', 'tareas', 'atencion'],
      cajas: [{ id: 'atencion', x: 0, y: 0, w: 2, h: 2 }],
      ocultas: ['regalos'],
    }
    expect(parseAcomodo(raw)).toEqual(raw)
  })

  it('devuelve null con null, con basura y con otra version', () => {
    expect(parseAcomodo(null)).toBeNull()
    expect(parseAcomodo('{}')).toBeNull()
    expect(parseAcomodo({ v: 2, cajas: [], ocultas: [] })).toBeNull()
    expect(parseAcomodo({ v: 1, cajas: 'no', ocultas: [] })).toBeNull()
  })

  it('un acomodo viejo sin cifras se lee con la lista vacia, no se descarta', () => {
    const a = parseAcomodo({ v: 1, cajas: [{ id: 'equipo', x: 0, y: 0, w: 2, h: 2 }], ocultas: [] })
    expect(a).not.toBeNull()
    expect(a!.cifras).toEqual([])
    expect(a!.cajas).toHaveLength(1)
  })

  it('descarta ids desconocidos y medidas invalidas', () => {
    const a = parseAcomodo({
      v: 1,
      cifras: ['invitados', 'inventada'],
      ocultas: ['inventada'],
      cajas: [
        { id: 'atencion', x: 0, y: 0, w: 2, h: 2 },
        { id: 'inventada', x: 0, y: 2, w: 2, h: 2 },
        { id: 'equipo', x: 0, y: 4, w: 0, h: 2 },
      ],
    })
    expect(a?.cajas.map(c => c.id)).toEqual(['atencion'])
    expect(a?.cifras).toEqual(['invitados'])
    expect(a?.ocultas).toEqual([])
  })
})

describe('mezclarAcomodo', () => {
  const guardado: Acomodo = {
    v: 1,
    cifras: ['mesas', 'tareas', 'invitados', 'atencion'],
    cajas: [{ id: 'atencion', x: 0, y: 0, w: 2, h: 2 }],
    ocultas: ['equipo'],
  }
  const todas = cifrasDisponibles('boda', null, true)

  it('sin nada guardado devuelve el acomodo inicial', () => {
    const cajas: CajaId[] = ['atencion', 'equipo']
    expect(mezclarAcomodo(null, todas, cajas)).toEqual(acomodoInicial(CIFRAS_BASE, cajas))
  })

  it('conserva la posicion y las cifras guardadas', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion', 'equipo'])
    expect(r.cajas.find(c => c.id === 'atencion')).toEqual({ id: 'atencion', x: 0, y: 0, w: 2, h: 2 })
    expect(r.cifras).toEqual(guardado.cifras)
  })

  it('respeta lo que el usuario oculto', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion', 'equipo'])
    expect(r.cajas.some(c => c.id === 'equipo')).toBe(false)
    expect(r.ocultas).toContain('equipo')
  })

  it('una caja nueva se agrega sola, debajo de todo', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion', 'equipo', 'actividad'])
    const nueva = r.cajas.find(c => c.id === 'actividad')
    expect(nueva).toBeDefined()
    expect(nueva!.y).toBeGreaterThanOrEqual(2)
  })

  it('una caja que ya no aplica desaparece de cajas y de ocultas', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion'])
    expect(r.cajas.map(c => c.id)).toEqual(['atencion'])
    expect(r.ocultas).toEqual([])
  })
})

describe('quitarCaja y agregarCaja', () => {
  const base: Acomodo = {
    v: 1,
    cifras: [...CIFRAS_BASE],
    cajas: [{ id: 'atencion', x: 0, y: 0, w: 2, h: 2 }, { id: 'equipo', x: 2, y: 0, w: 2, h: 2 }],
    ocultas: [],
  }

  it('quitar la saca de cajas y la mete en ocultas', () => {
    const r = quitarCaja(base, 'equipo')
    expect(r.cajas.map(c => c.id)).toEqual(['atencion'])
    expect(r.ocultas).toEqual(['equipo'])
  })

  it('agregar la devuelve y la saca de ocultas', () => {
    const r = agregarCaja(quitarCaja(base, 'equipo'), 'equipo')
    expect(r.cajas.map(c => c.id)).toContain('equipo')
    expect(r.ocultas).toEqual([])
  })

  it('agregar una caja que ya esta no la duplica', () => {
    expect(agregarCaja(base, 'atencion').cajas.filter(c => c.id === 'atencion')).toHaveLength(1)
  })

  it('mover cajas no toca las cifras', () => {
    expect(quitarCaja(base, 'equipo').cifras).toEqual(CIFRAS_BASE)
  })
})
```

- [ ] **Step 2: Correr las pruebas para verificar que fallan**

Run: `npx vitest run lib/dashboard/tablero.test.ts`
Expected: FAIL — `Failed to resolve import "./tablero"`.

- [ ] **Step 3: Escribir la implementación**

Crear `lib/dashboard/tablero.ts`:

```ts
import { resolveFeatures, type EnabledFeatures, type FeatureKey } from '@/lib/features'

export const COLUMNAS = 4
export const CIFRAS_EN_BANNER = 4

export type CifraId =
  | 'invitados' | 'presupuesto' | 'proveedores' | 'tareas'
  | 'regalos' | 'mesas' | 'atencion' | 'organizacion'

export type CajaId = 'atencion' | 'pendientes' | 'mesas' | 'regalos' | 'actividad' | 'equipo'

export type Caja = { id: CajaId; x: number; y: number; w: number; h: number }

export type Acomodo = { v: 1; cifras: CifraId[]; cajas: Caja[]; ocultas: CajaId[] }

export type CifraConfig = {
  id: CifraId
  titulo: string
  // null = siempre disponible; con valor = solo si esa herramienta esta encendida.
  feature: FeatureKey | null
  requiereDinero: boolean
}

// El orden importa: es el orden del menu y el que decide a que cifra cae el
// banner cuando una elegida deja de aplicar.
export const CIFRAS: CifraConfig[] = [
  { id: 'invitados',    titulo: 'Invitados',    feature: null,      requiereDinero: false },
  { id: 'presupuesto',  titulo: 'Presupuesto',  feature: null,      requiereDinero: true  },
  { id: 'proveedores',  titulo: 'Proveedores',  feature: null,      requiereDinero: true  },
  { id: 'tareas',       titulo: 'Tareas',       feature: null,      requiereDinero: false },
  { id: 'regalos',      titulo: 'Mesa de regalos', feature: 'regalos', requiereDinero: true },
  { id: 'mesas',        titulo: 'Mesas',        feature: 'mesas',   requiereDinero: false },
  { id: 'atencion',     titulo: 'Requieren atención', feature: null, requiereDinero: false },
  { id: 'organizacion', titulo: 'Organización', feature: null,      requiereDinero: false },
]

export const CIFRAS_BASE: CifraId[] = ['invitados', 'presupuesto', 'proveedores', 'tareas']

export type CajaConfig = {
  id: CajaId
  titulo: string
  feature: FeatureKey | null
  w: number
  h: number
}

// El orden de este arreglo es el acomodo de fabrica. Agregar una caja nueva es
// un renglon aqui: mezclarAcomodo se encarga de que aparezca sola en los
// tableros ya guardados.
export const CATALOGO: CajaConfig[] = [
  { id: 'atencion',   titulo: 'Requiere tu atención',    feature: null,      w: 4, h: 3 },
  { id: 'pendientes', titulo: 'Pendientes de la semana', feature: null,      w: 2, h: 4 },
  { id: 'actividad',  titulo: 'Actividad reciente',      feature: null,      w: 2, h: 4 },
  { id: 'mesas',      titulo: 'Mesas y acomodo',         feature: 'mesas',   w: 2, h: 2 },
  { id: 'regalos',    titulo: 'Mesa de regalos',         feature: 'regalos', w: 2, h: 2 },
  { id: 'equipo',     titulo: 'Equipo',                  feature: null,      w: 2, h: 3 },
]

const CIFRA_POR_ID = new Map<CifraId, CifraConfig>(CIFRAS.map(c => [c.id, c]))
const CAJA_POR_ID = new Map<CajaId, CajaConfig>(CATALOGO.map(c => [c.id, c]))

const ES_CIFRA = (v: unknown): v is CifraId => typeof v === 'string' && CIFRA_POR_ID.has(v as CifraId)
const ES_CAJA  = (v: unknown): v is CajaId  => typeof v === 'string' && CAJA_POR_ID.has(v as CajaId)

export function cifrasDisponibles(
  eventType: string | null,
  enabled: EnabledFeatures | null,
  puedeVerDinero: boolean,
): CifraId[] {
  const features = resolveFeatures(eventType, enabled)
  return CIFRAS
    .filter(c => (c.feature === null || features[c.feature]) && (!c.requiereDinero || puedeVerDinero))
    .map(c => c.id)
}

// El banner siempre trae cuatro. Si lo guardado ya no aplica o viene corto, se
// rellena con las de fabrica y luego con lo que haya, para que nunca quede un
// hueco en la fila.
export function mezclarCifras(guardadas: CifraId[] | null, disponibles: CifraId[]): CifraId[] {
  const permitidas = new Set(disponibles)
  const elegidas: CifraId[] = []

  const empujar = (id: CifraId) => {
    if (elegidas.length >= CIFRAS_EN_BANNER) return
    if (!permitidas.has(id) || elegidas.includes(id)) return
    elegidas.push(id)
  }

  for (const id of guardadas ?? []) empujar(id)
  for (const id of CIFRAS_BASE) empujar(id)
  for (const id of disponibles) empujar(id)

  return elegidas
}

export function cambiarCifra(a: Acomodo, indice: number, nueva: CifraId): Acomodo {
  if (indice < 0 || indice >= a.cifras.length) return a
  const anterior = a.cifras[indice]
  if (anterior === nueva) return a
  const yaEstaEn = a.cifras.indexOf(nueva)
  const cifras = [...a.cifras]
  cifras[indice] = nueva
  // Si ya estaba en otra posicion, se intercambian: el banner no repite cifra.
  if (yaEstaEn !== -1) cifras[yaEstaEn] = anterior
  return { v: 1, cifras, cajas: a.cajas, ocultas: a.ocultas }
}

export function cajasDisponibles(eventType: string | null, enabled: EnabledFeatures | null): CajaId[] {
  const features = resolveFeatures(eventType, enabled)
  return CATALOGO.filter(c => c.feature === null || features[c.feature]).map(c => c.id)
}

// Recorre el catalogo en orden y va llenando renglones de COLUMNAS casillas.
// Cuando la caja no cabe en lo que queda del renglon, baja.
function colocar(cajas: Caja[], ids: CajaId[], desdeY: number): Caja[] {
  let x = 0
  let y = desdeY
  let altoDelRenglon = 0
  for (const id of ids) {
    const cfg = CAJA_POR_ID.get(id)
    if (!cfg) continue
    if (x + cfg.w > COLUMNAS) {
      x = 0
      y += altoDelRenglon
      altoDelRenglon = 0
    }
    cajas.push({ id, x, y, w: cfg.w, h: cfg.h })
    x += cfg.w
    altoDelRenglon = Math.max(altoDelRenglon, cfg.h)
  }
  return cajas
}

export function acomodoInicial(cifras: CifraId[], disponibles: CajaId[]): Acomodo {
  return { v: 1, cifras, cajas: colocar([], disponibles, 0), ocultas: [] }
}

function esMedidaValida(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0
}

// Lectura tolerante: lo guardado viene de la base y pudo escribirse con otra
// version del catalogo. Lo que no entienda se descarta en silencio y esa pieza
// vuelve a caer donde le toque, en vez de tumbar la pantalla.
export function parseAcomodo(raw: unknown): Acomodo | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  if (!Array.isArray(o.cajas)) return null

  const cajas: Caja[] = []
  for (const c of o.cajas) {
    if (c === null || typeof c !== 'object') continue
    const k = c as Record<string, unknown>
    if (!ES_CAJA(k.id)) continue
    if (!esMedidaValida(k.x) || !esMedidaValida(k.y)) continue
    if (!esMedidaValida(k.w) || !esMedidaValida(k.h)) continue
    if (k.w < 1 || k.h < 1 || k.x + k.w > COLUMNAS) continue
    cajas.push({ id: k.id, x: k.x, y: k.y, w: k.w, h: k.h })
  }

  // `cifras` ausente es un acomodo guardado antes de la enmienda del 3-ago:
  // se lee vacio y mezclarCifras le pone las de fabrica. No se descarta.
  const cifras = Array.isArray(o.cifras) ? o.cifras.filter(ES_CIFRA) : []
  const ocultas = Array.isArray(o.ocultas) ? o.ocultas.filter(ES_CAJA) : []

  return { v: 1, cifras, cajas, ocultas }
}

// Una caja que no aparece NI en cajas NI en ocultas es nueva desde el ultimo
// guardado, y se agrega sola debajo de todo. Sin esa distincion, cada caja que
// lancemos despues naceria invisible para quien ya acomodo su tablero.
export function mezclarAcomodo(
  guardado: Acomodo | null,
  cifrasDisp: CifraId[],
  cajasDisp: CajaId[],
): Acomodo {
  const cifras = mezclarCifras(guardado?.cifras ?? null, cifrasDisp)
  if (!guardado) return { ...acomodoInicial(cifras, cajasDisp) }

  const permitidas = new Set(cajasDisp)
  const cajas = guardado.cajas.filter(c => permitidas.has(c.id))
  const ocultas = guardado.ocultas.filter(id => permitidas.has(id))

  const conocidas = new Set<CajaId>([...cajas.map(c => c.id), ...ocultas])
  const nuevas = cajasDisp.filter(id => !conocidas.has(id))
  const desdeY = cajas.reduce((max, c) => Math.max(max, c.y + c.h), 0)

  return { v: 1, cifras, cajas: colocar(cajas, nuevas, desdeY), ocultas }
}

export function quitarCaja(a: Acomodo, id: CajaId): Acomodo {
  if (!a.cajas.some(c => c.id === id)) return a
  return {
    v: 1,
    cifras: a.cifras,
    cajas: a.cajas.filter(c => c.id !== id),
    ocultas: a.ocultas.includes(id) ? a.ocultas : [...a.ocultas, id],
  }
}

export function agregarCaja(a: Acomodo, id: CajaId): Acomodo {
  const ocultas = a.ocultas.filter(o => o !== id)
  if (a.cajas.some(c => c.id === id)) return { v: 1, cifras: a.cifras, cajas: a.cajas, ocultas }
  const cfg = CAJA_POR_ID.get(id)
  if (!cfg) return a
  const y = a.cajas.reduce((max, c) => Math.max(max, c.y + c.h), 0)
  return { v: 1, cifras: a.cifras, cajas: [...a.cajas, { id, x: 0, y, w: cfg.w, h: cfg.h }], ocultas }
}
```

- [ ] **Step 4: Correr las pruebas para verificar que pasan**

Run: `npx vitest run lib/dashboard/tablero.test.ts`
Expected: PASS, los 27 casos en verde.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/tablero.ts lib/dashboard/tablero.test.ts
git commit -m "feat(dashboard): catalogo de cifras del banner y de cajas del tablero"
```

---

### Task 3: Lectura y escritura

Depende del checkpoint humano de la Task 1: la columna tiene que existir.

**Files:**
- Create: `lib/dashboard/tablero-store.ts`

**Interfaces:**
- Consumes: `Acomodo`, `parseAcomodo` de `./tablero`; `supabase` de `@/lib/supabase`.
- Produce:
  - `type TableroGuardado = { acomodo: Acomodo | null; enabledFeatures: EnabledFeatures | null }`
  - `cargarTablero(eventId: string): Promise<TableroGuardado>`
  - `guardarAcomodo(eventId: string, acomodo: Acomodo): Promise<boolean>`

- [ ] **Step 1: Escribir la implementación**

Va en su propia consulta, no dentro de `loadDashboard`. Si esta lectura falla, lo peor que pasa es que el tablero cae al acomodo derivado; metida en la consulta grande de `event_settings`, una columna faltante dejaría sin datos al resto de la pantalla.

Crear `lib/dashboard/tablero-store.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { EnabledFeatures } from '@/lib/features'
import { parseAcomodo, type Acomodo } from './tablero'

export type TableroGuardado = {
  acomodo: Acomodo | null
  enabledFeatures: EnabledFeatures | null
}

export async function cargarTablero(eventId: string): Promise<TableroGuardado> {
  const { data, error } = await supabase
    .from('event_settings')
    .select('dashboard_layout, enabled_features')
    .eq('event_id', eventId)
    .maybeSingle()

  // Sin este log, un error de la consulta se vuelve "nunca lo personalizaron" y
  // el bug queda invisible: el tablero se ve bien, solo ignora lo guardado.
  if (error) {
    console.error('[dashboard] no se pudo leer el acomodo:', error.message)
    return { acomodo: null, enabledFeatures: null }
  }

  return {
    acomodo: parseAcomodo(data?.dashboard_layout ?? null),
    enabledFeatures: (data?.enabled_features ?? null) as EnabledFeatures | null,
  }
}

// Devuelve si de verdad se escribio. Un upsert filtrado por RLS no devuelve
// error: no encuentra la fila y regresa cero resultados. Por eso se cuentan las
// filas con .select() en vez de revisar `error`.
export async function guardarAcomodo(eventId: string, acomodo: Acomodo): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_settings')
    .upsert(
      { event_id: eventId, dashboard_layout: acomodo, updated_at: new Date().toISOString() },
      { onConflict: 'event_id' },
    )
    .select('event_id')

  if (error) {
    console.error('[dashboard] no se pudo guardar el acomodo:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/tablero-store.ts
git commit -m "feat(dashboard): lee y guarda las cifras y el acomodo por evento"
```

---

### Task 4: El hook que gobierna el estado

Un solo dueño del acomodo, porque el banner y el tablero comparten el mismo JSON. Sin esto, dos componentes cargarían y guardarían la misma fila y se pisarían.

**Files:**
- Create: `app/dashboard/useTablero.ts`

**Interfaces:**
- Consumes: `cargarTablero`, `guardarAcomodo` de `@/lib/dashboard/tablero-store`; los helpers de `@/lib/dashboard/tablero`.
- Produce:
  - `type EstadoTablero = { acomodo: Acomodo | null; cifrasDisp: CifraId[]; error: boolean; aplicar: (siguiente: Acomodo) => void; mover: (cajas: Caja[]) => void; persistir: () => Promise<void> }`
  - `useTablero(eventId: string, eventType: string | null, puedeVerDinero: boolean): EstadoTablero`

- [ ] **Step 1: Escribir el hook**

`aplicar` guarda de inmediato (quitar una caja o cambiar una cifra es un gesto único). `mover` solo toca el estado y `persistir` escribe: mientras se arrastra llegan decenas de `onLayoutChange` y guardar en cada uno sería una tormenta de escrituras.

Crear `app/dashboard/useTablero.ts`:

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cajasDisponibles, cifrasDisponibles, mezclarAcomodo,
  type Acomodo, type Caja, type CifraId,
} from '@/lib/dashboard/tablero'
import { cargarTablero, guardarAcomodo } from '@/lib/dashboard/tablero-store'

export type EstadoTablero = {
  acomodo: Acomodo | null
  cifrasDisp: CifraId[]
  error: boolean
  aplicar: (siguiente: Acomodo) => void
  mover: (cajas: Caja[]) => void
  persistir: () => Promise<void>
}

export function useTablero(
  eventId: string,
  eventType: string | null,
  puedeVerDinero: boolean,
): EstadoTablero {
  const [acomodo, setAcomodo] = useState<Acomodo | null>(null)
  const [cifrasDisp, setCifrasDisp] = useState<CifraId[]>([])
  const [error, setError] = useState(false)

  // El ultimo acomodo vivo, para que persistir() no dependa de que el estado ya
  // se haya vuelto a renderizar tras el ultimo arrastre.
  const ultimo = useRef<Acomodo | null>(null)

  useEffect(() => {
    let cancelado = false
    setAcomodo(null)
    setError(false)
    ultimo.current = null

    const cargar = async () => {
      const { acomodo: guardado, enabledFeatures } = await cargarTablero(eventId)
      if (cancelado) return
      const cifras = cifrasDisponibles(eventType, enabledFeatures, puedeVerDinero)
      const cajas = cajasDisponibles(eventType, enabledFeatures)
      const mezclado = mezclarAcomodo(guardado, cifras, cajas)
      setCifrasDisp(cifras)
      setAcomodo(mezclado)
      ultimo.current = mezclado
    }

    cargar()
    return () => { cancelado = true }
  }, [eventId, eventType, puedeVerDinero])

  const guardar = useCallback(async (a: Acomodo) => {
    const ok = await guardarAcomodo(eventId, a)
    setError(!ok)
  }, [eventId])

  const aplicar = useCallback((siguiente: Acomodo) => {
    setAcomodo(siguiente)
    ultimo.current = siguiente
    guardar(siguiente)
  }, [guardar])

  const mover = useCallback((cajas: Caja[]) => {
    setAcomodo(prev => {
      if (!prev) return prev
      const siguiente: Acomodo = { v: 1, cifras: prev.cifras, cajas, ocultas: prev.ocultas }
      ultimo.current = siguiente
      return siguiente
    })
  }, [])

  const persistir = useCallback(async () => {
    if (ultimo.current) await guardar(ultimo.current)
  }, [guardar])

  return { acomodo, cifrasDisp, error, aplicar, mover, persistir }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/useTablero.ts
git commit -m "feat(dashboard): hook que gobierna cifras y acomodo del evento"
```

---

### Task 5: El banner con cifras elegibles

**Files:**
- Create: `app/dashboard/BannerEvento.tsx`

**Interfaces:**
- Consumes: `EventMetrics` de `@/lib/dashboard/types`; `CIFRAS`, `CifraId` de `@/lib/dashboard/tablero`.
- Produce: `export default function BannerEvento(props: { m: EventMetrics; cifras: CifraId[]; cifrasDisp: CifraId[]; modoPersonalizar: boolean; onCambiarCifra: (indice: number, nueva: CifraId) => void; onAbrirEvento: () => void })`

- [ ] **Step 1: Escribir el componente**

Crear `app/dashboard/BannerEvento.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, CircleAlert, CircleCheck, Copy, PencilLine } from 'lucide-react'
import { formatCurrency, formatEventDate } from '@/lib/types'
import { slugifyEvent } from '@/lib/invite'
import { ACCESS_MODES, resolveAccessMode } from '@/lib/features'
import { CIFRAS, type CifraId } from '@/lib/dashboard/tablero'
import type { EventMetrics } from '@/lib/dashboard/types'

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo', paused: 'Pausado', cancelled: 'Cancelado', completed: 'Completado',
}

const INVITACION_CHIP: Record<string, { color: string; texto: string; Icono: React.ElementType }> = {
  publicada: { color: 'text-[#1A9E88]', texto: 'Invitación publicada',   Icono: CircleCheck },
  cambios:   { color: 'text-[#B8860B]', texto: 'Cambios sin publicar',   Icono: CircleAlert },
  borrador:  { color: 'text-[#999]',    texto: 'Invitación en borrador', Icono: PencilLine },
}

const T_LABEL = 'text-[12px] font-semibold uppercase tracking-[0.07em] text-[#999]'
const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

const TITULO_CIFRA = new Map(CIFRAS.map(c => [c.id, c.titulo]))

function getEventDateTime(event: { event_date: string | null; event_time: string | null }): Date {
  if (!event.event_date) return new Date()
  const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number)
  const base = new Date(year, month - 1, day)
  if (event.event_time) {
    const [h, m] = event.event_time.split(':').map(Number)
    base.setHours(h, m, 0, 0)
  } else {
    base.setHours(0, 0, 0, 0)
  }
  return base
}

function formatTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return h12 + ':' + m.toString().padStart(2, '0') + ' ' + ampm
}

function textoCuentaRegresiva(event: { event_date: string | null; event_time: string | null }, now: Date): string {
  const diff = getEventDateTime(event).getTime() - now.getTime()
  if (diff <= 0) return '¡Hoy!'
  const dias = Math.floor(diff / 86400000)
  if (dias >= 1) return dias === 1 ? 'en 1 día' : `en ${dias} días`
  const horas = Math.floor(diff / 3600000)
  return horas <= 1 ? 'en menos de 1 hora' : `en ${horas} horas`
}

// Promedio simple de las cuatro dimensiones que el planner ya mueve a mano.
// Deliberadamente sin pesos: cualquier ponderacion seria inventada.
function pctOrganizacion(m: EventMetrics): number {
  const cabezas = m.mesas.conLugar + m.mesas.sinLugar
  const acomodado = cabezas > 0 ? (m.mesas.conLugar / cabezas) * 100 : 0
  const totalTareas = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas
  const alDia = totalTareas > 0 ? ((totalTareas - m.tareas.vencidas) / totalTareas) * 100 : 0
  return Math.round((m.invitados.pctConfirmado + Math.min(100, m.dinero.pctContratado) + acomodado + alDia) / 4)
}

type Pintada = { valor: string; nota: string; tramos: { pct: number; color: string }[]; pie: string }

// Una entrada por cifra del catalogo. El tipo Record obliga a que agregar un
// CifraId nuevo no compile hasta que se le de su pintura aqui.
const PINTAR: Record<CifraId, (m: EventMetrics) => Pintada> = {
  invitados: m => {
    const total = m.invitados.total || 1
    return {
      valor: String(m.invitados.confirmados),
      nota: `de ${m.invitados.total}`,
      tramos: [
        { pct: (m.invitados.confirmados / total) * 100, color: '#48C9B0' },
        { pct: (m.invitados.pendientes  / total) * 100, color: '#D4A853' },
        { pct: (m.invitados.declinados  / total) * 100, color: '#E4E4E4' },
      ],
      pie: `${m.invitados.pctConfirmado}% confirmado · ${m.invitados.pendientes} por responder · ${m.invitados.declinados} no asisten`,
    }
  },
  presupuesto: m => {
    const pista = Math.max(m.dinero.estimado, m.dinero.contratado) || 1
    return {
      valor: formatCurrency(m.dinero.estimado, m.event.currency),
      nota: 'estimado',
      tramos: m.dinero.excedido
        ? [{ pct: 100, color: '#CC3333' }]
        : [
            { pct: (m.dinero.pagado   / pista) * 100, color: '#1A9E88' },
            { pct: (m.dinero.porPagar / pista) * 100, color: '#48C9B0' },
          ],
      pie: m.dinero.excedido
        ? `Excedido en ${formatCurrency(m.dinero.contratado - m.dinero.estimado, m.event.currency)}`
        : `Pagado ${formatCurrency(m.dinero.pagado, m.event.currency)} · por pagar ${formatCurrency(m.dinero.porPagar, m.event.currency)}`,
    }
  },
  proveedores: m => {
    const total = m.proveedores.total || 1
    return {
      valor: String(m.proveedores.contratados),
      nota: `de ${m.proveedores.total}`,
      tramos: [
        { pct: (m.proveedores.contratados / total) * 100, color: '#48C9B0' },
        { pct: (m.proveedores.cotizados   / total) * 100, color: '#D4A853' },
      ],
      pie: `${m.proveedores.cotizados} cotizados · ${m.proveedores.nuevos} sin cotizar`,
    }
  },
  tareas: m => {
    const total = m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas || 1
    return {
      valor: String(m.tareas.vencidas),
      nota: m.tareas.vencidas === 1 ? 'vencida' : 'vencidas',
      tramos: [
        { pct: (m.tareas.vencidas / total) * 100, color: '#CC3333' },
        { pct: (m.tareas.hoy      / total) * 100, color: '#D4A853' },
        { pct: (m.tareas.proximas / total) * 100, color: '#48C9B0' },
      ],
      pie: `${m.tareas.hoy} para hoy · ${m.tareas.proximas} próximas${m.tareas.bloqueantesVencidas > 0 ? ` · ${m.tareas.bloqueantesVencidas} bloqueantes` : ''}`,
    }
  },
  regalos: m => ({
    valor: formatCurrency(m.regalos.recibido, m.event.currency),
    nota: 'recibido',
    tramos: [{ pct: m.regalos.totalItems > 0 ? (m.regalos.apartados / m.regalos.totalItems) * 100 : 0, color: '#D4A853' }],
    pie: `${m.regalos.apartados} de ${m.regalos.totalItems} apartados`,
  }),
  mesas: m => {
    const cabezas = m.mesas.conLugar + m.mesas.sinLugar
    const pct = cabezas > 0 ? Math.round((m.mesas.conLugar / cabezas) * 100) : 0
    return {
      valor: `${pct}%`,
      nota: 'acomodado',
      tramos: [{ pct, color: '#48C9B0' }],
      pie: `${m.mesas.conLugar} con lugar · ${m.mesas.sinLugar} sin lugar · ${m.mesas.sillasLibres} sillas libres`,
    }
  },
  atencion: m => {
    const total = m.invitados.total || 1
    return {
      valor: String(m.invitados.atencion),
      nota: m.invitados.atencion === 1 ? 'invitado' : 'invitados',
      tramos: [{ pct: (m.invitados.atencion / total) * 100, color: '#CC3333' }],
      pie: m.invitados.atencion === 0 ? 'Nadie espera respuesta' : 'Escribieron algo que hay que resolver',
    }
  },
  organizacion: m => {
    const pct = pctOrganizacion(m)
    return {
      valor: `${pct}%`,
      nota: 'en orden',
      tramos: [{ pct, color: '#48C9B0' }],
      pie: 'Promedio de invitados, dinero, logística y tareas',
    }
  },
}

function Barra({ tramos }: { tramos: { pct: number; color: string }[] }) {
  return (
    <div className="my-2.5 flex h-2 overflow-hidden rounded-full bg-[#F0F0F0]">
      {tramos.filter(t => t.pct > 0).map((t, i) => (
        <span key={i} className="block h-full transition-all duration-500" style={{ width: `${t.pct}%`, background: t.color }} />
      ))}
    </div>
  )
}

function Cifra({ id, indice, m, modoPersonalizar, cifrasDisp, onCambiarCifra }: {
  id: CifraId
  indice: number
  m: EventMetrics
  modoPersonalizar: boolean
  cifrasDisp: CifraId[]
  onCambiarCifra: (indice: number, nueva: CifraId) => void
}) {
  const [menu, setMenu] = useState(false)
  const d = PINTAR[id](m)

  useEffect(() => { if (!modoPersonalizar) setMenu(false) }, [modoPersonalizar])

  return (
    <div className="relative min-w-0 flex-1 px-4 py-4 sm:px-5">
      {modoPersonalizar ? (
        <>
          <button
            onClick={() => setMenu(p => !p)}
            aria-expanded={menu}
            className="flex items-center gap-1.5 rounded-[8px] border border-dashed border-[#CCC] px-2 py-1 transition hover:border-[#48C9B0]"
          >
            <span className={T_LABEL}>{TITULO_CIFRA.get(id) ?? id}</span>
            <ChevronDown size={13} className="text-[#BBB]" />
          </button>
          {menu && (
            <div className="absolute left-4 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#E8E8E8] bg-white shadow-lg">
              {cifrasDisp.map(opcion => (
                <button
                  key={opcion}
                  onClick={() => { setMenu(false); onCambiarCifra(indice, opcion) }}
                  className={'block w-full px-4 py-2.5 text-left text-[13.5px] transition hover:bg-[#F8F8F8] ' + (opcion === id ? 'font-semibold text-[#1A9E88]' : 'text-[#1D1E20]')}
                >
                  {TITULO_CIFRA.get(opcion) ?? opcion}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <span className={T_LABEL}>{TITULO_CIFRA.get(id) ?? id}</span>
      )}

      <p className="mt-1.5 font-display text-[26px] font-extrabold leading-none tracking-[-0.025em] sm:text-[30px]">
        {d.valor}
        <span className="ml-1.5 text-[13px] font-medium tracking-normal text-[#888]">{d.nota}</span>
      </p>
      <Barra tramos={d.tramos} />
      <p className="text-[12.5px] text-[#888]">{d.pie}</p>
    </div>
  )
}

export default function BannerEvento({ m, cifras, cifrasDisp, modoPersonalizar, onCambiarCifra, onAbrirEvento }: {
  m: EventMetrics
  cifras: CifraId[]
  cifrasDisp: CifraId[]
  modoPersonalizar: boolean
  onCambiarCifra: (indice: number, nueva: CifraId) => void
  onAbrirEvento: () => void
}) {
  const [now, setNow] = useState(new Date())
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const ev = m.event
  const inv = INVITACION_CHIP[m.invitacion] ?? INVITACION_CHIP.borrador
  const acceso = ACCESS_MODES.find(a => a.key === resolveAccessMode(ev.event_type, m.accessMode))

  // El origin se lee al hacer clic, no en un efecto: guardarlo en estado
  // desincroniza el render del servidor con el del cliente.
  const copiarLink = async () => {
    if (!m.sharedToken) return
    const slug = slugifyEvent({ name: ev.name, host_name: ev.host_name, host_name_2: ev.host_name_2 })
    await navigator.clipboard.writeText(`${window.location.origin}/invitacion/${slug}/${m.sharedToken}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white">

      <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-[#f3fbf9] px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-[320px] w-[320px] rounded-full bg-[#48C9B0]/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.09em] text-[#999]">
              {ev.event_type && (
                <>
                  <span>{ev.event_type}</span>
                  <span className="text-[#DDD]">/</span>
                </>
              )}
              <span className={'flex items-center gap-1.5 ' + (ev.event_status === 'active' ? 'text-[#1A9E88]' : 'text-[#B8860B]')}>
                <i className={'h-[7px] w-[7px] rounded-full ' + (ev.event_status === 'active' ? 'bg-[#48C9B0]' : 'bg-[#D4A853]')} />
                {ESTADO_LABEL[ev.event_status] ?? ev.event_status}
              </span>
            </div>

            <h2 className="mt-2 font-display text-[26px] font-black leading-[1.03] tracking-[-0.03em] sm:text-[32px]">
              {ev.name}
            </h2>

            <p className="mt-2 text-[13px] text-[#777] sm:text-[14px]">
              {formatEventDate(ev.event_date, ev.event_end_date)}
              {ev.event_time && ` · ${formatTime(ev.event_time)}`}
              <span className="font-semibold text-[#1A9E88]"> · {textoCuentaRegresiva(ev, now)}</span>
            </p>

            {ev.venue && <p className="mt-1 text-[13px] text-[#999]">{ev.venue}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              <span className={'flex items-center gap-2 font-medium ' + inv.color}>
                <inv.Icono size={15} />
                {inv.texto}
              </span>
              {acceso && (
                <span className="flex items-center gap-2 text-[#999]">
                  <acceso.icon size={15} />
                  {acceso.label}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              onClick={onAbrirEvento}
              className="flex-1 rounded-[10px] bg-[#48C9B0] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#3ab89f] active:scale-95 sm:flex-none"
            >
              Abrir evento
            </button>
            {m.sharedToken && (
              <button onClick={copiarLink} className={BTN_SEC + ' flex flex-1 items-center justify-center gap-2 sm:flex-none'}>
                {copiado ? <Check size={14} className="text-[#1A9E88]" /> : <Copy size={14} />}
                {copiado ? 'Copiado' : 'Copiar link'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-[#EEE] border-t border-[#E8E8E8] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {cifras.map((id, i) => (
          <Cifra
            key={id}
            id={id}
            indice={i}
            m={m}
            modoPersonalizar={modoPersonalizar}
            cifrasDisp={cifrasDisp}
            onCambiarCifra={onCambiarCifra}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/BannerEvento.tsx
git commit -m "feat(dashboard): banner con cuatro cifras elegibles por el planner"
```

---

### Task 6: Las seis cajas

Es una extracción: el contenido ya existe en `ContextoEvento.tsx` y solo cambia de envoltura. No se rediseña nada aquí.

**Files:**
- Create: `app/dashboard/cajas/CajaShell.tsx`
- Create: `app/dashboard/cajas/CajaAtencion.tsx`
- Create: `app/dashboard/cajas/CajaPendientes.tsx`
- Create: `app/dashboard/cajas/CajaMesas.tsx`
- Create: `app/dashboard/cajas/CajaRegalos.tsx`
- Create: `app/dashboard/cajas/CajaActividad.tsx`
- Create: `app/dashboard/cajas/CajaEquipo.tsx`

**Interfaces:**
- Consumes: `EventMetrics`, `ColaboradorRow` de `@/lib/dashboard/types`; `CajaId` de `@/lib/dashboard/tablero`.
- Produce: `CajaShell`, el tipo `PropsCaja` y los seis componentes con la firma `(p: PropsCaja) => React.JSX.Element`.

- [ ] **Step 1: Escribir el envoltorio**

Crear `app/dashboard/cajas/CajaShell.tsx`:

```tsx
'use client'

import { GripVertical, X } from 'lucide-react'
import type { CajaId } from '@/lib/dashboard/tablero'
import type { ColaboradorRow, EventMetrics } from '@/lib/dashboard/types'

const T_SECCION = 'font-display text-[18px] font-bold tracking-[-0.015em] sm:text-[20px]'
const T_META = 'text-[12.5px] text-[#888]'

export const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

// Firma unica de las seis cajas. Cada una recibe todo aunque no use todo: asi
// el mapa de componentes del Tablero es un Record homogeneo.
export type PropsCaja = {
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  usuarioEmail: string
  puedeVerDinero: boolean
  modoPersonalizar: boolean
  onQuitar: (id: CajaId) => void
}

// La manija de arrastre es la clase .caja-arrastre: react-grid-layout la recibe
// como draggableHandle, para que dentro de la caja se pueda hacer clic sin
// correr el tablero.
export default function CajaShell({ id, titulo, meta, accion, modoPersonalizar, onQuitar, children }: {
  id: CajaId
  titulo: string
  meta?: string
  accion?: { label: string; href: string }
  modoPersonalizar: boolean
  onQuitar: (id: CajaId) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white">
      <div className={'flex shrink-0 items-center justify-between gap-3 border-b border-[#E8E8E8] px-5 py-4 ' + (modoPersonalizar ? 'caja-arrastre cursor-grab active:cursor-grabbing' : '')}>
        <div className="flex min-w-0 items-center gap-2">
          {modoPersonalizar && <GripVertical size={16} className="shrink-0 text-[#BBB]" />}
          <div className="min-w-0">
            <h3 className={T_SECCION}>{titulo}</h3>
            {meta && <p className={T_META}>{meta}</p>}
          </div>
        </div>

        {modoPersonalizar ? (
          <button
            onClick={() => onQuitar(id)}
            aria-label={`Quitar ${titulo} del tablero`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[#E0E0E0] bg-white text-[#888] transition hover:border-[#CC3333] hover:text-[#CC3333]"
          >
            <X size={15} />
          </button>
        ) : accion ? (
          <button onClick={() => { window.location.href = accion.href }} className={BTN_SEC + ' shrink-0'}>
            {accion.label}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Extraer las seis cajas**

Cada caja importa `CajaShell` y `PropsCaja` de `./CajaShell`. El contenido se **mueve** desde `app/dashboard/ContextoEvento.tsx` (versión actual, antes de la Task 8), quitando el `<div>` externo y el encabezado propio, que ahora los pone el shell.

| Archivo nuevo | Contenido a mover de `ContextoEvento.tsx` | Encabezado del shell |
|---|---|---|
| `CajaAtencion.tsx` | El `<FeedAtencion>` de la línea 414, calculando `buildUrgencias([m], { puedeVerDinero })` adentro. Se le pasa `titulo=""` y `mostrarEvento={false}` — el título ya lo pone el shell, así que dentro de `FeedAtencion` no se repite | `titulo="Requiere tu atención"`, sin acción |
| `CajaPendientes.tsx` | Líneas 419-456: estado `tareas`/`fallo`, `marcarHecha`, `diasDeTarea` y la lista, más `CHIP_BASE`/`CHIP_MUTE`/`CHIP_BAD`/`CHIP_WARN`/`T_META` | `titulo="Pendientes de la semana"`, `meta="Márcalas aquí, sin entrar al timeline"`, `accion={{ label: 'Ver timeline', href: '/events/' + m.event.id + '/timeline' }}` |
| `CajaMesas.tsx` | Líneas 458-469: `pctAcomodado` y las cuatro `<Ficha>`, más el componente `Ficha` de las líneas 128-137 | `titulo="Mesas y acomodo"`, `meta={`${m.mesas.mesas} mesas · ${m.mesas.conGente} con gente`}` |
| `CajaRegalos.tsx` | Líneas 302-316 (`tarjetaRegalos`) sin su encabezado propio, más `Barra` (118-126), `T_METRICA` y `T_CUERPO` | `titulo="Mesa de regalos"`, sin acción |
| `CajaActividad.tsx` | Líneas 473-498: el `useEffect` que lee `event_audit_log`, `ICONO_ACTIVIDAD` (89-92), `haceCuanto` y la lista | `titulo="Actividad reciente"`, sin acción |
| `CajaEquipo.tsx` | Líneas 500-529: la lista de dueño y colaboradores, más `ROL_LABEL` (98) y `CHIP_MUTE` | `titulo="Equipo"`, `accion={{ label: '+ Invitar', href: '/events/' + m.event.id + '/configuracion' }}` |

Tres ajustes obligados respecto al código de hoy:

1. `CajaPendientes` y `CajaActividad` traen su propio `useEffect` de resembrado por `m.event.id`, porque al cambiar de evento el estado local tiene que reiniciarse — igual que hoy hace `ContextoEvento` en las líneas 162-181.
2. Ninguna caja pone `rounded-2xl border bg-white` propio: eso lo da el shell. La caja solo aporta su contenido con su padding (`px-5 py-1` en las listas, `px-5 py-4` en las de fichas).
3. `CajaActividad` necesita `now` para `haceCuanto`. En vez del `setInterval` de un segundo que hay hoy, usa un `new Date()` calculado en el render: la actividad se mide en minutos y horas, un tic por segundo solo provoca renders.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: exit 0. `ContextoEvento.tsx` todavía no las usa; se cablean en la Task 8.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/cajas
git commit -m "feat(dashboard): extrae las seis cajas del tablero con envoltorio comun"
```

---

### Task 7: El tablero acomodable

**Files:**
- Create: `app/dashboard/Tablero.tsx`

**Interfaces:**
- Consumes: `Acomodo`, `CajaId`, `COLUMNAS` de `@/lib/dashboard/tablero`; `PropsCaja` de `./cajas/CajaShell`; las seis cajas.
- Produce: `export default function Tablero(props: { acomodo: Acomodo; m: EventMetrics; colaboradores: ColaboradorRow[]; usuarioEmail: string; puedeVerDinero: boolean; modoPersonalizar: boolean; onQuitar: (id: CajaId) => void; onMover: (cajas: Caja[]) => void })`

- [ ] **Step 1: Escribir el componente**

Tres notas que evitan errores conocidos:

- `WidthProvider(GridLayout)` se construye **a nivel de módulo**. Dentro del componente crearía un tipo nuevo en cada render y remontaría todo el tablero a media interacción.
- Los dos estilos de la librería se importan en este archivo. Next.js App Router permite importar CSS global desde cualquier componente.
- En el teléfono no se acomoda: debajo de `lg` las cajas se apilan en el orden guardado, sin cuadrícula.

Crear `app/dashboard/Tablero.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { COLUMNAS, type Acomodo, type Caja, type CajaId } from '@/lib/dashboard/tablero'
import type { ColaboradorRow, EventMetrics } from '@/lib/dashboard/types'
import type { PropsCaja } from './cajas/CajaShell'
import CajaAtencion from './cajas/CajaAtencion'
import CajaPendientes from './cajas/CajaPendientes'
import CajaMesas from './cajas/CajaMesas'
import CajaRegalos from './cajas/CajaRegalos'
import CajaActividad from './cajas/CajaActividad'
import CajaEquipo from './cajas/CajaEquipo'

// A nivel de modulo a proposito: construirlo dentro del componente lo remonta
// en cada render y el tablero pierde el arrastre a medias.
const Rejilla = WidthProvider(GridLayout)

const RENGLON = 64
const SEPARACION: [number, number] = [16, 16]

const COMPONENTE: Record<CajaId, (p: PropsCaja) => React.JSX.Element> = {
  atencion: CajaAtencion,
  pendientes: CajaPendientes,
  mesas: CajaMesas,
  regalos: CajaRegalos,
  actividad: CajaActividad,
  equipo: CajaEquipo,
}

export default function Tablero({
  acomodo, m, colaboradores, usuarioEmail, puedeVerDinero, modoPersonalizar, onQuitar, onMover,
}: {
  acomodo: Acomodo
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  usuarioEmail: string
  puedeVerDinero: boolean
  modoPersonalizar: boolean
  onQuitar: (id: CajaId) => void
  onMover: (cajas: Caja[]) => void
}) {
  const layout: Layout[] = useMemo(
    () => acomodo.cajas.map(c => ({ i: c.id, x: c.x, y: c.y, w: c.w, h: c.h, minW: 1, minH: 2 })),
    [acomodo.cajas],
  )

  const props = (modo: boolean): Omit<PropsCaja, never> => ({
    m, colaboradores, usuarioEmail, puedeVerDinero, modoPersonalizar: modo, onQuitar,
  })

  const alMover = (nuevo: Layout[]) => {
    if (!modoPersonalizar) return
    const porId = new Map(nuevo.map(l => [l.i, l]))
    onMover(acomodo.cajas.map(c => {
      const l = porId.get(c.id)
      return l ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c
    }))
  }

  return (
    <>
      <div className="flex flex-col gap-4 lg:hidden">
        {acomodo.cajas.map(c => {
          const Caja = COMPONENTE[c.id]
          return (
            <div key={c.id} className="min-h-[220px]">
              <Caja {...props(false)} />
            </div>
          )
        })}
      </div>

      <div className="hidden lg:block">
        <Rejilla
          layout={layout}
          cols={COLUMNAS}
          rowHeight={RENGLON}
          margin={SEPARACION}
          containerPadding={[0, 0]}
          isDraggable={modoPersonalizar}
          isResizable={modoPersonalizar}
          draggableHandle=".caja-arrastre"
          onLayoutChange={alMover}
          compactType="vertical"
        >
          {acomodo.cajas.map(c => {
            const Caja = COMPONENTE[c.id]
            return (
              <div key={c.id}>
                <Caja {...props(modoPersonalizar)} />
              </div>
            )
          })}
        </Rejilla>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/Tablero.tsx
git commit -m "feat(dashboard): tablero acomodable con cuadricula de cuatro columnas"
```

---

### Task 8: Cablear el contexto evento

**Files:**
- Modify: `app/dashboard/ContextoEvento.tsx` (se reescribe completo)

**Interfaces:**
- Consumes: `useTablero`, `BannerEvento`, `Tablero`; `agregarCaja`, `cambiarCifra`, `quitarCaja`, `CATALOGO` de `@/lib/dashboard/tablero`.
- Produce: `ContextoEvento` con la **misma firma de props que hoy** — `page.tsx` no cambia.

- [ ] **Step 1: Reescribir el componente**

Reemplazar todo el contenido de `app/dashboard/ContextoEvento.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import { Check, LayoutGrid, Plus } from 'lucide-react'
import {
  CATALOGO, agregarCaja, cambiarCifra, quitarCaja,
  type CajaId, type CifraId,
} from '@/lib/dashboard/tablero'
import { useTablero } from './useTablero'
import BannerEvento from './BannerEvento'
import Tablero from './Tablero'
import type { ColaboradorRow, EventMetrics, Rol } from '@/lib/dashboard/types'

const BTN_SEC = 'rounded-[10px] border border-[#E0E0E0] bg-[#F8F8F8] px-3.5 py-2 text-[13px] font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]'

const TITULO_CAJA = new Map(CATALOGO.map(c => [c.id, c.titulo]))

type Props = {
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  rol: Rol
  puedeVerDinero: boolean
  usuarioEmail: string
  onAbrirEvento: () => void
}

// `rol` se conserva en la firma porque page.tsx lo pasa. El orden de las cifras
// ahora lo elige el planner, asi que el rol ya no lo decide; no se quita el
// parametro para no tocar al llamador.
export default function ContextoEvento({ m, colaboradores, puedeVerDinero, usuarioEmail, onAbrirEvento }: Props) {
  const { acomodo, cifrasDisp, error, aplicar, mover, persistir } = useTablero(
    m.event.id, m.event.event_type, puedeVerDinero,
  )
  const [modo, setModo] = useState(false)
  const [menu, setMenu] = useState(false)

  // Solo el dueno puede escribir en event_settings: las policies de INSERT y
  // UPDATE son is_event_owner. Con el boton visible para un editor, el guardado
  // fallaria en silencio.
  const esDueno = !m.event.is_shared

  const salirDeModo = async () => {
    setModo(false)
    setMenu(false)
    await persistir()
  }

  if (!acomodo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-56 animate-pulse rounded-2xl border border-[#E8E8E8] bg-white" />
        <div className="h-64 animate-pulse rounded-2xl border border-[#E8E8E8] bg-white" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {esDueno && (
        <div className="hidden items-center justify-end gap-2 lg:flex">
          {error && <span className="text-[13px] text-[#CC3333]">No se pudo guardar el acomodo.</span>}

          {modo && acomodo.ocultas.length > 0 && (
            <div className="relative">
              <button onClick={() => setMenu(p => !p)} className={BTN_SEC + ' flex items-center gap-2'}>
                <Plus size={14} />
                Agregar caja
              </button>
              {menu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[#E8E8E8] bg-white shadow-lg">
                  {acomodo.ocultas.map(id => (
                    <button
                      key={id}
                      onClick={() => { setMenu(false); aplicar(agregarCaja(acomodo, id)) }}
                      className="block w-full px-4 py-2.5 text-left text-[13.5px] text-[#1D1E20] transition hover:bg-[#F8F8F8]"
                    >
                      {TITULO_CAJA.get(id) ?? id}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {modo ? (
            <button
              onClick={salirDeModo}
              className="flex items-center gap-2 rounded-[10px] bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3ab89f]"
            >
              <Check size={14} />
              Listo
            </button>
          ) : (
            <button onClick={() => setModo(true)} className={BTN_SEC + ' flex items-center gap-2'}>
              <LayoutGrid size={14} />
              Personalizar
            </button>
          )}
        </div>
      )}

      <BannerEvento
        m={m}
        cifras={acomodo.cifras}
        cifrasDisp={cifrasDisp}
        modoPersonalizar={modo}
        onCambiarCifra={(i: number, nueva: CifraId) => aplicar(cambiarCifra(acomodo, i, nueva))}
        onAbrirEvento={onAbrirEvento}
      />

      <Tablero
        acomodo={acomodo}
        m={m}
        colaboradores={colaboradores}
        usuarioEmail={usuarioEmail}
        puedeVerDinero={puedeVerDinero}
        modoPersonalizar={modo}
        onQuitar={(id: CajaId) => aplicar(quitarCaja(acomodo, id))}
        onMover={mover}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar que no quedó código muerto**

Run: `npx eslint app/dashboard lib/dashboard --max-warnings=0`
Expected: sin errores de `no-unused-vars` en los archivos nuevos. El repo trae errores de lint preexistentes en otros archivos: comparar contra `git stash`, no contra cero.

- [ ] **Step 3: Verificar que compila y que las pruebas siguen verdes**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm test`
Expected: PASS, con los casos que ya había más los 27 nuevos.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/ContextoEvento.tsx
git commit -m "refactor(dashboard): el contexto evento compone banner, tablero y modo personalizar"
```

---

### Task 9: Verificación

**Files:** ninguno.

- [ ] **Step 1: Build de producción**

Apagar el dev server antes (comparten `.next` y el build lo mata).

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 2: CHECKPOINT HUMANO — Diego revisa en el navegador**

Levantar `npm run dev -- -p 3001` desde `C:/Users/diego/Documents/anfiora-dashboard` y pedirle a Diego que confirme, en `/dashboard` con un evento seleccionado:

1. El banner muestra nombre, fecha, cuenta regresiva y cuatro cifras: invitados, presupuesto, proveedores y tareas.
2. Con "Personalizar", cada cifra abre un menú y se puede cambiar por mesas, regalos, atención u organización. Elegir una que ya estaba en otra posición las intercambia, no las duplica.
3. Las seis cajas aparecen debajo, y las de mesas y regalos solo si esas herramientas están encendidas en el evento.
4. En modo personalizar, las cajas se arrastran por su encabezado y se redimensionan por la esquina.
5. Fuera del modo, un clic dentro de una caja hace lo suyo (marcar una tarea, abrir el timeline) y **no** mueve el tablero.
6. La X quita una caja y "Agregar caja" la devuelve.
7. Al recargar, tanto las cifras elegidas como el acomodo se conservan.
8. En un evento compartido donde Diego **no** es dueño, el botón "Personalizar" no aparece.
9. Con un rol sin acceso a montos, presupuesto y proveedores no salen ni en el banner ni en el menú de cifras, y el banner sigue con cuatro.
10. En el teléfono las cajas se apilan y no hay botón de personalizar.

- [ ] **Step 3: Actualizar la memoria del proyecto**

Con el OK de Diego, dejar registrado que la anatomía nueva quedó implementada, para que la nota `dashboard-v2-giro-banner-cajas` deje de decir que el código implementa la anatomía vieja, y anotar la enmienda de cifras elegibles.

---

## Self-Review

**Cobertura del spec:**

| Decisión del spec | Task |
|---|---|
| 1. El tablero vive en el contexto evento; `/events/[id]` no se toca | 8 |
| 2. El acomodo es del evento, lo define el owner | 3 (guardado con conteo de filas), 8 (botón solo para dueño) |
| 3. El hero es un solo banner con cuatro cifras | 5 |
| 3-bis (enmienda 3-ago). El planner elige cuáles cuatro; las cuatro base son el default; una cifra que deja de aplicar cae a la siguiente sin dejar hueco | 2 (`cifrasDisponibles`, `mezclarCifras`, `cambiarCifra`), 5 (menú por cifra) |
| 4. Debajo, cajas acomodables | 6, 7 |
| 5. El tamaño cae en cuadrícula | 7 (`react-grid-layout`, `cols=4`) |
| 6. El acomodo inicial se arma con las features activas | 2 (`cajasDisponibles` vía `resolveFeatures`) |
| 7. Se acomoda en un modo aparte, con X y "Agregar caja" | 8 |
| 8. En el teléfono no se acomoda | 7 (apilado bajo `lg`) |
| Persistencia: columna nullable, JSON `v:1`, `cifras` y `ocultas` explícitos | 1 (SQL), 2 (`parseAcomodo`/`mezclarAcomodo`), 3 (upsert) |
| `lib/dashboard/` sobrevive intacto | ninguna tarea lo modifica |

**Fuera de alcance, dejado explícito:** las **cajas** de playlist, álbum, comida, dress code e invitación. El spec las menciona como "las demás features", pero `lib/dashboard/` no consulta esas tablas: cada una es una consulta y una métrica nuevas. El `CATALOGO` de la Task 2 las admite con un renglón, y `mezclarAcomodo` está probado para que aparezcan solas en los tableros ya guardados. Las ocho **cifras** del banner sí entran completas, porque todas salen de números que `metrics.ts` ya calcula.

**Consistencia de tipos:** `CifraId`, `CajaId`, `Caja`, `Acomodo`, `CifraConfig`, `CajaConfig`, `COLUMNAS`, `CIFRAS_EN_BANNER`, `CIFRAS`, `CIFRAS_BASE`, `CATALOGO`, `cifrasDisponibles`, `mezclarCifras`, `cambiarCifra`, `cajasDisponibles`, `acomodoInicial`, `parseAcomodo`, `mezclarAcomodo`, `quitarCaja`, `agregarCaja`, `TableroGuardado`, `cargarTablero`, `guardarAcomodo`, `EstadoTablero`, `useTablero` y `PropsCaja` se usan con el mismo nombre y la misma forma en las Tasks 2, 3, 4, 5, 6, 7 y 8.
