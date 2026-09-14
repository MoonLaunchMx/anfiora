# Tramo 4 — Actividad: leer la bitacora y restaurar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueno de una boda pueda leer todo lo que paso en ella y regresar lo que se borro, incluyendo lotes completos de un solo movimiento.

**Architecture:** Los doce modulos ya escriben en `event_audit_log` (disparadores de Postgres para borrados, `logAction()` para el resto) y nadie puede leerlo: la unica policy de SELECT es `is_platform_admin()`. Este tramo agrega la pantalla de lectura como cuarta pestana de Configuracion, la logica pura de agrupado y restauracion en `lib/actividad/`, y el SQL que abre la lectura a duenos y admins. Restaurar es re-insertar `old_value` desde el cliente con RLS puesta — sin service role, sin `deleted_at`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (browser client), Vitest para logica pura.

**Spec:** `docs/superpowers/specs/2026-09-04-accesos-por-herramienta-design.md` (§4.3, §5.4, §6, §11 Tramo 4)

**Mockup aprobado por Diego:** https://claude.ai/code/artifact/cda47159-b63e-4a9f-a7d5-bb3ff092baae

**Rama:** `feat/accesos-actividad`, cortada de **`main`**.

Se decidio primero cortar de `feat/accesos-cierre` y **se corrigio el 6-sep**: esa rama no toca **ninguno** de los archivos que este tramo necesita (`git diff --name-only main..feat/accesos-cierre` no incluye `configuracion/`, `lib/audit.ts`, `lib/permisos/` ni `layout.tsx`), y el SQL de aqui tampoco depende del suyo. Cortar de `main` desacopla los dos tramos: el 4 puede llegar a produccion sin esperar a que el 3 se pruebe y se mergee.

## Global Constraints

- **El codigo va a produccion ANTES que el SQL.** Consecuencia asumida: la pantalla sale vacia para todos menos Diego (que pasa `is_platform_admin()`) hasta que el SQL corra. Diego puede probarla completa en local desde el dia uno por esa misma razon.
- **Los `.sql` se escriben y se commitean. Nunca se corren.** Los corre Diego.
- **No mergear a main hasta que Diego lo pruebe en local.**
- **No correr `npm run build` con el dev server arriba.** Verificar con `npx tsc --noEmit` y `npm test`. `npm run build` solo antes de pushear, avisando a Diego primero.
- UI en espanol **con acentos**. Commits **sin acentos ni enye**.
- Sin emojis. Solo Tailwind. Iconos de `lucide-react`. CTA en teal `#48C9B0`. Negro `#1D1E20` solo en dropdowns de filtro.
- Archivos completos al proponer cambios, nunca fragmentos.
- No tocar Supabase por ningun medio.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/audit.ts` (modificar) | Crece `AuditAction`, `AuditEntityType` y `AUDIT_ACTION_LABEL` con las 10 acciones de disparador y las de restauracion. Lo consume tambien la caja de actividad de Dashboard v2. |
| `lib/actividad/tipos.ts` (crear) | `FilaAudit` (la fila cruda de la tabla) y `Movimiento` (la fila ya agrupada que pinta la pantalla). |
| `lib/actividad/agrupar.ts` (crear) | Puro. De filas crudas a movimientos agrupados. El corazon del tramo. |
| `lib/actividad/agrupar.test.ts` (crear) | Pruebas del agrupado. |
| `lib/actividad/restaurar.ts` (crear) | Puro. De un movimiento a un plan de inserciones ordenado padre-primero, mas el mapa entidad -> tabla. |
| `lib/actividad/restaurar.test.ts` (crear) | Pruebas del plan de restauracion. |
| `app/events/[id]/configuracion/ActividadTab.tsx` (crear) | La pantalla: riel de filtros, lista por dia, detalle desplegable, restaurar. |
| `app/events/[id]/configuracion/page.tsx` (modificar) | Cierra la ruta a quien no es dueno/admin, agrega la cuarta pestana y lee `?tab=`. |
| `docs/superpowers/plans/sql/2026-09-07-actividad-lectura.sql` (crear) | Policy de SELECT para duenos y admins, y arreglo de la etiqueta del proveedor. |

---

### Task 1: Cerrar la ruta de Configuracion

Hoy el nav esconde Configuracion (`adminOnly: true` filtrado por `canAdmin` en `layout.tsx`), pero la ruta no la cierra: en `layout.tsx:759` el corte es `rutaBloqueada && moduloActual`, y Configuracion no es modulo, asi que `moduloActual` es `null` y los children se pintan. Cualquier colaborador que escriba la URL entra a la pestana de Equipo, donde se reparten los permisos. Va primero porque este tramo mete el historial de borrados y el boton de restaurar detras de esa misma puerta.

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx`

**Interfaces:**
- Consumes: `useEventAccess()` de `lib/event-access-context.tsx` — expone `canAdmin: boolean` e `isLoading: boolean`.
- Produces: nada nuevo para otras tareas.

- [ ] **Step 1: Leer el archivo completo y localizar el primer return del componente**

Leer `app/events/[id]/configuracion/page.tsx`. `canAdmin` ya se desestructura de `useEventAccess()` en la linea 245 pero solo se usa para deshabilitar toggles. Hay que agregar `isLoading` a esa desestructuracion.

- [ ] **Step 2: Agregar el corte de ruta**

En la desestructuracion existente:

```tsx
const { features, updateFeatures, canAdmin, isLoading } = useEventAccess()
```

Y justo antes del `return` principal del componente (despues de todos los hooks — nunca antes, o React se queja de hooks condicionales):

```tsx
// La ruta no es un modulo, asi que la guarda del layout no la cubre: el nav
// la esconde pero escribir la URL entraba igual. Exigir !isLoading o todos
// verian el mensaje mientras cargan los permisos.
if (!isLoading && !canAdmin) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="max-w-sm text-center">
        <Lock size={28} className="mx-auto mb-3 text-[#ddd]" />
        <h2 className="mb-1 text-base font-semibold text-[#1D1E20]">Configuración</h2>
        <p className="text-sm text-[#888]">
          Solo el dueño de la boda y sus administradores entran aquí.
        </p>
      </div>
    </div>
  )
}
```

Agregar `Lock` al import de `lucide-react` que ya existe en el archivo.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificacion manual (Diego, en local)**

1. Con la sesion del dueno: `/events/<id>/configuracion` abre normal, las tres pestanas presentes.
2. Con sesion de colaborador: escribir la URL a mano muestra el mensaje, **no** el formulario ni la pestana Equipo.
3. Al recargar con sesion de colaborador no parpadea el mensaje antes de cargar (eso comprueba el `!isLoading`).

- [ ] **Step 5: Commit**

```bash
git add app/events/[id]/configuracion/page.tsx
git commit -m "fix(configuracion): cerrar la ruta, el nav la escondia pero la URL entraba"
```

---

### Task 2: Crecer el vocabulario de la bitacora

Los disparadores del Tramo 3 escriben diez acciones que `lib/audit.ts` no conoce. No rompe nada porque la tabla no tiene CHECK, pero la pantalla mostraria `budget.deleted` en crudo. Se agregan aqui, junto con las de restauracion que va a escribir la Task 5.

**Files:**
- Modify: `lib/audit.ts`
- Create: `lib/audit.test.ts`

**Interfaces:**
- Produces: `AuditAction` y `AuditEntityType` (uniones de strings) y `AUDIT_ACTION_LABEL: Record<AuditAction, string>`. `ACCIONES_BORRADO` y `ACCIONES_RESTAURACION` como arreglos `readonly AuditAction[]`. Los consumen las Tasks 3, 4 y 5, y ya los consume `app/dashboard/ContextoEvento.tsx` en la rama de Dashboard v2.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/audit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  AUDIT_ACTION_LABEL, ACCIONES_BORRADO, ACCIONES_RESTAURACION,
  entidadDeAccion, esBorrado,
  type AuditAction,
} from './audit'

// Los diez disparadores que corren hoy en produccion, con el nombre exacto
// que escriben. Fuente: docs/superpowers/plans/sql/2026-09-0*.sql
const DISPARADORES: AuditAction[] = [
  'timeline_task.deleted', 'itinerary_moment.deleted', 'budget.deleted',
  'event_supplier.deleted', 'payment.deleted', 'guest.deleted',
  'party_member.deleted', 'table.deleted', 'gift_item.deleted', 'song.deleted',
]

describe('AUDIT_ACTION_LABEL', () => {
  it('tiene etiqueta para toda accion de disparador', () => {
    for (const a of DISPARADORES) {
      expect(AUDIT_ACTION_LABEL[a], a).toBeTruthy()
    }
  })

  it('no deja ninguna accion sin etiqueta', () => {
    for (const [accion, label] of Object.entries(AUDIT_ACTION_LABEL)) {
      expect(label.trim(), accion).not.toBe('')
    }
  })
})

describe('ACCIONES_BORRADO', () => {
  it('contiene los diez disparadores y nada mas', () => {
    expect([...ACCIONES_BORRADO].sort()).toEqual([...DISPARADORES].sort())
  })

  it('esBorrado reconoce solo los borrados', () => {
    expect(esBorrado('guest.deleted')).toBe(true)
    expect(esBorrado('guest.updated')).toBe(false)
    expect(esBorrado('guest.restored')).toBe(false)
  })
})

describe('ACCIONES_RESTAURACION', () => {
  it('hay una restauracion por cada borrado', () => {
    expect(ACCIONES_RESTAURACION.length).toBe(ACCIONES_BORRADO.length)
    for (const b of ACCIONES_BORRADO) {
      const r = b.replace('.deleted', '.restored') as AuditAction
      expect(ACCIONES_RESTAURACION).toContain(r)
    }
  })
})

describe('entidadDeAccion', () => {
  it('parte la accion en su entidad', () => {
    expect(entidadDeAccion('event_supplier.deleted')).toBe('event_supplier')
    expect(entidadDeAccion('guest.restored')).toBe('guest')
  })
})
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `npx vitest run lib/audit.test.ts`
Expected: FAIL — `ACCIONES_BORRADO` no existe.

- [ ] **Step 3: Crecer lib/audit.ts**

Agregar a la union `AuditAction` (despues de las existentes, sin quitar ninguna):

```ts
  // Borrados que escriben los disparadores de Postgres (Tramo 3).
  | 'timeline_task.deleted'
  | 'itinerary_moment.deleted'
  | 'budget.deleted'
  | 'event_supplier.deleted'
  | 'payment.deleted'
  | 'gift_item.deleted'
  | 'song.deleted'
  // Restauraciones que escribe la pantalla de Actividad (Tramo 4).
  | 'guest.restored'
  | 'party_member.restored'
  | 'table.restored'
  | 'timeline_task.restored'
  | 'itinerary_moment.restored'
  | 'budget.restored'
  | 'event_supplier.restored'
  | 'payment.restored'
  | 'gift_item.restored'
  | 'song.restored'
```

`guest.deleted`, `party_member.deleted` y `table.deleted` ya estaban en la union — no duplicarlas. Ninguna pantalla llama `logAction()` para esos borrados (se verifico: `bulkDelete` y el borrado individual no lo hacen), asi que el disparador es la unica fuente y no hay filas dobles.

Agregar a `AuditEntityType`:

```ts
  | 'timeline_task'
  | 'itinerary_moment'
  | 'budget'
  | 'event_supplier'
  | 'payment'
  | 'gift_item'
  | 'song'
```

Agregar a `AUDIT_ACTION_LABEL`:

```ts
  'timeline_task.deleted':     'Tarea eliminada',
  'itinerary_moment.deleted':  'Momento del itinerario eliminado',
  'budget.deleted':            'Partida eliminada',
  'event_supplier.deleted':    'Proveedor quitado de la boda',
  'payment.deleted':           'Pago eliminado',
  'gift_item.deleted':         'Regalo eliminado',
  'song.deleted':              'Canción eliminada',
  'guest.restored':            'Invitado restaurado',
  'party_member.restored':     'Acompañante restaurado',
  'table.restored':            'Mesa restaurada',
  'timeline_task.restored':    'Tarea restaurada',
  'itinerary_moment.restored': 'Momento del itinerario restaurado',
  'budget.restored':           'Partida restaurada',
  'event_supplier.restored':   'Proveedor restaurado',
  'payment.restored':          'Pago restaurado',
  'gift_item.restored':        'Regalo restaurado',
  'song.restored':             'Canción restaurada',
```

Y al final del archivo:

```ts
export const ACCIONES_BORRADO = [
  'guest.deleted', 'party_member.deleted', 'table.deleted',
  'timeline_task.deleted', 'itinerary_moment.deleted', 'budget.deleted',
  'event_supplier.deleted', 'payment.deleted', 'gift_item.deleted', 'song.deleted',
] as const satisfies readonly AuditAction[]

export const ACCIONES_RESTAURACION = ACCIONES_BORRADO
  .map(a => a.replace('.deleted', '.restored')) as unknown as readonly AuditAction[]

export function entidadDeAccion(accion: string): string {
  return accion.split('.')[0] ?? ''
}

export function esBorrado(accion: string): boolean {
  return (ACCIONES_BORRADO as readonly string[]).includes(accion)
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `npx vitest run lib/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: todo verde. `AUDIT_ACTION_LABEL` es un `Record<AuditAction, string>`, asi que si falta una etiqueta `tsc` lo caza; correr `npx tsc --noEmit` tambien.

- [ ] **Step 6: Commit**

```bash
git add lib/audit.ts lib/audit.test.ts
git commit -m "feat(actividad): la bitacora ya conoce las diez acciones de disparador"
```

---

### Task 3: Agrupar los movimientos

El problema que Diego planteo: cien cambios de estatus en un dia son cien renglones ilegibles, y ochenta y siete invitados borrados de un jalon son ochenta y siete botones de restaurar. Se agrupa por dos reglas distintas porque las dos fuentes son distintas: los borrados traen `batch_id` del disparador (una transaccion = un lote, y `bulkDelete` borra con un solo `.delete().in('id', [...])`), y las ediciones de `logAction()` no traen nada, asi que se agrupan por persona, accion, modulo y cercania en el tiempo.

**Files:**
- Create: `lib/actividad/tipos.ts`
- Create: `lib/actividad/agrupar.ts`
- Create: `lib/actividad/agrupar.test.ts`

**Interfaces:**
- Consumes: `esBorrado`, `AUDIT_ACTION_LABEL`, `entidadDeAccion` de `lib/audit.ts` (Task 2). `Modulo` de `lib/permisos/catalogo.ts`.
- Produces:
  - `type FilaAudit` — la fila cruda tal como sale de Supabase.
  - `type Movimiento` — `{ clave, accion, etiquetaAccion, modulo, persona, personaId, cuando, esBorrado, batchId, filas: FilaAudit[], total, restaurado }`.
  - `function agrupar(filas: FilaAudit[], restaurados: Set<string>): Movimiento[]`
  - `const VENTANA_MS = 10 * 60 * 1000`

- [ ] **Step 1: Escribir tipos.ts**

```ts
import type { Modulo } from '@/lib/permisos/catalogo'

// La fila cruda de event_audit_log. user_email es NOT NULL en la base;
// user_id y user_name aceptan NULL (los borrados por service role corren
// sin auth.uid()).
export interface FilaAudit {
  id: string
  event_id: string
  user_id: string | null
  user_email: string
  user_name: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  modulo: string | null
  batch_id: string | null
  created_at: string
}

export interface Movimiento {
  clave: string            // estable entre repintados: batch_id, o id de la primera fila
  accion: string           // action de la primera fila
  etiquetaAccion: string   // de AUDIT_ACTION_LABEL, o la action cruda si no hay
  modulo: Modulo | null    // null = movimiento que no pertenece a una herramienta (equipo, evento)
  persona: string          // user_name, o user_email si no hay nombre
  personaId: string | null
  cuando: string           // created_at mas reciente del grupo
  esBorrado: boolean
  batchId: string | null
  filas: FilaAudit[]       // ordenadas created_at DESC = padre primero al restaurar
  total: number            // filas.length, para no recalcularlo en la pantalla
  restaurado: boolean      // todas sus filas ya se restauraron
}
```

- [ ] **Step 2: Escribir la prueba que falla**

Crear `lib/actividad/agrupar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { agrupar, VENTANA_MS } from './agrupar'
import type { FilaAudit } from './tipos'

let n = 0
function fila(over: Partial<FilaAudit> = {}): FilaAudit {
  n += 1
  return {
    id: 'f' + n,
    event_id: 'ev1',
    user_id: 'u1',
    user_email: 'patty@anfiora.com',
    user_name: 'Patty García',
    action: 'guest.updated',
    entity_type: 'guest',
    entity_id: 'g' + n,
    entity_label: 'Invitado ' + n,
    old_value: null,
    new_value: null,
    modulo: 'invitados',
    batch_id: null,
    created_at: '2026-09-05T18:00:00.000Z',
    ...over,
  }
}

describe('agrupar — borrados por batch_id', () => {
  it('junta en un movimiento las filas que comparten batch_id', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:02.000Z' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:01.000Z' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:00.000Z' }),
    ]
    const movs = agrupar(filas, new Set())
    expect(movs).toHaveLength(1)
    expect(movs[0].total).toBe(3)
    expect(movs[0].esBorrado).toBe(true)
    expect(movs[0].clave).toBe('b1')
  })

  it('no junta batch_id distintos aunque sean del mismo segundo', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1' }),
      fila({ action: 'guest.deleted', batch_id: 'b2' }),
    ]
    expect(agrupar(filas, new Set())).toHaveLength(2)
  })

  it('deja las filas del lote en created_at descendente, que es el orden de restauracion', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:00.000Z', entity_label: 'hijo' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:02.000Z', entity_label: 'padre' }),
    ]
    const [mov] = agrupar(filas, new Set())
    expect(mov.filas.map(f => f.entity_label)).toEqual(['padre', 'hijo'])
  })
})

describe('agrupar — ediciones por persona, accion, modulo y cercania', () => {
  it('junta ediciones de la misma persona dentro de la ventana', () => {
    const base = new Date('2026-09-05T18:00:00.000Z').getTime()
    const filas = [
      fila({ created_at: new Date(base).toISOString() }),
      fila({ created_at: new Date(base + 60_000).toISOString() }),
      fila({ created_at: new Date(base + 120_000).toISOString() }),
    ]
    const movs = agrupar(filas, new Set())
    expect(movs).toHaveLength(1)
    expect(movs[0].total).toBe(3)
    expect(movs[0].esBorrado).toBe(false)
  })

  it('corta el grupo cuando el hueco pasa la ventana', () => {
    const base = new Date('2026-09-05T18:00:00.000Z').getTime()
    const filas = [
      fila({ created_at: new Date(base).toISOString() }),
      fila({ created_at: new Date(base + VENTANA_MS + 1000).toISOString() }),
    ]
    expect(agrupar(filas, new Set())).toHaveLength(2)
  })

  it('no junta a dos personas distintas aunque coincidan en todo lo demas', () => {
    const filas = [
      fila({ user_id: 'u1', user_name: 'Patty García' }),
      fila({ user_id: 'u2', user_name: 'Frida Gamboa' }),
    ]
    expect(agrupar(filas, new Set())).toHaveLength(2)
  })

  it('no junta acciones distintas de la misma persona', () => {
    const filas = [
      fila({ action: 'guest.updated' }),
      fila({ action: 'guest.rsvp_updated' }),
    ]
    expect(agrupar(filas, new Set())).toHaveLength(2)
  })
})

describe('agrupar — restaurado', () => {
  it('marca el movimiento cuando todas sus entidades ya volvieron', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1', entity_id: 'g1' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', entity_id: 'g2' }),
    ]
    expect(agrupar(filas, new Set(['g1', 'g2']))[0].restaurado).toBe(true)
  })

  it('no lo marca si falta una', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1', entity_id: 'g1' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', entity_id: 'g2' }),
    ]
    expect(agrupar(filas, new Set(['g1']))[0].restaurado).toBe(false)
  })
})

describe('agrupar — forma de salida', () => {
  it('ordena los movimientos del mas reciente al mas viejo', () => {
    const filas = [
      fila({ action: 'table.deleted', batch_id: 'viejo', created_at: '2026-09-01T10:00:00.000Z' }),
      fila({ action: 'table.deleted', batch_id: 'nuevo', created_at: '2026-09-05T10:00:00.000Z' }),
    ]
    expect(agrupar(filas, new Set()).map(m => m.clave)).toEqual(['nuevo', 'viejo'])
  })

  it('usa el correo cuando no hay nombre', () => {
    const [mov] = agrupar([fila({ user_name: null })], new Set())
    expect(mov.persona).toBe('patty@anfiora.com')
  })

  it('cae en la accion cruda cuando no hay etiqueta', () => {
    const [mov] = agrupar([fila({ action: 'cosa.rara' })], new Set())
    expect(mov.etiquetaAccion).toBe('cosa.rara')
  })

  it('tira el modulo que no es de los doce', () => {
    const [mov] = agrupar([fila({ modulo: 'inventado' })], new Set())
    expect(mov.modulo).toBeNull()
  })

  it('con la lista vacia devuelve lista vacia', () => {
    expect(agrupar([], new Set())).toEqual([])
  })
})
```

- [ ] **Step 3: Correr la prueba y verla fallar**

Run: `npx vitest run lib/actividad/agrupar.test.ts`
Expected: FAIL — el modulo `./agrupar` no existe.

- [ ] **Step 4: Escribir agrupar.ts**

```ts
import { AUDIT_ACTION_LABEL, esBorrado, type AuditAction } from '@/lib/audit'
import { MODULOS, type Modulo } from '@/lib/permisos/catalogo'
import type { FilaAudit, Movimiento } from './tipos'

// Cuanto silencio parte una tanda de ediciones en dos. Diez minutos separa
// "estuvo capturando confirmaciones" de "volvio despues de comer".
export const VENTANA_MS = 10 * 60 * 1000

const ES_MODULO = new Set<string>(MODULOS)

const ts = (f: FilaAudit) => new Date(f.created_at).getTime()

function moduloValido(m: string | null): Modulo | null {
  return m && ES_MODULO.has(m) ? (m as Modulo) : null
}

function armar(filas: FilaAudit[], restaurados: Set<string>): Movimiento {
  // Descendente: el disparador AFTER DELETE de una cascada corre hijos
  // primero, asi que leer al reves deja al padre arriba, que es el orden en
  // que hay que volver a insertarlos.
  const orden = [...filas].sort((a, b) => ts(b) - ts(a));
  const cabeza = orden[0]
  const borrado = esBorrado(cabeza.action)

  return {
    clave: cabeza.batch_id ?? cabeza.id,
    accion: cabeza.action,
    etiquetaAccion: AUDIT_ACTION_LABEL[cabeza.action as AuditAction] ?? cabeza.action,
    modulo: moduloValido(cabeza.modulo),
    persona: cabeza.user_name ?? cabeza.user_email,
    personaId: cabeza.user_id,
    cuando: cabeza.created_at,
    esBorrado: borrado,
    batchId: cabeza.batch_id,
    filas: orden,
    total: orden.length,
    restaurado: borrado && orden.every(f => f.entity_id !== null && restaurados.has(f.entity_id)),
  }
}

export function agrupar(filas: FilaAudit[], restaurados: Set<string>): Movimiento[] {
  if (filas.length === 0) return []

  const porLote = new Map<string, FilaAudit[]>()
  const sueltas: FilaAudit[] = []

  // Los borrados vienen del disparador y siempre traen batch_id: una
  // transaccion es un lote. Las ediciones vienen de logAction() y no traen
  // nada, asi que se agrupan por parecido.
  for (const f of filas) {
    if (f.batch_id && esBorrado(f.action)) {
      const previas = porLote.get(f.batch_id)
      if (previas) previas.push(f)
      else porLote.set(f.batch_id, [f])
    } else {
      sueltas.push(f)
    }
  }

  const grupos: FilaAudit[][] = [...porLote.values()]

  const ordenadas = [...sueltas].sort((a, b) => ts(b) - ts(a))
  let actual: FilaAudit[] = []

  const mismaTanda = (a: FilaAudit, b: FilaAudit) =>
    a.user_id === b.user_id &&
    a.action === b.action &&
    a.modulo === b.modulo &&
    Math.abs(ts(a) - ts(b)) <= VENTANA_MS

  for (const f of ordenadas) {
    // Se compara contra la ultima de la tanda, no contra la primera: asi una
    // captura larga se mantiene junta mientras no haya un hueco real.
    if (actual.length > 0 && mismaTanda(actual[actual.length - 1], f)) {
      actual.push(f)
    } else {
      if (actual.length > 0) grupos.push(actual)
      actual = [f]
    }
  }
  if (actual.length > 0) grupos.push(actual)

  return grupos
    .map(g => armar(g, restaurados))
    .sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime())
}
```

- [ ] **Step 5: Correr la prueba y verla pasar**

Run: `npx vitest run lib/actividad/agrupar.test.ts`
Expected: PASS, los 13 casos.

- [ ] **Step 6: Verificar tipos y suite**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores, todo verde.

- [ ] **Step 7: Commit**

```bash
git add lib/actividad/tipos.ts lib/actividad/agrupar.ts lib/actividad/agrupar.test.ts
git commit -m "feat(actividad): agrupar la bitacora por lote y por tanda de edicion"
```

---

### Task 4: El plan de restauracion

Restaurar es volver a insertar `old_value` con su `id` original. Lo que se puede probar sin base es la parte dificil: a que tabla va cada entidad, en que orden entran las filas de un lote, y que se descarta antes de insertar.

**Files:**
- Create: `lib/actividad/restaurar.ts`
- Create: `lib/actividad/restaurar.test.ts`

**Interfaces:**
- Consumes: `FilaAudit`, `Movimiento` de `./tipos` (Task 3). `entidadDeAccion` de `lib/audit.ts` (Task 2).
- Produces:
  - `const TABLA_POR_ENTIDAD: Record<string, string>`
  - `type Insercion = { tabla: string; fila: Record<string, unknown>; entityId: string; accionRestauracion: string }`
  - `function planDeRestauracion(mov: Movimiento, soloEstos?: Set<string>): Insercion[]`
  - `function esConflictoDeLlave(error: { code?: string } | null): boolean`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/actividad/restaurar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { planDeRestauracion, TABLA_POR_ENTIDAD, esConflictoDeLlave } from './restaurar'
import { ACCIONES_BORRADO, entidadDeAccion } from '@/lib/audit'
import type { FilaAudit, Movimiento } from './tipos'

function fila(over: Partial<FilaAudit>): FilaAudit {
  return {
    id: 'f1', event_id: 'ev1', user_id: 'u1',
    user_email: 'diego@anfiora.com', user_name: 'Diego Garza',
    action: 'guest.deleted', entity_type: 'guest', entity_id: 'g1',
    entity_label: 'Juan', old_value: { id: 'g1', name: 'Juan', event_id: 'ev1' },
    new_value: null, modulo: 'invitados', batch_id: 'b1',
    created_at: '2026-09-05T18:00:00.000Z',
    ...over,
  }
}

function mov(filas: FilaAudit[]): Movimiento {
  return {
    clave: 'b1', accion: filas[0].action, etiquetaAccion: 'x',
    modulo: 'invitados', persona: 'Diego Garza', personaId: 'u1',
    cuando: filas[0].created_at, esBorrado: true, batchId: 'b1',
    filas, total: filas.length, restaurado: false,
  }
}

describe('TABLA_POR_ENTIDAD', () => {
  it('cubre las diez entidades que borran los disparadores', () => {
    for (const accion of ACCIONES_BORRADO) {
      expect(TABLA_POR_ENTIDAD[entidadDeAccion(accion)], accion).toBeTruthy()
    }
  })
})

describe('planDeRestauracion', () => {
  it('respeta el orden de las filas: el padre entra primero', () => {
    const filas = [
      fila({ id: 'f1', entity_id: 'g1', entity_type: 'guest', old_value: { id: 'g1' } }),
      fila({ id: 'f2', entity_id: 'p1', entity_type: 'party_member', action: 'party_member.deleted', old_value: { id: 'p1' } }),
    ]
    const plan = planDeRestauracion(mov(filas))
    expect(plan.map(i => i.tabla)).toEqual(['guests', 'party_members'])
  })

  it('manda la accion de restauracion que le toca a cada entidad', () => {
    const plan = planDeRestauracion(mov([fila({})]))
    expect(plan[0].accionRestauracion).toBe('guest.restored')
  })

  it('inserta old_value tal cual, con su id', () => {
    const plan = planDeRestauracion(mov([fila({ old_value: { id: 'g1', name: 'Juan', event_id: 'ev1' } })]))
    expect(plan[0].fila).toEqual({ id: 'g1', name: 'Juan', event_id: 'ev1' })
  })

  it('salta las filas sin old_value: no hay nada que regresar', () => {
    expect(planDeRestauracion(mov([fila({ old_value: null })]))).toEqual([])
  })

  it('salta las filas sin entity_id: no se podrian marcar despues', () => {
    expect(planDeRestauracion(mov([fila({ entity_id: null })]))).toEqual([])
  })

  it('salta la entidad que no sabe a que tabla va', () => {
    expect(planDeRestauracion(mov([fila({ entity_type: 'marciano', action: 'marciano.deleted' })]))).toEqual([])
  })

  it('con soloEstos deja pasar unicamente los pedidos', () => {
    const filas = [
      fila({ id: 'f1', entity_id: 'g1', old_value: { id: 'g1' } }),
      fila({ id: 'f2', entity_id: 'g2', old_value: { id: 'g2' } }),
    ]
    const plan = planDeRestauracion(mov(filas), new Set(['g2']))
    expect(plan).toHaveLength(1)
    expect(plan[0].entityId).toBe('g2')
  })
})

describe('esConflictoDeLlave', () => {
  it('reconoce el choque de llave duplicada de Postgres', () => {
    expect(esConflictoDeLlave({ code: '23505' })).toBe(true)
  })

  it('no confunde otros errores', () => {
    expect(esConflictoDeLlave({ code: '42501' })).toBe(false)
    expect(esConflictoDeLlave(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `npx vitest run lib/actividad/restaurar.test.ts`
Expected: FAIL — el modulo `./restaurar` no existe.

- [ ] **Step 3: Escribir restaurar.ts**

```ts
import { entidadDeAccion } from '@/lib/audit'
import type { Movimiento } from './tipos'

// La entidad que escribe el disparador -> la tabla de la que salio. Los
// nombres de entidad vienen del segundo argumento de log_borrado() en los
// .sql del Tramo 3.
export const TABLA_POR_ENTIDAD: Record<string, string> = {
  guest:            'guests',
  party_member:     'party_members',
  table:            'tables',
  timeline_task:    'event_timeline_tasks',
  itinerary_moment: 'event_itinerary_moments',
  budget:           'event_budgets',
  event_supplier:   'event_suppliers',
  payment:          'supplier_payments',
  gift_item:        'gift_registry_items',
  song:             'song_recommendations',
}

export interface Insercion {
  tabla: string
  fila: Record<string, unknown>
  entityId: string
  accionRestauracion: string
}

// `filas` ya viene en created_at descendente desde agrupar(), que es el orden
// padre-primero: el hijo no entra si su padre todavia no existe.
export function planDeRestauracion(mov: Movimiento, soloEstos?: Set<string>): Insercion[] {
  const plan: Insercion[] = []

  for (const f of mov.filas) {
    if (!f.old_value || !f.entity_id) continue
    if (soloEstos && !soloEstos.has(f.entity_id)) continue

    const entidad = f.entity_type ?? entidadDeAccion(f.action)
    const tabla = TABLA_POR_ENTIDAD[entidad]
    if (!tabla) continue

    plan.push({
      tabla,
      fila: f.old_value,
      entityId: f.entity_id,
      accionRestauracion: entidad + '.restored',
    })
  }

  return plan
}

// 23505 = unique_violation. Restaurar dos veces lo mismo choca contra la
// llave primaria, y eso no es un error que reportar: es "ya estaba".
export function esConflictoDeLlave(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `npx vitest run lib/actividad/restaurar.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar tipos y suite**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores, todo verde.

- [ ] **Step 6: Commit**

```bash
git add lib/actividad/restaurar.ts lib/actividad/restaurar.test.ts
git commit -m "feat(actividad): plan de restauracion, padre primero y por entidad"
```

---

### Task 5: La pantalla de Actividad

Cuarta pestana de Configuracion. Sigue el mockup aprobado: riel de filtros con el switcher negro, lista agrupada por dia, detalle desplegable, y restaurar a la derecha del renglon.

**PUERTA DE UI:** el mockup ya esta aprobado por Diego (artifact de arriba). Si al construir aparece una decision visual que el mockup no cubre, **parar y levantar el artifact otra vez** antes de escribir esa parte. Regla de [[ui-iterar-en-artifact-no-en-preview]].

**Files:**
- Create: `app/events/[id]/configuracion/ActividadTab.tsx`
- Modify: `app/events/[id]/configuracion/page.tsx`

**Interfaces:**
- Consumes: `agrupar` y los tipos de `lib/actividad/` (Tasks 3 y 4), `AUDIT_ACTION_LABEL` y `ACCIONES_RESTAURACION` de `lib/audit.ts` (Task 2), `MODULOS_CONFIG` de `lib/permisos/catalogo.ts`, `TabToggle` de `app/components/ui/TabToggle.tsx`, `Modal` y `askConfirm` como ya los usa el resto de Configuracion, `supabase` de `lib/supabase.ts`.
- Produces: componente `<ActividadTab eventId={string} />` por defecto.

- [ ] **Step 1: Escribir el componente**

Reglas de construccion, todas verificadas contra el mockup aprobado:

1. **Carga.** Un `useEffect` que lee `event_audit_log` filtrado por `event_id`, `order('created_at', { ascending: false })`, `limit(500)`. De ese mismo resultado se saca el `Set<string>` de restaurados: los `entity_id` de las filas cuya `action` esta en `ACCIONES_RESTAURACION`. Se pasa todo a `agrupar()`.
2. **Cero datos no es cero errores.** Mientras el SQL de la Task 6 no corra, la consulta devuelve `[]` **sin error** para quien no es admin de plataforma. El estado vacio debe decir *"Todavía no hay actividad en esta boda"* y nada mas — nunca inventar que fallo algo.
3. **Filtros.** Switcher negro `Todo | Borrados` (regla: mismas filas, otra representacion). Dos `<select>` en negro `#1D1E20`: herramienta (de `MODULOS_CONFIG`, solo las que aparecen en los datos) y persona. El conteo a la derecha.
4. **Encabezados de dia.** `Hoy` / `Ayer` / `martes 2 de septiembre`, con el mismo formato que `app/events/[id]/mensajes/page.tsx` usa hoy. Sticky.
5. **Renglon.** Avatar de iniciales con color estable derivado del nombre (los seis tonos apagados del mockup), etiqueta (nombre de la entidad, o el conteo si es lote), chip rojo `Eliminado`, glosa gris con accion + herramienta + persona en el tono de la persona. Riel derecho en este orden: **chevron, fecha, boton**. La fecha con `min-width` fijo para que la columna no baile. En movil la fecha se va a la glosa y el riel se queda solo con el boton.
6. **Fecha relativa.** `hace 40 min`, `hace 3 h`, `ayer, 18:20`, `hace 3 días`. Confirmado por Diego.
7. **Etiqueta faltante.** Cuando `entity_label` viene vacio (pasa con `event_supplier`, ver Task 6), pintar *"Proveedor sin nombre guardado"* en gris cursiva. Es la unica entidad con ese problema hoy, pero el fallback es generico.
8. **Detalle.** Al desplegar: `old_value` como lista de campo/valor, **no** JSON crudo. Si el movimiento es lote, listar los primeros 5 `entity_label` y *"y N más"*. Cada uno con su `Restaurar solo este`.
9. **Restaurar.** Confirmacion con el `Modal`/`askConfirm` que ya usa la app — nunca `confirm()` del navegador ([[confirm-modal-primitivo]]). El texto enumera lo que regresa. Al aceptar: recorrer `planDeRestauracion()` **en orden**, `await` uno por uno (no `Promise.all`: el padre tiene que existir antes que el hijo), y por cada insercion exitosa llamar `logAction()` con su `accionRestauracion`, `entityId` y `entityLabel`. Si `esConflictoDeLlave(error)` es verdadero, tratarlo como exito silencioso (ya estaba) y escribir la fila de restauracion igual. Cualquier otro error corta el lote y avisa cuantos alcanzaron a volver.
10. **Solo lectura no existe aqui.** La pestana entera vive detras del corte de la Task 1, asi que quien la ve es dueno o admin y puede restaurar. No hay estado intermedio que dibujar.

- [ ] **Step 2: Conectar la pestana en page.tsx**

Agregar al arreglo `TABS` (linea 105), despues de `equipo`:

```tsx
  { key: 'actividad', label: 'Actividad', icon: Activity },
```

Importar `Activity` de `lucide-react`. Agregar el bloque de render junto a los otros:

```tsx
{activeTab === 'actividad' && <ActividadTab eventId={id as string} />}
```

Revisar los dos `activeTab !== 'equipo'` que ya existen (lineas 654 y 692): esconden encabezados que tampoco aplican a Actividad. Cambiarlos a `!['equipo', 'actividad'].includes(activeTab)`.

- [ ] **Step 3: Hacer la pestana enlazable**

`activeTab` es `useState('evento')` puro. Sembrarlo del query param para que `?tab=actividad` abra directo:

```tsx
const searchParams = useSearchParams()
const [activeTab, setActiveTab] = useState(() => {
  const pedida = searchParams.get('tab')
  return TABS.some(t => t.key === pedida) ? pedida! : 'evento'
})
```

Importar `useSearchParams` de `next/navigation`. Solo se lee al montar: cambiar de pestana no reescribe la URL, que es lo que se quiere (no ensuciar el historial del navegador).

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm test`
Expected: todo verde (esta tarea no agrega pruebas; se confirma que no rompio las de las Tasks 2-4).

- [ ] **Step 5: Verificacion manual (Diego, en local)**

Diego pasa `is_platform_admin()`, asi que **ve datos reales desde ahora**, sin esperar al SQL.

1. `/events/<id>/configuracion?tab=actividad` abre en Actividad.
2. Borrar una mesa en otra pestana, volver, recargar: aparece el movimiento con su nombre y su fecha relativa.
3. Restaurar esa mesa: vuelve a `/mesas` con el mismo numero y capacidad.
4. Recargar Actividad: el movimiento ahora dice `Restaurado` y no ofrece el boton.
5. Seleccionar varios invitados y borrarlos en lote: **un solo renglon** con el conteo y un solo boton.
6. Restaurar el lote: vuelven todos, y los acompanantes con ellos.
7. Abrir un lote y usar `Restaurar solo este` en uno: vuelve ese, el resto sigue ofreciendo el boton.
8. Cambiar varias confirmaciones seguidas: se agrupan en un renglon, no en uno por invitado.
9. En movil: el boton de restaurar se queda a la derecha y la fecha baja a la linea gris.

- [ ] **Step 6: Commit**

```bash
git add app/events/[id]/configuracion/ActividadTab.tsx app/events/[id]/configuracion/page.tsx
git commit -m "feat(actividad): pantalla de bitacora con restaurar por lote"
```

---

### Task 6: El SQL — abrir la lectura y arreglar la etiqueta del proveedor

**Se escribe y se commitea. NO se corre.** Lo corre Diego, y solo despues de que el codigo este en `main` y desplegado.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-07-actividad-lectura.sql`

- [ ] **Step 1: Escribir el archivo**

```sql
-- Tramo 4, Actividad: abrir la lectura de la bitacora y arreglar la etiqueta
-- del proveedor.
--
-- REQUISITO UNICO: el codigo del Tramo 4 en main y desplegado.
--
-- NO depende de 2026-09-06-accesos-cierre.sql. Solo se apoya en cosas que
-- existen desde hace tiempo (is_platform_admin, events, event_collaborators) y
-- en log_borrado_proveedor(), que llego con el SQL de finanzas y ya corrio.
-- Se puede correr antes o despues del cierre del Tramo 3, en cualquier orden.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Quien lee la bitacora
-- ============================================================
-- Hasta hoy la unica policy de SELECT era is_platform_admin(): la bitacora se
-- estaba llenando bien y nadie mas que Diego podia verla. La pantalla de
-- Actividad vive detras del candado de Configuracion, que es de duenos y
-- admins, asi que la policy dice exactamente eso y nada mas.
DROP POLICY IF EXISTS actividad_ver ON public.event_audit_log;

CREATE POLICY actividad_ver ON public.event_audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
       WHERE e.id = event_audit_log.event_id
         AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_collaborators c
       WHERE c.event_id = event_audit_log.event_id
         AND c.user_id  = auth.uid()
         AND c.status   = 'active'
         AND c.role     = 'admin'
    )
  );

-- audit_admin_select queda obsoleta: actividad_ver ya incluye su condicion.
DROP POLICY IF EXISTS audit_admin_select ON public.event_audit_log;

-- audit_member_insert se queda como esta: logAction() lo llama cualquier
-- miembro y eso sigue siendo correcto. Sin UPDATE ni DELETE -> la bitacora
-- sigue siendo inmutable desde el cliente, restaurar no la borra: le agrega
-- una fila de restauracion.

-- ============================================================
-- 2. La etiqueta del proveedor
-- ============================================================
-- El disparador del Tramo 3 se colgo con 'event_notes' como columna de
-- etiqueta. Ese campo es la nota libre del proveedor y casi siempre esta
-- vacio, asi que en la bitacora un proveedor borrado sale sin nombre. El
-- nombre vive en suppliers, otra tabla, y old_value si trae supplier_id --
-- pero la etiqueta hay que resolverla al momento del borrado, cuando el
-- proveedor todavia es visible.
CREATE OR REPLACE FUNCTION public.log_borrado_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fila   jsonb := to_jsonb(OLD);
  v_email  text;
  v_nombre text;
  v_label  text;
BEGIN
  SELECT s.name INTO v_label FROM suppliers s WHERE s.id = OLD.supplier_id;

  SELECT u.email, u.full_name INTO v_email, v_nombre
  FROM users u WHERE u.id = auth.uid();

  INSERT INTO event_audit_log (
    event_id, user_id, user_email, user_name,
    action, entity_type, entity_id, entity_label,
    old_value, new_value, modulo, batch_id
  ) VALUES (
    OLD.event_id,
    auth.uid(),
    COALESCE(v_email, ''),
    v_nombre,
    'event_supplier.deleted',
    'event_supplier',
    OLD.id,
    -- El nombre del catalogo; si el proveedor ya no existe, la nota del
    -- evento como ultimo recurso.
    COALESCE(NULLIF(v_label, ''), NULLIF(OLD.event_notes, '')),
    v_fila,
    NULL,
    'proveedores',
    (('00000000-0000-4000-8000-' || lpad(to_hex(txid_current()), 12, '0'))::uuid)
  );

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_borrado_proveedor() FROM PUBLIC;

DROP TRIGGER IF EXISTS log_borrado_proveedor ON public.event_suppliers;
CREATE TRIGGER log_borrado_proveedor
  AFTER DELETE ON public.event_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado_proveedor();

COMMIT;

-- ============================================================
-- Verificacion (correr aparte, despues del COMMIT)
-- ============================================================
-- Debe salir una sola policy de SELECT, llamada actividad_ver:
-- SELECT policyname, cmd FROM pg_policies
--  WHERE tablename = 'event_audit_log' ORDER BY policyname;
--
-- Debe salir el disparador colgado de event_suppliers:
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'public.event_suppliers'::regclass AND NOT tgisinternal;
--
-- Las filas viejas de proveedor siguen sin etiqueta: el arreglo es hacia
-- adelante. La pantalla las pinta como "Proveedor sin nombre guardado".

-- ============================================================
-- Para deshacer
-- ============================================================
-- DROP POLICY IF EXISTS actividad_ver ON public.event_audit_log;
-- CREATE POLICY audit_admin_select ON public.event_audit_log
--   FOR SELECT TO authenticated USING (public.is_platform_admin());
```

- [ ] **Step 2: Commit sin correr**

```bash
git add docs/superpowers/plans/sql/2026-09-07-actividad-lectura.sql
git commit -m "feat(actividad): SQL de lectura de bitacora y etiqueta de proveedor"
```

- [ ] **Step 3: Avisar a Diego**

Decirle explicitamente: el archivo esta commiteado, **no corrido**, y va **despues** de que el codigo este en main y desplegado, y **despues** de `2026-09-06-accesos-cierre.sql`.

---

## Lo que este tramo NO hace, y por que

- **La vista de despacho (`/perfil` -> Actividad).** Diferida al Tramo 5 por decision de Diego (5-sep). `/perfil` no tiene pestanas hoy y la vista global nace huerfana: en el Tramo 5 nace `/cuenta/equipo` y ahi `/cuenta/actividad` cae en su lugar. El spec §6 la pedia aqui.
- **Papelera por modulo para colaboradores.** Restaurar es de duenos y admins, porque Actividad vive en Configuracion. Si un colaborador con `total` pide deshacer lo suyo, es un tramo aparte (era la Opcion C del chat del 5-sep).
- **Restaurar una boda borrada.** `event_audit_log.event_id -> events(id)` es ON DELETE CASCADE: al borrar la boda se va su bitacora. Por eso no hay disparador sobre `events`. Decision del spec, confirmada.
- **Los lotes de mas de 200.** `bulkDelete` parte en tandas de 200, asi que borrar 500 invitados produce tres batch_id y tres renglones. Arreglarlo es tocar la pantalla de Invitados.
- **`conversations` y `messages`** del nucleo omnicanal siguen sin disparador ni policies leidas. Ver [[mensajes-inbox-sin-policies-leidas]].

## Orden de salida a produccion — objetivo: PROBAR EN PRODUCCION EL 6-sep

Este tramo es **prioridad 1** y va desacoplado del Tramo 3: no espera a `feat/accesos-cierre`.

1. Tasks 1-6 en `feat/accesos-actividad`, cortada de `main`.
2. `npx tsc --noEmit` y `npm test` verdes despues de cada task.
3. **Avisar a Diego antes de `npm run build`** — el dev server tiene que estar abajo.
4. Diego prueba en local con la lista de verificacion de la Task 5.
5. Merge a `main` -> Vercel despliega solo.
6. **Diego ya puede probar en produccion aqui mismo, sin correr SQL**, porque pasa `is_platform_admin()` y la policy vieja lo deja leer todo. Esta es la meta del dia.
7. Diego corre `2026-09-07-actividad-lectura.sql` cuando quiera.
8. Ultima verificacion: con sesion de un dueno que **no** sea Diego, la pantalla ya trae datos. Antes del paso 7 esa sesion la ve vacia, y es lo esperado.

**El camino critico del dia son las Tasks 1-5.** La 6 se escribe pero no bloquea nada: el SQL solo hace falta para que la vean los demas duenos, no para probarla.
