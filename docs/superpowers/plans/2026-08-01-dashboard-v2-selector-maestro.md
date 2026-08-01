# Dashboard v2: selector maestro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/dashboard` en una pantalla que apunta a un contexto —un evento a fondo, o la cartera completa— elegido desde un selector maestro en el encabezado.

**Architecture:** Toda la derivación de números vive en funciones puras bajo `lib/dashboard/` con tests de Vitest. La capa de I/O (`lib/dashboard/load.ts`) hace las consultas a Supabase y devuelve filas crudas; nada de lógica ahí. `app/dashboard/page.tsx` queda como orquestador delgado: carga, guarda el contexto en estado, y delega el render a `ContextoEvento` o `ContextoCartera`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase (browser client), Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-01-dashboard-v2-design.md`
**Fuente visual de verdad:** `docs/superpowers/specs/2026-08-01-dashboard-v2-mockup.html` — **ábrelo en el navegador antes de empezar cualquier tarea de UI.** Cada tarea de UI apunta a una sección de ese archivo.

## Global Constraints

- **Ningún cambio en Supabase.** Sin tablas, sin columnas, sin vistas, sin RPC. Todo se deriva de lo que ya existe.
- **Tabla de tareas:** `event_timeline_tasks`. **`timeline_tasks` no existe en la base** — verificado contra el schema el 1 de agosto de 2026. El dashboard actual la consulta de todas formas, Supabase devuelve error, y el código lo entierra con `(remindersRes.data || [])`: la campana de recordatorios siempre sale vacía y `pendingReminders` siempre es cero. Este plan lo corrige.
- **Columnas verificadas contra el schema** el 1 de agosto de 2026: las 28 que este plan lee existen. `event_timeline_tasks.task_date` es `date NOT NULL` y `reminder_date` es `timestamptz NULL`.
- **Una sola llamada a `supabase.auth.getUser()`** para toda la pantalla. Cada llamada toma un candado global exclusivo en el cliente y varias en paralelo se encolan hasta agotar el timeout de 5 s en redes lentas. El comentario que documenta esto ya está en `app/dashboard/page.tsx` — conservarlo.
- **Solo Tailwind.** Sin estilos inline salvo el `width` de las barras de progreso y los `background` de tramos calculados.
- **Sin emojis.** Iconos de Lucide React exclusivamente.
- **UI en español CON acentos.** Mensajes de commit sin acentos y sin ñ.
- **Commits convencionales:** `feat:`, `fix:`, `refactor:`, `test:`, `docs:`.
- **Código completo:** cada archivo que se toque se escribe entero, nunca por fragmentos.
- **Montos:** siempre con `formatCurrency(amount, currency)` de `@/lib/types`. Nunca concatenar `$` a mano.
- **Fechas de evento:** siempre con `formatEventDate(start, end)` de `@/lib/types`.
- **Hero claro.** El hero oscuro fue descartado. El negro `#1D1E20` solo aparece en el chip del selector cuando el contexto es la cartera.
- **Paleta:** teal `#48C9B0` / `#1A9E88` para CTAs y positivo, dorado `#D4A853` para regalos y dinero recibido, `#2A7A50` ok, `#B8860B` aviso, `#CC3333` alerta. Ningún otro tono nuevo.
- **Permisos:** el `viewer` no ve tarjetas de dinero (presupuesto, proveedores, por pagar) ni urgencias de pago.
- **Tests:** Vitest solo para lógica pura (`npm test`). La UI se verifica manual en local → preview → main.
- **Nada de fechas comprometidas de pago.** No existe el dato. Ver decisión 4 del spec.

---

## File Structure

**Crear:**

| Archivo | Responsabilidad |
|---|---|
| `lib/dashboard/types.ts` | Tipos de filas crudas, métricas y contexto. Sin lógica. |
| `lib/dashboard/metrics.ts` | `computeEventMetrics` — de filas crudas a métricas de un evento. Puro. |
| `lib/dashboard/metrics.test.ts` | Tests de `computeEventMetrics`. |
| `lib/dashboard/salud.ts` | `computeSalud` y `computeChipDeuda` — semáforos. Puro. |
| `lib/dashboard/salud.test.ts` | Tests de semáforos. |
| `lib/dashboard/urgencias.ts` | `buildUrgencias` — ranking de lo que requiere atención. Puro. |
| `lib/dashboard/urgencias.test.ts` | Tests de ranking. |
| `lib/dashboard/load.ts` | Consultas a Supabase. Solo I/O, cero lógica. |
| `app/dashboard/EventSelector.tsx` | Selector maestro: botón, dropdown, buscador, filas con salud. |
| `app/dashboard/ContextoEvento.tsx` | Vista de un evento: hero, KPIs, feed, dos columnas. |
| `app/dashboard/ContextoCartera.tsx` | Vista de cartera: globales, feed transversal, tabs, tarjetas. |
| `app/dashboard/FeedAtencion.tsx` | Feed accionable, compartido por los dos contextos. |

**Modificar:**

| Archivo | Cambio |
|---|---|
| `app/dashboard/page.tsx` | Se reduce a orquestador: carga, estado de contexto, header, delegación. |

**No se toca:** `app/events/[id]/**`, `proxy.ts`, `lib/types.ts`, ninguna ruta, ningún nav.

---

### Task 1: Tipos y métricas por evento

**Files:**
- Create: `lib/dashboard/types.ts`
- Create: `lib/dashboard/metrics.ts`
- Test: `lib/dashboard/metrics.test.ts`

**Interfaces:**
- Consumes: `Currency`, `EventStatus`, `RsvpStatus`, `CollaboratorRole` de `@/lib/types`; `estadoPublicacion` de `@/lib/invite/publicacion`.
- Produces: todos los tipos de `types.ts`, y `computeEventMetrics(input: MetricsInput): EventMetrics`.

- [ ] **Step 1: Escribe `lib/dashboard/types.ts` completo**

```ts
import type { Currency, EventStatus, RsvpStatus, CollaboratorRole } from '@/lib/types'
import type { EstadoPublicacion } from '@/lib/invite/publicacion'

export type Contexto = { kind: 'cartera' } | { kind: 'evento'; eventId: string }

export type Tono = 'ok' | 'aviso' | 'alerta' | 'vacio'

export type EventoRow = {
  id: string
  name: string
  event_date: string | null
  event_end_date: string | null
  event_time: string | null
  event_type: string | null
  event_status: EventStatus
  venue: string | null
  total_guests: number
  currency: Currency
  guest_cap: number | null
  is_shared: boolean
  shared_role: CollaboratorRole | null
  owner_name: string | null
}

export type GuestRow = {
  event_id: string
  rsvp_status: RsvpStatus
  party_size: number | null
  needs_attention: boolean | null
}

export type MemberRow = { event_id: string; rsvp_status: RsvpStatus }
export type BudgetRow = { event_id: string; budget_amount: number | null }

export type SupplierRow = {
  id: string
  event_id: string
  status: string
  contract_amount: number | null
  supplier_name: string | null
}

export type PaymentRow = { event_supplier_id: string; amount: number | null }

export type TaskRow = {
  id: string
  event_id: string
  title: string
  category: string
  task_date: string | null
  is_completed: boolean | null
  priority: string | null
  assigned_to_name: string | null
}

export type GiftItemRow = { event_id: string }
export type ReservationRow = { event_id: string; amount: number | null; purchased: boolean | null }
export type TableRow = { id: string; event_id: string; capacity: number | null }
export type SeatRow = { event_id: string; table_id: string; guest_id: string | null; party_size: number | null }
export type SettingsRow = { event_id: string; invite_draft: unknown; invite_config: unknown }

export type Invitados = {
  total: number
  confirmados: number
  pendientes: number
  declinados: number
  pctConfirmado: number
  atencion: number
}

export type Dinero = {
  estimado: number
  contratado: number
  pagado: number
  porPagar: number
  sinContratar: number
  excedido: boolean
  pctContratado: number
}

export type Proveedores = {
  total: number
  contratados: number
  cotizados: number
  nuevos: number
}

export type Tareas = {
  vencidas: number
  hoy: number
  proximas: number
  bloqueantesVencidas: number
}

export type Regalos = { recibido: number; apartados: number; totalItems: number }

export type Mesas = {
  mesas: number
  conGente: number
  conLugar: number
  sinLugar: number
  sillasLibres: number
}

export type EventMetrics = {
  event: EventoRow
  invitados: Invitados
  dinero: Dinero
  proveedores: Proveedores
  tareas: Tareas
  regalos: Regalos
  mesas: Mesas
  invitacion: EstadoPublicacion
  proximaTarea: TaskRow | null
  proveedorConSaldo: { nombre: string; contratado: number; pagado: number; porPagar: number } | null
}

export type MetricsInput = {
  event: EventoRow
  guests: GuestRow[]
  members: MemberRow[]
  budgets: BudgetRow[]
  suppliers: SupplierRow[]
  payments: PaymentRow[]
  tasks: TaskRow[]
  giftItems: GiftItemRow[]
  reservations: ReservationRow[]
  tables: TableRow[]
  seats: SeatRow[]
  settings: SettingsRow | null
  hoy: Date
}
```

- [ ] **Step 2: Escribe el test que falla**

Crea `lib/dashboard/metrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeEventMetrics } from './metrics'
import type { EventoRow, MetricsInput } from './types'

const evento: EventoRow = {
  id: 'e1', name: 'Ana y Rodrigo',
  event_date: '2026-11-14', event_end_date: null, event_time: '17:00',
  event_type: 'boda', event_status: 'active', venue: 'Hacienda San Gabriel',
  total_guests: 240, currency: 'MXN', guest_cap: 240,
  is_shared: false, shared_role: null, owner_name: null,
}

function base(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    event: evento,
    guests: [], members: [], budgets: [], suppliers: [], payments: [],
    tasks: [], giftItems: [], reservations: [], tables: [], seats: [],
    settings: null, hoy: new Date(2026, 7, 1),
    ...over,
  }
}

describe('invitados', () => {
  it('suma invitados y acompanantes en un solo conteo', () => {
    const m = computeEventMetrics(base({
      guests: [
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 2, needs_attention: false },
        { event_id: 'e1', rsvp_status: 'pending',   party_size: 1, needs_attention: false },
      ],
      members: [{ event_id: 'e1', rsvp_status: 'confirmed' }],
    }))
    expect(m.invitados.total).toBe(3)
    expect(m.invitados.confirmados).toBe(2)
    expect(m.invitados.pendientes).toBe(1)
    expect(m.invitados.pctConfirmado).toBe(67)
  })

  it('cuenta los que requieren atencion', () => {
    const m = computeEventMetrics(base({
      guests: [
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 1, needs_attention: true },
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 1, needs_attention: null },
      ],
    }))
    expect(m.invitados.atencion).toBe(1)
  })

  it('sin invitados el porcentaje es 0, no NaN', () => {
    expect(computeEventMetrics(base()).invitados.pctConfirmado).toBe(0)
  })
})

describe('dinero', () => {
  it('solo los proveedores contratados cuentan como contratado', () => {
    const m = computeEventMetrics(base({
      budgets: [{ event_id: 'e1', budget_amount: 100000 }],
      suppliers: [
        { id: 's1', event_id: 'e1', status: 'contratado', contract_amount: 60000, supplier_name: 'Banquete' },
        { id: 's2', event_id: 'e1', status: 'cotizado',   contract_amount: 30000, supplier_name: 'DJ' },
      ],
      payments: [{ event_supplier_id: 's1', amount: 20000 }],
    }))
    expect(m.dinero.estimado).toBe(100000)
    expect(m.dinero.contratado).toBe(60000)
    expect(m.dinero.pagado).toBe(20000)
    expect(m.dinero.porPagar).toBe(40000)
    expect(m.dinero.sinContratar).toBe(40000)
    expect(m.dinero.excedido).toBe(false)
  })

  it('marca excedido cuando lo contratado pasa lo estimado', () => {
    const m = computeEventMetrics(base({
      budgets: [{ event_id: 'e1', budget_amount: 50000 }],
      suppliers: [{ id: 's1', event_id: 'e1', status: 'contratado', contract_amount: 70000, supplier_name: 'X' }],
    }))
    expect(m.dinero.excedido).toBe(true)
    expect(m.dinero.sinContratar).toBe(0)
  })

  it('un pago de proveedor descartado no cuenta', () => {
    const m = computeEventMetrics(base({
      suppliers: [{ id: 's9', event_id: 'e1', status: 'descartado', contract_amount: 10000, supplier_name: 'X' }],
      payments: [{ event_supplier_id: 's9', amount: 5000 }],
    }))
    expect(m.dinero.contratado).toBe(0)
    expect(m.dinero.pagado).toBe(0)
  })

  it('expone el proveedor con mayor saldo pendiente', () => {
    const m = computeEventMetrics(base({
      suppliers: [
        { id: 's1', event_id: 'e1', status: 'contratado', contract_amount: 420000, supplier_name: 'Banquete Aurora' },
        { id: 's2', event_id: 'e1', status: 'contratado', contract_amount: 90000,  supplier_name: 'DJ' },
      ],
      payments: [{ event_supplier_id: 's1', amount: 272000 }],
    }))
    expect(m.proveedorConSaldo?.nombre).toBe('Banquete Aurora')
    expect(m.proveedorConSaldo?.porPagar).toBe(148000)
  })
})

describe('tareas', () => {
  const hoy = new Date(2026, 7, 1)
  it('clasifica vencidas, hoy y proximas contra la fecha dada', () => {
    const m = computeEventMetrics(base({
      hoy,
      tasks: [
        { id: 't1', event_id: 'e1', title: 'A', category: 'pago',  task_date: '2026-07-29', is_completed: false, priority: 'bloqueante',    assigned_to_name: null },
        { id: 't2', event_id: 'e1', title: 'B', category: 'tarea', task_date: '2026-07-31', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null },
        { id: 't3', event_id: 'e1', title: 'C', category: 'tarea', task_date: '2026-08-01', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null },
        { id: 't4', event_id: 'e1', title: 'D', category: 'tarea', task_date: '2026-08-05', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null },
      ],
    }))
    expect(m.tareas.vencidas).toBe(2)
    expect(m.tareas.hoy).toBe(1)
    expect(m.tareas.proximas).toBe(1)
    expect(m.tareas.bloqueantesVencidas).toBe(1)
  })

  it('ignora las completadas y las sin fecha', () => {
    const m = computeEventMetrics(base({
      hoy,
      tasks: [
        { id: 't1', event_id: 'e1', title: 'A', category: 'tarea', task_date: '2026-07-01', is_completed: true,  priority: null, assigned_to_name: null },
        { id: 't2', event_id: 'e1', title: 'B', category: 'tarea', task_date: null,         is_completed: false, priority: null, assigned_to_name: null },
      ],
    }))
    expect(m.tareas.vencidas).toBe(0)
    expect(m.tareas.proximas).toBe(0)
  })
})

describe('mesas', () => {
  it('los confirmados sin asiento quedan como sin lugar', () => {
    const m = computeEventMetrics(base({
      guests: [
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 3, needs_attention: false },
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 2, needs_attention: false },
      ],
      tables: [{ id: 'm1', event_id: 'e1', capacity: 10 }],
      seats: [{ event_id: 'e1', table_id: 'm1', guest_id: 'g1', party_size: 3 }],
    }))
    expect(m.mesas.mesas).toBe(1)
    expect(m.mesas.conGente).toBe(1)
    expect(m.mesas.conLugar).toBe(3)
    expect(m.mesas.sinLugar).toBe(2)
    expect(m.mesas.sillasLibres).toBe(7)
  })

  it('dos asientos en la misma mesa cuentan una sola mesa con gente', () => {
    const m = computeEventMetrics(base({
      tables: [{ id: 'm1', event_id: 'e1', capacity: 10 }, { id: 'm2', event_id: 'e1', capacity: 10 }],
      seats: [
        { event_id: 'e1', table_id: 'm1', guest_id: 'g1', party_size: 2 },
        { event_id: 'e1', table_id: 'm1', guest_id: 'g2', party_size: 1 },
      ],
    }))
    expect(m.mesas.mesas).toBe(2)
    expect(m.mesas.conGente).toBe(1)
    expect(m.mesas.conLugar).toBe(3)
  })

  it('un asiento vacio no ocupa lugar ni marca la mesa como ocupada', () => {
    const m = computeEventMetrics(base({
      tables: [{ id: 'm1', event_id: 'e1', capacity: 8 }],
      seats: [{ event_id: 'e1', table_id: 'm1', guest_id: null, party_size: null }],
    }))
    expect(m.mesas.conGente).toBe(0)
    expect(m.mesas.conLugar).toBe(0)
    expect(m.mesas.sillasLibres).toBe(8)
  })
})

describe('regalos', () => {
  it('suma solo los aportes con monto', () => {
    const m = computeEventMetrics(base({
      giftItems: [{ event_id: 'e1' }, { event_id: 'e1' }, { event_id: 'e1' }],
      reservations: [
        { event_id: 'e1', amount: 2500, purchased: true },
        { event_id: 'e1', amount: null, purchased: false },
      ],
    }))
    expect(m.regalos.recibido).toBe(2500)
    expect(m.regalos.apartados).toBe(2)
    expect(m.regalos.totalItems).toBe(3)
  })
})

describe('invitacion', () => {
  it('sin settings se lee como borrador', () => {
    expect(computeEventMetrics(base()).invitacion).toBe('borrador')
  })
})
```

- [ ] **Step 3: Corre el test y verifica que falla**

Run: `npm test -- lib/dashboard/metrics.test.ts`
Expected: FAIL — no existe el módulo `./metrics`.

- [ ] **Step 4: Escribe `lib/dashboard/metrics.ts` completo**

```ts
import { estadoPublicacion } from '@/lib/invite/publicacion'
import type {
  Dinero, EventMetrics, Invitados, Mesas, MetricsInput,
  Proveedores, Regalos, Tareas, TaskRow,
} from './types'

function num(v: number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

// Un dia natural sin hora, para comparar fechas de tarea contra hoy sin que la
// hora local mueva el resultado.
function dia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function diaDeYMD(str: string): number | null {
  const [y, m, d] = str.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

function calcInvitados(input: MetricsInput): Invitados {
  const estados = [
    ...input.guests.map(g => g.rsvp_status),
    ...input.members.map(m => m.rsvp_status),
  ]
  const confirmados = estados.filter(s => s === 'confirmed').length
  const total = estados.length
  return {
    total,
    confirmados,
    pendientes: estados.filter(s => s === 'pending').length,
    declinados: estados.filter(s => s === 'declined').length,
    pctConfirmado: pct(confirmados, total),
    atencion: input.guests.filter(g => g.needs_attention === true).length,
  }
}

function calcDinero(input: MetricsInput): Dinero {
  const estimado = input.budgets.reduce((s, b) => s + num(b.budget_amount), 0)
  const contratados = input.suppliers.filter(s => s.status === 'contratado')
  const contratado = contratados.reduce((s, p) => s + num(p.contract_amount), 0)
  const idsContratados = new Set(contratados.map(s => s.id))
  const pagado = input.payments
    .filter(p => idsContratados.has(p.event_supplier_id))
    .reduce((s, p) => s + num(p.amount), 0)
  return {
    estimado,
    contratado,
    pagado,
    porPagar: Math.max(0, contratado - pagado),
    sinContratar: Math.max(0, estimado - contratado),
    excedido: estimado > 0 && contratado > estimado,
    pctContratado: pct(contratado, estimado),
  }
}

function calcProveedorConSaldo(input: MetricsInput): EventMetrics['proveedorConSaldo'] {
  const pagadoPorProveedor = new Map<string, number>()
  for (const p of input.payments) {
    pagadoPorProveedor.set(p.event_supplier_id, (pagadoPorProveedor.get(p.event_supplier_id) ?? 0) + num(p.amount))
  }
  const conSaldo = input.suppliers
    .filter(s => s.status === 'contratado')
    .map(s => {
      const contratado = num(s.contract_amount)
      const pagado = pagadoPorProveedor.get(s.id) ?? 0
      return { nombre: s.supplier_name ?? 'Proveedor', contratado, pagado, porPagar: Math.max(0, contratado - pagado) }
    })
    .filter(s => s.porPagar > 0)
    .sort((a, b) => b.porPagar - a.porPagar)
  return conSaldo[0] ?? null
}

function calcProveedores(input: MetricsInput): Proveedores {
  const vivos = input.suppliers.filter(s => s.status !== 'descartado')
  return {
    total: vivos.length,
    contratados: vivos.filter(s => s.status === 'contratado').length,
    cotizados: vivos.filter(s => s.status === 'cotizado').length,
    nuevos: vivos.filter(s => s.status === 'nuevo').length,
  }
}

function tareasVivas(input: MetricsInput): TaskRow[] {
  return input.tasks.filter(t => t.is_completed !== true && !!t.task_date)
}

function calcTareas(input: MetricsInput): Tareas {
  const hoyMs = dia(input.hoy)
  const vivas = tareasVivas(input)
  let vencidas = 0, hoy = 0, proximas = 0, bloqueantesVencidas = 0
  for (const t of vivas) {
    const ms = diaDeYMD(t.task_date as string)
    if (ms === null) continue
    if (ms < hoyMs) {
      vencidas++
      if (t.priority === 'bloqueante') bloqueantesVencidas++
    } else if (ms === hoyMs) hoy++
    else proximas++
  }
  return { vencidas, hoy, proximas, bloqueantesVencidas }
}

// La tarea que el dashboard destaca: la mas atrasada; si no hay atrasadas, la
// mas proxima. Las bloqueantes ganan a igualdad de fecha.
function calcProximaTarea(input: MetricsInput): TaskRow | null {
  const vivas = tareasVivas(input)
    .map(t => ({ t, ms: diaDeYMD(t.task_date as string) }))
    .filter((x): x is { t: TaskRow; ms: number } => x.ms !== null)
    .sort((a, b) => a.ms - b.ms || Number(b.t.priority === 'bloqueante') - Number(a.t.priority === 'bloqueante'))
  return vivas[0]?.t ?? null
}

function calcRegalos(input: MetricsInput): Regalos {
  return {
    recibido: input.reservations.reduce((s, r) => s + num(r.amount), 0),
    apartados: input.reservations.length,
    totalItems: input.giftItems.length,
  }
}

function calcMesas(input: MetricsInput): Mesas {
  const capacidad = input.tables.reduce((s, t) => s + num(t.capacity), 0)
  const ocupados = input.seats.filter(s => !!s.guest_id)
  const conLugar = ocupados.reduce((s, seat) => s + Math.max(1, num(seat.party_size)), 0)
  const confirmadosPorCabeza = input.guests
    .filter(g => g.rsvp_status === 'confirmed')
    .reduce((s, g) => s + Math.max(1, num(g.party_size)), 0)
  return {
    mesas: input.tables.length,
    conGente: new Set(ocupados.map(s => s.table_id)).size,
    conLugar,
    sinLugar: Math.max(0, confirmadosPorCabeza - conLugar),
    sillasLibres: Math.max(0, capacidad - conLugar),
  }
}

export function computeEventMetrics(input: MetricsInput): EventMetrics {
  return {
    event: input.event,
    invitados: calcInvitados(input),
    dinero: calcDinero(input),
    proveedores: calcProveedores(input),
    tareas: calcTareas(input),
    regalos: calcRegalos(input),
    mesas: calcMesas(input),
    invitacion: estadoPublicacion(input.settings?.invite_draft, input.settings?.invite_config),
    proximaTarea: calcProximaTarea(input),
    proveedorConSaldo: calcProveedorConSaldo(input),
  }
}
```

- [ ] **Step 5: Corre los tests y verifica que pasan**

Run: `npm test -- lib/dashboard/metrics.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/types.ts lib/dashboard/metrics.ts lib/dashboard/metrics.test.ts
git commit -m "feat(dashboard): metricas puras por evento con tests"
```

---

### Task 2: Semáforos de salud y chip de deuda

**Files:**
- Create: `lib/dashboard/salud.ts`
- Test: `lib/dashboard/salud.test.ts`

**Interfaces:**
- Consumes: `EventMetrics`, `Tono` de `./types`.
- Produces: `computeSalud(m: EventMetrics): SaludBarras` y `computeChipDeuda(m: EventMetrics): ChipDeuda`.

Estos son los datos que alimentan las cuatro barras y el chip de cada fila del selector.

- [ ] **Step 1: Escribe el test que falla**

Crea `lib/dashboard/salud.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeSalud, computeChipDeuda } from './salud'
import type { EventMetrics } from './types'

function m(over: Record<string, unknown> = {}): EventMetrics {
  return {
    event: {
      id: 'e1', name: 'X', event_date: '2026-11-14', event_end_date: null, event_time: null,
      event_type: 'boda', event_status: 'active', venue: null, total_guests: 0,
      currency: 'MXN', guest_cap: null, is_shared: false, shared_role: null, owner_name: null,
    },
    invitados: { total: 0, confirmados: 0, pendientes: 0, declinados: 0, pctConfirmado: 0, atencion: 0 },
    dinero: { estimado: 0, contratado: 0, pagado: 0, porPagar: 0, sinContratar: 0, excedido: false, pctContratado: 0 },
    proveedores: { total: 0, contratados: 0, cotizados: 0, nuevos: 0 },
    tareas: { vencidas: 0, hoy: 0, proximas: 0, bloqueantesVencidas: 0 },
    regalos: { recibido: 0, apartados: 0, totalItems: 0 },
    mesas: { mesas: 0, conGente: 0, conLugar: 0, sinLugar: 0, sillasLibres: 0 },
    invitacion: 'publicada',
    proximaTarea: null,
    proveedorConSaldo: null,
    ...over,
  } as EventMetrics
}

describe('computeSalud', () => {
  it('sin datos cada barra queda vacia', () => {
    const s = computeSalud(m())
    expect([s.invitados, s.dinero, s.logistica, s.tareas]).toEqual(['vacio', 'vacio', 'vacio', 'vacio'])
  })

  it('invitados: 70 por ciento o mas es ok, 40 a 69 aviso, menos alerta', () => {
    expect(computeSalud(m({ invitados: { total: 10, confirmados: 7, pendientes: 3, declinados: 0, pctConfirmado: 70, atencion: 0 } })).invitados).toBe('ok')
    expect(computeSalud(m({ invitados: { total: 10, confirmados: 5, pendientes: 5, declinados: 0, pctConfirmado: 50, atencion: 0 } })).invitados).toBe('aviso')
    expect(computeSalud(m({ invitados: { total: 10, confirmados: 2, pendientes: 8, declinados: 0, pctConfirmado: 20, atencion: 0 } })).invitados).toBe('alerta')
  })

  it('dinero: excedido es alerta', () => {
    expect(computeSalud(m({ dinero: { estimado: 100, contratado: 120, pagado: 0, porPagar: 120, sinContratar: 0, excedido: true, pctContratado: 120 } })).dinero).toBe('alerta')
  })

  it('dinero: arriba de 90 por ciento contratado es aviso', () => {
    expect(computeSalud(m({ dinero: { estimado: 100, contratado: 95, pagado: 0, porPagar: 95, sinContratar: 5, excedido: false, pctContratado: 95 } })).dinero).toBe('aviso')
  })

  it('tareas: una vencida es alerta, una de hoy es aviso', () => {
    expect(computeSalud(m({ tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 0 } })).tareas).toBe('alerta')
    expect(computeSalud(m({ tareas: { vencidas: 0, hoy: 1, proximas: 0, bloqueantesVencidas: 0 } })).tareas).toBe('aviso')
    expect(computeSalud(m({ tareas: { vencidas: 0, hoy: 0, proximas: 3, bloqueantesVencidas: 0 } })).tareas).toBe('ok')
  })

  it('logistica: 25 por ciento o mas de confirmados sin lugar es alerta', () => {
    const base = { mesas: 4, conGente: 3, conLugar: 30, sinLugar: 10, sillasLibres: 5 }
    expect(computeSalud(m({ mesas: base })).logistica).toBe('alerta')
    expect(computeSalud(m({ mesas: { ...base, sinLugar: 4 } })).logistica).toBe('aviso')
    expect(computeSalud(m({ mesas: { ...base, sinLugar: 0 } })).logistica).toBe('ok')
  })
})

describe('computeChipDeuda', () => {
  it('las vencidas ganan a todo', () => {
    const c = computeChipDeuda(m({ tareas: { vencidas: 3, hoy: 2, proximas: 0, bloqueantesVencidas: 1 }, invitacion: 'borrador' }))
    expect(c).toEqual({ tono: 'alerta', texto: '3' })
  })

  it('sin vencidas, las de hoy', () => {
    expect(computeChipDeuda(m({ tareas: { vencidas: 0, hoy: 1, proximas: 0, bloqueantesVencidas: 0 } }))).toEqual({ tono: 'aviso', texto: '1' })
  })

  it('sin tareas urgentes pero en borrador, avisa del borrador', () => {
    expect(computeChipDeuda(m({ invitacion: 'borrador' }))).toEqual({ tono: 'vacio', texto: 'Borrador' })
  })

  it('todo limpio dice OK', () => {
    expect(computeChipDeuda(m())).toEqual({ tono: 'ok', texto: 'OK' })
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npm test -- lib/dashboard/salud.test.ts`
Expected: FAIL — no existe `./salud`.

- [ ] **Step 3: Escribe `lib/dashboard/salud.ts` completo**

```ts
import type { EventMetrics, Tono } from './types'

export type SaludBarras = {
  invitados: Tono
  dinero: Tono
  logistica: Tono
  tareas: Tono
}

export type ChipDeuda = { tono: Tono; texto: string }

// Orden fijo de las barras en la UI: invitados, dinero, logistica, tareas.
// No reordenar: la lectura de un vistazo depende de que la posicion sea estable.
export const ORDEN_BARRAS = ['invitados', 'dinero', 'logistica', 'tareas'] as const

function saludInvitados(m: EventMetrics): Tono {
  if (m.invitados.total === 0) return 'vacio'
  if (m.invitados.pctConfirmado >= 70) return 'ok'
  if (m.invitados.pctConfirmado >= 40) return 'aviso'
  return 'alerta'
}

function saludDinero(m: EventMetrics): Tono {
  if (m.dinero.estimado === 0 && m.dinero.contratado === 0) return 'vacio'
  if (m.dinero.excedido) return 'alerta'
  if (m.dinero.pctContratado > 90) return 'aviso'
  return 'ok'
}

function saludLogistica(m: EventMetrics): Tono {
  if (m.mesas.mesas === 0) return 'vacio'
  const cabezas = m.mesas.conLugar + m.mesas.sinLugar
  if (cabezas === 0) return 'vacio'
  const pctSinLugar = (m.mesas.sinLugar / cabezas) * 100
  if (pctSinLugar >= 25) return 'alerta'
  if (pctSinLugar > 0) return 'aviso'
  return 'ok'
}

function saludTareas(m: EventMetrics): Tono {
  const { vencidas, hoy, proximas } = m.tareas
  if (vencidas === 0 && hoy === 0 && proximas === 0) return 'vacio'
  if (vencidas > 0) return 'alerta'
  if (hoy > 0) return 'aviso'
  return 'ok'
}

export function computeSalud(m: EventMetrics): SaludBarras {
  return {
    invitados: saludInvitados(m),
    dinero: saludDinero(m),
    logistica: saludLogistica(m),
    tareas: saludTareas(m),
  }
}

export function computeChipDeuda(m: EventMetrics): ChipDeuda {
  if (m.tareas.vencidas > 0) return { tono: 'alerta', texto: String(m.tareas.vencidas) }
  if (m.tareas.hoy > 0) return { tono: 'aviso', texto: String(m.tareas.hoy) }
  if (m.invitacion === 'borrador') return { tono: 'vacio', texto: 'Borrador' }
  if (m.invitacion === 'cambios') return { tono: 'aviso', texto: 'Sin publicar' }
  return { tono: 'ok', texto: 'OK' }
}
```

- [ ] **Step 4: Corre los tests y verifica que pasan**

Run: `npm test -- lib/dashboard/salud.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/salud.ts lib/dashboard/salud.test.ts
git commit -m "feat(dashboard): semaforos de salud y chip de deuda por evento"
```

---

### Task 3: Urgencias ordenadas

**Files:**
- Create: `lib/dashboard/urgencias.ts`
- Test: `lib/dashboard/urgencias.test.ts`

**Interfaces:**
- Consumes: `EventMetrics` de `./types`.
- Produces: `type Urgencia`, `type AccionUrgencia`, `buildUrgencias(metrics: EventMetrics[], opts: { puedeVerDinero: boolean }): Urgencia[]`.

Alimenta el feed "Requiere tu atención" en los dos contextos. En el contexto evento se le pasa un solo `EventMetrics`; en cartera, todos.

- [ ] **Step 1: Escribe el test que falla**

Crea `lib/dashboard/urgencias.test.ts`. Reutiliza el helper `m()` copiándolo de `salud.test.ts` — es un helper de prueba, duplicarlo entre archivos de test es correcto y evita acoplarlos.

```ts
import { describe, it, expect } from 'vitest'
import { buildUrgencias } from './urgencias'
import type { EventMetrics } from './types'

function m(id: string, nombre: string, over: Record<string, unknown> = {}): EventMetrics {
  return {
    event: {
      id, name: nombre, event_date: '2026-11-14', event_end_date: null, event_time: null,
      event_type: 'boda', event_status: 'active', venue: null, total_guests: 0,
      currency: 'MXN', guest_cap: null, is_shared: false, shared_role: null, owner_name: null,
    },
    invitados: { total: 0, confirmados: 0, pendientes: 0, declinados: 0, pctConfirmado: 0, atencion: 0 },
    dinero: { estimado: 0, contratado: 0, pagado: 0, porPagar: 0, sinContratar: 0, excedido: false, pctContratado: 0 },
    proveedores: { total: 0, contratados: 0, cotizados: 0, nuevos: 0 },
    tareas: { vencidas: 0, hoy: 0, proximas: 0, bloqueantesVencidas: 0 },
    regalos: { recibido: 0, apartados: 0, totalItems: 0 },
    mesas: { mesas: 0, conGente: 0, conLugar: 0, sinLugar: 0, sillasLibres: 0 },
    invitacion: 'publicada',
    proximaTarea: null,
    proveedorConSaldo: null,
    ...over,
  } as EventMetrics
}

const verDinero = { puedeVerDinero: true }

describe('buildUrgencias', () => {
  it('sin problemas devuelve lista vacia', () => {
    expect(buildUrgencias([m('e1', 'X')], verDinero)).toEqual([])
  })

  it('una tarea vencida bloqueante va antes que una vencida normal', () => {
    const u = buildUrgencias([
      m('e1', 'Uno', { tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 0 },
        proximaTarea: { id: 't1', event_id: 'e1', title: 'Normal', category: 'tarea', task_date: '2026-07-20', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null } }),
      m('e2', 'Dos', { tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 1 },
        proximaTarea: { id: 't2', event_id: 'e2', title: 'Bloqueante', category: 'pago', task_date: '2026-07-25', is_completed: false, priority: 'bloqueante', assigned_to_name: null } }),
    ], verDinero)
    expect(u[0].titulo).toContain('Bloqueante')
    expect(u[0].tipo).toBe('tarea_bloqueante')
  })

  it('el presupuesto excedido aparece con el nombre del evento', () => {
    const u = buildUrgencias([m('e1', 'Congreso', {
      dinero: { estimado: 1400000, contratado: 1512000, pagado: 0, porPagar: 1512000, sinContratar: 0, excedido: true, pctContratado: 108 },
    })], verDinero)
    const excedido = u.find(x => x.tipo === 'presupuesto_excedido')
    expect(excedido?.eventName).toBe('Congreso')
    expect(excedido?.tono).toBe('alerta')
  })

  it('el viewer no ve urgencias de dinero', () => {
    const metrics = [m('e1', 'X', {
      dinero: { estimado: 100, contratado: 200, pagado: 0, porPagar: 200, sinContratar: 0, excedido: true, pctContratado: 200 },
      proveedorConSaldo: { nombre: 'Banquete', contratado: 200, pagado: 0, porPagar: 200 },
    })]
    expect(buildUrgencias(metrics, { puedeVerDinero: false })).toEqual([])
    expect(buildUrgencias(metrics, verDinero).length).toBeGreaterThan(0)
  })

  it('los invitados que requieren atencion generan una urgencia', () => {
    const u = buildUrgencias([m('e1', 'X', {
      invitados: { total: 10, confirmados: 8, pendientes: 2, declinados: 0, pctConfirmado: 80, atencion: 3 },
    })], verDinero)
    const at = u.find(x => x.tipo === 'invitados_atencion')
    expect(at?.titulo).toContain('3')
  })

  it('la invitacion en borrador es la urgencia mas debil', () => {
    const u = buildUrgencias([m('e1', 'X', {
      invitacion: 'borrador',
      tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 0 },
      proximaTarea: { id: 't1', event_id: 'e1', title: 'A', category: 'tarea', task_date: '2026-07-01', is_completed: false, priority: null, assigned_to_name: null },
    })], verDinero)
    expect(u[u.length - 1].tipo).toBe('invitacion_borrador')
  })

  it('el proveedor con saldo trae la accion de registrar pago', () => {
    const u = buildUrgencias([m('e1', 'X', {
      proveedorConSaldo: { nombre: 'Banquete Aurora', contratado: 420000, pagado: 272000, porPagar: 148000 },
    })], verDinero)
    const pago = u.find(x => x.tipo === 'proveedor_saldo')
    expect(pago?.accion.label).toBe('Registrar pago')
    expect(pago?.detalle).toContain('Banquete Aurora')
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npm test -- lib/dashboard/urgencias.test.ts`
Expected: FAIL — no existe `./urgencias`.

- [ ] **Step 3: Escribe `lib/dashboard/urgencias.ts` completo**

```ts
import { formatCurrency } from '@/lib/types'
import type { EventMetrics, Tono } from './types'

export type TipoUrgencia =
  | 'tarea_bloqueante'
  | 'tarea_vencida'
  | 'presupuesto_excedido'
  | 'proveedor_saldo'
  | 'invitados_atencion'
  | 'tarea_hoy'
  | 'sin_lugar'
  | 'invitacion_borrador'

export type AccionUrgencia = {
  label: string
  href: string
}

export type Urgencia = {
  id: string
  tipo: TipoUrgencia
  tono: Tono
  titulo: string
  detalle: string
  eventId: string
  eventName: string
  accion: AccionUrgencia
  secundaria?: AccionUrgencia
}

// Menor es mas urgente. El orden es la unica fuente de verdad del ranking:
// no reordenar sin actualizar los tests.
const PESO: Record<TipoUrgencia, number> = {
  tarea_bloqueante: 0,
  tarea_vencida: 1,
  presupuesto_excedido: 2,
  proveedor_saldo: 3,
  invitados_atencion: 4,
  tarea_hoy: 5,
  sin_lugar: 6,
  invitacion_borrador: 7,
}

const TIPOS_DE_DINERO = new Set<TipoUrgencia>(['presupuesto_excedido', 'proveedor_saldo'])

// Se exporta porque la cartera construye las urgencias evento por evento (cada
// uno con su propio permiso de dinero) y necesita reordenar el concatenado.
export function comparaUrgencias(a: Urgencia, b: Urgencia): number {
  return PESO[a.tipo] - PESO[b.tipo]
}

function urgenciasDeEvento(m: EventMetrics): Urgencia[] {
  const out: Urgencia[] = []
  const ev = m.event
  const base = `/events/${ev.id}`

  if (m.tareas.vencidas > 0 && m.proximaTarea) {
    const bloqueante = m.tareas.bloqueantesVencidas > 0
    out.push({
      id: `${ev.id}:tarea:${m.proximaTarea.id}`,
      tipo: bloqueante ? 'tarea_bloqueante' : 'tarea_vencida',
      tono: 'alerta',
      titulo: m.proximaTarea.title,
      detalle: bloqueante
        ? `Vencida y bloqueante${m.tareas.vencidas > 1 ? ` · ${m.tareas.vencidas} vencidas en total` : ''}`
        : `Vencida${m.tareas.vencidas > 1 ? ` · ${m.tareas.vencidas} vencidas en total` : ''}`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver tarea', href: `${base}/timeline?task=${m.proximaTarea.id}` },
    })
  }

  if (m.dinero.excedido) {
    out.push({
      id: `${ev.id}:excedido`,
      tipo: 'presupuesto_excedido',
      tono: 'alerta',
      titulo: `Presupuesto excedido en ${formatCurrency(m.dinero.contratado - m.dinero.estimado, ev.currency)}`,
      detalle: `Contratado ${formatCurrency(m.dinero.contratado, ev.currency)} contra ${formatCurrency(m.dinero.estimado, ev.currency)} estimado`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver presupuesto', href: `${base}/presupuesto` },
    })
  }

  if (m.proveedorConSaldo) {
    const p = m.proveedorConSaldo
    out.push({
      id: `${ev.id}:saldo`,
      tipo: 'proveedor_saldo',
      tono: 'aviso',
      titulo: `${formatCurrency(p.porPagar, ev.currency)} sin pagar`,
      detalle: `${p.nombre} · ${formatCurrency(p.pagado, ev.currency)} pagado de ${formatCurrency(p.contratado, ev.currency)} contratado`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Registrar pago', href: `${base}/pagos` },
    })
  }

  if (m.invitados.atencion > 0) {
    out.push({
      id: `${ev.id}:atencion`,
      tipo: 'invitados_atencion',
      tono: 'alerta',
      titulo: `${m.invitados.atencion} ${m.invitados.atencion === 1 ? 'invitado requiere' : 'invitados requieren'} atención`,
      detalle: 'Detectado por el agente en las conversaciones',
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver invitados', href: `${base}?filtro=atencion` },
    })
  }

  if (m.tareas.vencidas === 0 && m.tareas.hoy > 0 && m.proximaTarea) {
    out.push({
      id: `${ev.id}:hoy:${m.proximaTarea.id}`,
      tipo: 'tarea_hoy',
      tono: 'aviso',
      titulo: m.proximaTarea.title,
      detalle: m.tareas.hoy > 1 ? `Hoy · ${m.tareas.hoy} tareas para hoy` : 'Hoy',
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver tarea', href: `${base}/timeline?task=${m.proximaTarea.id}` },
    })
  }

  if (m.mesas.mesas > 0 && m.mesas.sinLugar > 0) {
    out.push({
      id: `${ev.id}:sinlugar`,
      tipo: 'sin_lugar',
      tono: 'vacio',
      titulo: `${m.mesas.sinLugar} confirmados sin lugar`,
      detalle: `${m.mesas.mesas} mesas creadas · ${m.mesas.sillasLibres} sillas libres`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Asignar mesas', href: `${base}/mesas` },
    })
  }

  if (m.invitacion === 'borrador') {
    out.push({
      id: `${ev.id}:borrador`,
      tipo: 'invitacion_borrador',
      tono: 'vacio',
      titulo: 'La invitación está en borrador',
      detalle: 'Sin publicar: tus invitados todavía no pueden verla',
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Publicar', href: `${base}/invitacion` },
    })
  }

  return out
}

export function buildUrgencias(
  metrics: EventMetrics[],
  opts: { puedeVerDinero: boolean },
): Urgencia[] {
  return metrics
    .flatMap(urgenciasDeEvento)
    .filter(u => opts.puedeVerDinero || !TIPOS_DE_DINERO.has(u.tipo))
    .sort(comparaUrgencias)
}
```

- [ ] **Step 4: Corre los tests y verifica que pasan**

Run: `npm test -- lib/dashboard/urgencias.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Corre toda la suite para verificar que nada se rompió**

Run: `npm test`
Expected: PASS en todo. Si algo de `lib/` falla, es preexistente y no de esta tarea — anótalo y sigue.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/urgencias.ts lib/dashboard/urgencias.test.ts
git commit -m "feat(dashboard): ranking de urgencias con corte por permisos"
```

---

### Task 4: Capa de carga

**Files:**
- Create: `lib/dashboard/load.ts`
- Modify: `app/dashboard/page.tsx` (solo `loadData`; la UI queda intacta en esta tarea)

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; todos los tipos de `./types`; `computeEventMetrics`.
- Produces: `loadDashboard(userId: string): Promise<DashboardData>` donde
  `DashboardData = { metrics: EventMetrics[]; rol: 'planner' | 'anfitrion' | null; colaboradores: ColaboradorRow[] }`.

Esta tarea aísla el riesgo de datos del riesgo de UI: al terminar, el dashboard **se ve igual que hoy** pero ya está alimentado por la capa nueva.

- [ ] **Step 1: Agrega los tipos que faltan a `lib/dashboard/types.ts`**

Añade al final del archivo:

```ts
export type ColaboradorRow = {
  event_id: string
  role: CollaboratorRole
  full_name: string | null
  email: string
}

export type Rol = 'planner' | 'anfitrion' | null

export type DashboardData = {
  metrics: EventMetrics[]
  rol: Rol
  colaboradores: ColaboradorRow[]
}
```

- [ ] **Step 2: Escribe `lib/dashboard/load.ts` completo**

Tres rondas: la primera trae eventos propios, compartidos y el rol; la segunda todo lo acotado por `event_id`; la tercera los pagos, que dependen de los ids de `event_suppliers`.

```ts
import { supabase } from '@/lib/supabase'
import { computeEventMetrics } from './metrics'
import type {
  BudgetRow, ColaboradorRow, DashboardData, EventMetrics, EventoRow, GiftItemRow,
  GuestRow, MemberRow, PaymentRow, ReservationRow, Rol, SeatRow, SettingsRow,
  SupplierRow, TableRow, TaskRow,
} from './types'

const CAMPOS_EVENTO =
  'id, name, event_date, event_end_date, event_time, event_type, event_status, venue, total_guests, currency, guest_cap'

/* eslint-disable @typescript-eslint/no-explicit-any */
function porEvento<T extends { event_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const list = map.get(r.event_id)
    if (list) list.push(r)
    else map.set(r.event_id, [r])
  }
  return map
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const [propios, compartidos, perfil] = await Promise.all([
    supabase.from('events').select(CAMPOS_EVENTO).eq('user_id', userId).order('event_date', { ascending: true }),
    supabase
      .from('event_collaborators')
      .select(`role, event:event_id ( ${CAMPOS_EVENTO}, user_id, owner:user_id ( full_name ) )`)
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase.from('users').select('role').eq('id', userId).single(),
  ])

  const rol = (perfil.data?.role ?? null) as Rol

  const misEventos: EventoRow[] = ((propios.data ?? []) as any[]).map(e => ({
    ...e, is_shared: false, shared_role: null, owner_name: null,
  }))

  const ajenos: EventoRow[] = ((compartidos.data ?? []) as any[])
    .filter(c => !!c.event)
    .map(c => ({
      ...c.event,
      is_shared: true,
      shared_role: c.role,
      owner_name: c.event.owner?.full_name ?? null,
    }))

  const eventos = [...misEventos, ...ajenos]
  const ids = eventos.map(e => e.id)

  if (ids.length === 0) return { metrics: [], rol, colaboradores: [] }

  const [
    guests, members, budgets, suppliers, tasks,
    giftItems, reservations, tables, seats, settings, colaboradores,
  ] = await Promise.all([
    supabase.from('guests').select('event_id, rsvp_status, party_size, needs_attention').in('event_id', ids),
    supabase.from('party_members').select('event_id, rsvp_status').in('event_id', ids),
    supabase.from('event_budgets').select('event_id, budget_amount').in('event_id', ids),
    supabase.from('event_suppliers').select('id, event_id, status, contract_amount, supplier:supplier_id ( name )').in('event_id', ids),
    supabase
      .from('event_timeline_tasks')
      .select('id, event_id, title, category, task_date, is_completed, priority, assigned_to_name')
      .in('event_id', ids)
      .eq('is_completed', false),
    supabase.from('gift_registry_items').select('event_id').in('event_id', ids),
    supabase.from('gift_reservations').select('event_id, amount, purchased').in('event_id', ids),
    supabase.from('tables').select('id, event_id, capacity').in('event_id', ids),
    supabase.from('table_seats').select('event_id, table_id, guest_id, party_size').in('event_id', ids),
    supabase.from('event_settings').select('event_id, invite_draft, invite_config').in('event_id', ids),
    supabase
      .from('event_collaborators')
      .select('event_id, role, email, user:user_id ( full_name )')
      .in('event_id', ids)
      .eq('status', 'active'),
  ])

  const supplierRows: SupplierRow[] = ((suppliers.data ?? []) as any[]).map(s => ({
    id: s.id,
    event_id: s.event_id,
    status: s.status,
    contract_amount: s.contract_amount,
    supplier_name: s.supplier?.name ?? null,
  }))

  const supplierIds = supplierRows.map(s => s.id)
  const pagos = supplierIds.length
    ? await supabase.from('supplier_payments').select('event_supplier_id, amount').in('event_supplier_id', supplierIds)
    : { data: [] as PaymentRow[] }

  const pagosPorProveedor = new Map<string, PaymentRow[]>()
  for (const p of (pagos.data ?? []) as PaymentRow[]) {
    const list = pagosPorProveedor.get(p.event_supplier_id)
    if (list) list.push(p)
    else pagosPorProveedor.set(p.event_supplier_id, [p])
  }

  const gGuests = porEvento((guests.data ?? []) as GuestRow[])
  const gMembers = porEvento((members.data ?? []) as MemberRow[])
  const gBudgets = porEvento((budgets.data ?? []) as BudgetRow[])
  const gSuppliers = porEvento(supplierRows)
  const gTasks = porEvento((tasks.data ?? []) as TaskRow[])
  const gGifts = porEvento((giftItems.data ?? []) as GiftItemRow[])
  const gRes = porEvento((reservations.data ?? []) as ReservationRow[])
  const gTables = porEvento((tables.data ?? []) as TableRow[])
  const gSeats = porEvento((seats.data ?? []) as SeatRow[])
  const gSettings = porEvento((settings.data ?? []) as SettingsRow[])

  const colabRows: ColaboradorRow[] = ((colaboradores.data ?? []) as any[]).map(c => ({
    event_id: c.event_id,
    role: c.role,
    email: c.email,
    full_name: c.user?.full_name ?? null,
  }))

  const hoy = new Date()

  const metrics: EventMetrics[] = eventos.map(event => {
    // No reusar el nombre `propios` de arriba: aqui son los proveedores del evento.
    const proveedoresDelEvento = gSuppliers.get(event.id) ?? []
    return computeEventMetrics({
      event,
      guests: gGuests.get(event.id) ?? [],
      members: gMembers.get(event.id) ?? [],
      budgets: gBudgets.get(event.id) ?? [],
      suppliers: proveedoresDelEvento,
      payments: proveedoresDelEvento.flatMap(s => pagosPorProveedor.get(s.id) ?? []),
      tasks: gTasks.get(event.id) ?? [],
      giftItems: gGifts.get(event.id) ?? [],
      reservations: gRes.get(event.id) ?? [],
      tables: gTables.get(event.id) ?? [],
      seats: gSeats.get(event.id) ?? [],
      settings: (gSettings.get(event.id) ?? [])[0] ?? null,
      hoy,
    })
  })

  return { metrics, rol, colaboradores: colabRows }
}
```

- [ ] **Step 3: Conecta la carga en `app/dashboard/page.tsx` sin cambiar la UI**

Reemplaza el cuerpo de `loadData(user)` por una llamada a `loadDashboard(user.id)` y deriva de `data.metrics` los mismos `EventWithStats` que la UI actual ya consume:

```ts
const loadData = async (user: User) => {
  const data = await loadDashboard(user.id)
  const asStats = (m: EventMetrics): EventWithStats => ({
    ...m.event,
    confirmed: m.invitados.confirmados,
    pending:   m.invitados.pendientes,
    declined:  m.invitados.declinados,
    total:     m.invitados.total,
    pendingReminders: m.tareas.vencidas + m.tareas.hoy,
  })
  setMyEvents(data.metrics.filter(m => !m.event.is_shared).map(asStats))
  setSharedEvents(data.metrics.filter(m => m.event.is_shared).map(asStats))
  setMetrics(data.metrics)
  setRol(data.rol)
  setLoading(false)
}
```

Agrega `const [metrics, setMetrics] = useState<EventMetrics[]>([])` y `const [rol, setRol] = useState<Rol>(null)`. **Conserva** `init()` y su comentario sobre el candado de `getUser()`. El bloque de `reminders` y la campana se dejan como están: se retiran en la tarea 9.

- [ ] **Step 4: Verifica en local que ninguna consulta vuelve vacía por RLS**

Las 15 tablas tienen RLS activo y al menos una política de `select` (verificado el 1 de agosto de 2026). Pero 8 de ellas tienen **una sola** política, y podría estar escrita para un camino público por token en lugar de para el planner autenticado. **Una política que no cubre al usuario no lanza error: devuelve cero filas.** Eso se vería como un dashboard lleno de ceros, sin nada roto a la vista.

Mete esto al final de `loadDashboard`, temporal:

```ts
// TEMPORAL — quitar antes de commitear
console.table(metrics.map(m => ({
  evento: m.event.name,
  invitados: m.invitados.total,
  estimado: m.dinero.estimado,
  contratado: m.dinero.contratado,
  pagado: m.dinero.pagado,
  proveedores: m.proveedores.total,
  tareas: m.tareas.vencidas + m.tareas.hoy + m.tareas.proximas,
  regalos: m.regalos.totalItems,
  mesas: m.mesas.mesas,
  invitacion: m.invitacion,
})))
```

Run: `npm run dev` y abre `http://localhost:3000/dashboard`.

Toma **un evento que sepas que tiene datos de verdad** en presupuesto, proveedores, pagos, tareas, regalos y mesas, y compara renglón por renglón contra lo que ves en sus páginas (`/presupuesto`, `/proveedores`, `/pagos`, `/timeline`, `/mesa-regalos`, `/mesas`).

- Cualquier columna en `0` donde la página sí muestra datos = política de RLS que no cubre al planner. **Anótala y pregunta antes de seguir**: es un cambio en Supabase, no se toca sin instrucción directa.
- La columna `invitacion` debe decir `publicada`, `borrador` o `cambios`, nunca `undefined`.
- El dashboard debe verse **exactamente igual que antes** y sin errores en consola.
- Los recordatorios pasan de cero a un número real. **No es una regresión**: es el bug de `timeline_tasks` arreglándose.

Borra el `console.table` antes del commit.

- [ ] **Step 5: Verifica que compila y pasa lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/types.ts lib/dashboard/load.ts app/dashboard/page.tsx
git commit -m "feat(dashboard): capa de carga unica y corrige tabla de tareas"
```

---

### Task 5: Selector maestro

**Files:**
- Create: `app/dashboard/EventSelector.tsx`
- Modify: `app/dashboard/page.tsx`

**Spec visual:** sección **1 · El selector maestro** del mockup, más el encabezado de las secciones 2 y 3.

**Interfaces:**
- Consumes: `EventMetrics`, `Contexto` de `@/lib/dashboard/types`; `computeSalud`, `computeChipDeuda`, `ORDEN_BARRAS` de `@/lib/dashboard/salud`; `formatEventDate` de `@/lib/types`.
- Produces:

```ts
type Props = {
  metrics: EventMetrics[]
  contexto: Contexto
  totalAlertas: number
  onChange: (c: Contexto) => void
  onNuevoEvento: () => void
}
export default function EventSelector(props: Props)
```

- [ ] **Step 1: Escribe `app/dashboard/EventSelector.tsx` completo**

Requisitos, todos verificables a ojo contra el mockup:

- Botón cerrado: punto teal, nombre truncado, chip con la fecha corta, chevron de Lucide. Cuando el contexto es `cartera`, el botón va en negro `#1D1E20` con texto blanco y el ícono de capas.
- Al abrir: buscador arriba (filtra por nombre y por venue, sin distinguir acentos ni mayúsculas), luego la fila **Vista cartera** con fondo `#f8f8f8`, ícono negro y chip rojo con `totalAlertas` si es mayor que cero.
- Después, un encabezado `Activos · N` con la leyenda `Invitados · Dinero · Logística · Tareas` a la derecha.
- Cada fila de evento: nombre, `fecha · en N días · venue`, las cuatro barras en el orden de `ORDEN_BARRAS`, y el chip de `computeChipDeuda`. Solo el evento en foco lleva punto teal a la izquierda.
- Mapa de tono a color de barra: `ok` → `bg-[#48C9B0]`, `aviso` → `bg-[#B8860B]`, `alerta` → `bg-[#CC3333]`, `vacio` → `bg-[#E8E8E8]`.
- Pie: botón negro `+ Nuevo evento` a ancho completo, y un botón secundario que muestra el conteo de pasados.
- Cierra con clic fuera, con `Escape`, y al elegir una opción. Reusa el patrón `data-menu` que ya existe en `page.tsx` para el clic fuera.
- Accesible: el botón lleva `aria-expanded`, el menú es una lista de `<button>`, y el foco entra al buscador al abrir.
- Máximo del menú `max-h-[70vh]` con `overflow-y-auto` en la lista de eventos, no en el contenedor completo — el buscador y el pie se quedan fijos.

- [ ] **Step 2: Reemplaza los tabs del encabezado por el selector en `page.tsx`**

Agrega `const [contexto, setContexto] = useState<Contexto>({ kind: 'cartera' })` y monta `<EventSelector>` en el header, entre el logo y las acciones de la derecha. El contexto inicial se decide así:

```ts
// El anfitrion tiene un solo evento: arrancar en cartera le muestra una
// tarjeta sola. El planner necesita ver el panorama primero.
useEffect(() => {
  if (loading || metrics.length === 0) return
  const activos = metrics.filter(m => m.event.event_status === 'active')
  if (rol === 'planner' || activos.length > 1) setContexto({ kind: 'cartera' })
  else if (activos[0]) setContexto({ kind: 'evento', eventId: activos[0].event.id })
}, [loading, metrics, rol])
```

`totalAlertas` = suma de `m.tareas.vencidas` de todos los eventos activos.

- [ ] **Step 3: Verifica en local**

Run: `npm run dev`
- El selector abre y cierra con clic fuera y con `Escape`.
- El buscador filtra escribiendo "cong" y también "Cong".
- Las cuatro barras aparecen y cambian de color entre eventos.
- Elegir un evento cambia el título del botón; elegir cartera lo pone en negro.
- Con un solo evento activo, el dashboard arranca en ese evento.

- [ ] **Step 4: Lint y build**

Run: `npm run lint && npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/EventSelector.tsx app/dashboard/page.tsx
git commit -m "feat(dashboard): selector maestro con salud por evento"
```

---

### Task 6: Contexto evento — hero y tarjetas

**Files:**
- Create: `app/dashboard/ContextoEvento.tsx`
- Modify: `app/dashboard/page.tsx`

**Spec visual:** sección **2 · Contexto: un evento** del mockup, hero y las cuatro tarjetas. **Hero claro**, el oscuro está descartado.

**Interfaces:**
- Consumes: `EventMetrics`, `ColaboradorRow`, `Rol`; `Urgencia` y `buildUrgencias`; `formatCurrency`, `formatEventDate`.
- Produces:

```ts
type Props = {
  m: EventMetrics
  colaboradores: ColaboradorRow[]
  rol: Rol
  puedeVerDinero: boolean
  onAbrirEvento: () => void
}
export default function ContextoEvento(props: Props)
```

- [ ] **Step 1: Escribe el hero y las cuatro tarjetas**

- Hero: `rounded-2xl border border-[#e8e8e8]` con degradado `bg-gradient-to-br from-white via-white to-[#f3fbf9]` y un resplandor teal en la esquina con un `div` absoluto y `blur-3xl`. Chips: estado del evento, tipo, estado de la invitación, modo de acceso.
- Countdown: reutiliza `getCountdown` que ya existe en `page.tsx` — **muévelo** a `ContextoEvento.tsx` junto con `getEventDateTime` y el `setInterval` de un segundo, y quítalos de `page.tsx`. El intervalo debe limpiarse en el `return` del `useEffect`.
- Barra de organización: promedio simple de los cuatro porcentajes que ya existen (confirmado, contratado, acomodado, tareas al día). Escribe la fórmula como una función local `pctOrganizacion(m: EventMetrics): number` y **agrégale un test** en `lib/dashboard/salud.test.ts` si decides moverla a `salud.ts` — si se queda local en el componente, no lleva test.
- Tres botones: *Abrir evento* (teal), *Ver invitación*, *Copiar link*.
- Cuatro tarjetas en `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3`:
  - **Invitados:** total grande `confirmados de total`, barra de tres tramos (teal confirmados, dorado pendientes, gris declinados), línea de pendientes y declinados, chip rojo de atención si `atencion > 0`.
  - **Presupuesto:** total grande = **estimado**, barra con `pagado` en `#1A9E88` y `porPagar` en `#48C9B0` sobre pista gris, y tres renglones: Pagado, Contratado por pagar, Sin contratar. Si `excedido`, la barra completa va en `#CC3333` y aparece un chip rojo con el sobrante. **Solo si `puedeVerDinero`.**
  - **Proveedores:** `contratados de total contratados`, barra, línea de cotizados y sin cotizar. **Solo si `puedeVerDinero`.**
  - **Mesa de regalos:** `recibido` con `formatCurrency`, barra dorada de apartados sobre total, y chip dorado si hay aportes.
- Si `!puedeVerDinero`, el grid pasa a dos columnas y solo se muestran Invitados y Regalos.
- Orden por rol: si `rol === 'planner'`, el grid arranca con Presupuesto y Proveedores. Si no, con Invitados y Regalos.

- [ ] **Step 2: Monta el contexto en `page.tsx`**

```tsx
{contexto.kind === 'evento' && enFoco && (
  <ContextoEvento
    m={enFoco}
    colaboradores={colaboradores.filter(c => c.event_id === enFoco.event.id)}
    rol={rol}
    puedeVerDinero={enFoco.event.shared_role !== 'viewer'}
    onAbrirEvento={() => { window.location.href = '/events/' + enFoco.event.id }}
  />
)}
```

donde `enFoco = metrics.find(m => contexto.kind === 'evento' && m.event.id === contexto.eventId) ?? null`.

- [ ] **Step 3: Verifica en local**

- Los montos salen con `formatCurrency` y la moneda del evento, no con `$` a mano.
- El countdown corre y no deja el intervalo vivo al cambiar de contexto (revisa con React DevTools o metiendo un `console.log` temporal en el cleanup).
- Un evento sin presupuesto muestra la barra vacía, no `NaN` ni `Infinity`.
- Entra con un evento compartido en rol `viewer`: las tarjetas de dinero no aparecen.

- [ ] **Step 4: Lint y build**

Run: `npm run lint && npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/ContextoEvento.tsx app/dashboard/page.tsx
git commit -m "feat(dashboard): contexto de evento con hero claro y tarjetas"
```

---

### Task 7: Feed de atención accionable

**Files:**
- Create: `app/dashboard/FeedAtencion.tsx`
- Modify: `app/dashboard/ContextoEvento.tsx`

**Spec visual:** el bloque **Requiere tu atención** de la sección 2 del mockup.

**Interfaces:**
- Consumes: `Urgencia` de `@/lib/dashboard/urgencias`.
- Produces:

```ts
type Props = {
  urgencias: Urgencia[]
  titulo: string
  mostrarEvento: boolean   // true en cartera, false en contexto de un evento
  max?: number             // default 3
  onResuelta?: (u: Urgencia) => void
}
export default function FeedAtencion(props: Props)
```

- [ ] **Step 1: Escribe `FeedAtencion.tsx` completo**

- Encabezado: punto rojo, `titulo`, chip con el conteo total, y a la derecha `Ver las N` si hay más que `max`.
- Cada fila: cuadro de 28 px con ícono de Lucide según `tipo`, título en semibold, detalle en gris, y los botones de `accion` (y `secundaria` si existe) alineados a la derecha.
- Mapa de ícono por tipo: `tarea_bloqueante` y `tarea_vencida` → `TriangleAlert`; `presupuesto_excedido` → `TrendingUp`; `proveedor_saldo` → `CreditCard`; `invitados_atencion` → `CircleAlert`; `tarea_hoy` → `Clock`; `sin_lugar` → `Armchair`; `invitacion_borrador` → `FileText`.
- Fondo del cuadro por tono: `alerta` → `bg-[#fff0f0]`, `aviso` → `bg-[#fff8e8]`, `ok` → `bg-[#f0fff6]`, `vacio` → `bg-[#f8f8f8]`.
- Si `mostrarEvento`, el detalle arranca con `${u.eventName} · `.
- Si `urgencias` está vacío: estado vacío con `CircleCheck` en teal y el texto *Todo al día. No hay nada que requiera tu atención.*
- En móvil los botones bajan a una fila propia a ancho completo (`flex-col sm:flex-row`).

- [ ] **Step 2: Móntalo en `ContextoEvento.tsx`**

```tsx
<FeedAtencion
  urgencias={buildUrgencias([m], { puedeVerDinero })}
  titulo="Requiere tu atención"
  mostrarEvento={false}
/>
```

- [ ] **Step 3: Verifica en local**

- Un evento con tarea vencida bloqueante la muestra primero.
- Un evento limpio muestra el estado vacío, no un bloque en blanco.
- Los enlaces de acción llevan a la ruta correcta (timeline con `?task=`, pagos, mesas, invitación).
- En `viewer`, no aparece ninguna fila de dinero.

- [ ] **Step 4: Lint y build**

Run: `npm run lint && npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/FeedAtencion.tsx app/dashboard/ContextoEvento.tsx
git commit -m "feat(dashboard): feed de atencion accionable"
```

---

### Task 8: Contexto evento — tareas, mesas, actividad y equipo

**Files:**
- Modify: `app/dashboard/ContextoEvento.tsx`

**Spec visual:** el bloque de dos columnas de la sección 2 del mockup.

**Interfaces:**
- Consumes: `supabase` para la mutación de tarea completada; `logAction` de `@/lib/audit`.
- Produces: nada nuevo hacia afuera.

- [ ] **Step 1: Columna izquierda — pendientes de la semana**

- Tarjeta con encabezado *Pendientes de la semana*, subtítulo *Márcalas aquí, sin entrar al timeline*, y botón *Ver timeline*.
- Hasta cinco tareas de `m` ordenadas por fecha. Cada renglón: checkbox, título, chip de urgencia (`Vencida`, `Hoy 11:00`, `En 3 días`), y una línea con categoría y responsable.
- Al marcar el checkbox: actualización optimista en estado local, luego
  ```ts
  await supabase.from('event_timeline_tasks').update({ is_completed: true }).eq('id', id)
  ```
  Si la respuesta trae `error`, revierte el estado local y muestra el chip en rojo con el texto *No se pudo marcar*. **No hay `logAction` para tareas** en `lib/audit.ts` — no inventes una acción nueva; si quieres bitácora, eso es otra conversación.
- Nota de implementación: `ContextoEvento` recibe `m` por props, así que la lista de tareas necesita estado local propio para el marcado optimista. Inicialízalo con `useState` derivado de `m` y sincronízalo con `useEffect` cuando cambie `m.event.id`.

- [ ] **Step 2: Columna izquierda — mesas y acomodo**

Tarjeta con cuatro fichas: `conLugar` (Con lugar), `sinLugar` (Sin lugar, fondo ámbar si es mayor que cero), `sillasLibres` (Sillas libres), y el porcentaje acomodado (fondo teal). Encabezado con `mesas` mesas y `conGente` con gente.

- [ ] **Step 3: Columna derecha — actividad reciente**

Consulta nueva, dentro de `ContextoEvento` y solo para el evento en foco (no para los seis):

```ts
const { data } = await supabase
  .from('event_audit_log')
  .select('id, action, entity_label, user_name, created_at')
  .eq('event_id', m.event.id)
  .order('created_at', { ascending: false })
  .limit(6)
```

Renderiza cada renglón con el ícono según el prefijo de `action` (`guest.` → `Users`, `table.` → `LayoutGrid`, `settings.` → `Settings`, `collaborator.` → `UserPlus`, resto → `Activity`), el texto armado con `AUDIT_ACTION_LABEL` de `@/lib/audit`, y la antigüedad en formato relativo (*Hace 25 minutos*, *Ayer, 6:40 pm*). Escribe el formateo relativo como función pura `haceCuanto(iso: string, ahora: Date): string` en `lib/dashboard/salud.ts` y **agrégale tests** en `salud.test.ts` para: menos de un minuto, minutos, horas, ayer, y más de una semana.

Si la consulta devuelve cero filas, muestra *Todavía no hay actividad en este evento.*

- [ ] **Step 4: Columna derecha — equipo**

Tarjeta con los `colaboradores` que llegan por props: avatar de iniciales, nombre (o email si `full_name` es nulo), y chip con el rol. Encima de la lista, el dueño del evento: si `m.event.is_shared`, usa `m.event.owner_name`; si no, el nombre del usuario en sesión. Botón *+ Invitar* que lleva a `/events/${m.event.id}/configuracion`.

- [ ] **Step 5: Verifica en local**

- Marcar una tarea la tacha al instante y sigue tachada al recargar.
- Cortar la red y marcar una tarea revierte el tachado y muestra el error.
- La actividad reciente trae filas reales del audit log del evento.
- Un evento sin colaboradores muestra solo al dueño.

- [ ] **Step 6: Corre los tests**

Run: `npm test`
Expected: PASS, incluidos los nuevos de `haceCuanto`.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/ContextoEvento.tsx lib/dashboard/salud.ts lib/dashboard/salud.test.ts
git commit -m "feat(dashboard): tareas marcables, mesas, actividad y equipo"
```

---

### Task 9: Contexto cartera

**Files:**
- Create: `app/dashboard/ContextoCartera.tsx`
- Modify: `app/dashboard/page.tsx`

**Spec visual:** sección **3 · Contexto: la cartera** del mockup.

**Interfaces:**
- Consumes: `EventMetrics`, `Rol`; `buildUrgencias`; `FeedAtencion`; `formatCurrency`, `formatEventDate`.
- Produces:

```ts
type Props = {
  metrics: EventMetrics[]
  rol: Rol
  onElegirEvento: (eventId: string) => void
  onNuevoEvento: () => void
}
export default function ContextoCartera(props: Props)
```

- [ ] **Step 1: Cuatro números globales**

Grid de cuatro tarjetas con borde izquierdo de 3 px, calculadas sobre los eventos **activos**:

- *Tareas vencidas* — suma de `vencidas`, en `#CC3333`, con subtítulo `en N eventos · N bloqueantes`.
- *Por pagar en total* — suma de `porPagar`. **Nota: es "en total", no "esta semana".** No existe fecha comprometida de pago.
- *Confirmados en total* — `suma de confirmados de suma de total`, con subtítulo de cuántos requieren atención.
- *Presupuesto gestionado* — suma de `estimado`, con subtítulo de cuánto se ha pagado.

Los montos se suman **solo entre eventos de la misma moneda**. Si hay más de una moneda entre los eventos activos, muestra el monto de la moneda dominante y un chip `+N monedas` en lugar de sumar peras con manzanas. Escribe esto como función pura `sumaPorMoneda(metrics, pick)` en `lib/dashboard/salud.ts` con tests para: una sola moneda, dos monedas, y cero eventos.

- [ ] **Step 2: Feed transversal**

El permiso de dinero es por evento, así que se construye evento por evento y se reordena el concatenado con el comparador que exporta `urgencias.ts`:

```tsx
import { buildUrgencias, comparaUrgencias } from '@/lib/dashboard/urgencias'

const urgenciasCartera = activos
  .flatMap(m => buildUrgencias([m], { puedeVerDinero: m.event.shared_role !== 'viewer' }))
  .sort(comparaUrgencias)
```

```tsx
<FeedAtencion
  urgencias={urgenciasCartera}
  titulo="Lo más urgente de toda tu cartera"
  mostrarEvento
  max={3}
/>
```

- [ ] **Step 3: Tabs de estado y tarjetas**

- Conserva los cuatro tabs de hoy (activos, pasados, pausados, cancelados) con su contador, y el botón de orden por fecha. La lógica de `filterByTab` ya existe en `page.tsx`: **muévela** a `ContextoCartera.tsx` adaptada a `EventMetrics[]`.
- Grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3`. Cada tarjeta: chip de categoría del evento, chip de días restantes con tono por cercanía (menos de 40 días alerta, menos de 60 aviso, resto neutro), nombre, `fecha · venue`, dos barras (Confirmados y Pagado del estimado, o Contratado del estimado en rojo si `excedido`), y al pie el chip de deuda más el texto *Entrar*.
- El evento que estaba en foco antes de cambiar a cartera lleva chip teal *En foco* y borde `border-[#c8ede7]`.
- Los eventos compartidos conservan su chip de rol, como hoy.
- Mantén las secciones *Mis eventos* y *Compartidos conmigo* separadas, igual que hoy.
- Conserva el menú de tres puntos para cambiar el estado del evento, con su `handleStatusChange` — **muévelo** desde `page.tsx`.
- Estado vacío: si no hay ningún evento, el bloque punteado con *Aún no tienes eventos* y el botón de crear, igual que hoy.

- [ ] **Step 4: Retira el código viejo de `page.tsx`**

Al terminar, `page.tsx` solo debe contener: estado, `init`/`checkAuth`/`loadData`, el header con logo, `EventSelector`, campana, feedback, perfil y salir, y la delegación a los dos contextos. Borra de ahí: `EventCard`, `SkeletonCard` (muévelo a `ContextoCartera`), `filterByTab`, `tabs`, `getMenuOptions`, `handleStatusChange`, `getCountdown`, `getEventDateTime`, `confirmPct`, `formatTime`, `ReminderCategoryIcon`, y el bloque completo de la tarjeta de próximo evento.

**La campana:** ahora que las urgencias viven en el feed, la campana se queda solo con los recordatorios de `reminder_date`. Cámbiala para que lea de `event_timeline_tasks` con `reminder_date` no nulo, y borra `formatReminderDate`, `markDone` y `markAllDone` si dejan de usarse. Si prefieres retirarla del todo, esa es una decisión de producto: pregúntala, no la tomes.

- [ ] **Step 5: Verifica en local**

- Cartera y evento se ven como el mockup en escritorio a 1280 px.
- En móvil a 390 px nada desborda horizontalmente y los tabs hacen scroll lateral en su propio contenedor.
- Cambiar de contexto ida y vuelta no recarga la página ni pierde el scroll.
- Un usuario sin eventos ve el estado vacío.
- Un usuario con un solo evento activo arranca en ese evento, y puede llegar a la cartera por el selector.

- [ ] **Step 6: Corre todo**

Run: `npm test && npm run lint && npm run build`
Expected: PASS en los tres.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/ContextoCartera.tsx app/dashboard/page.tsx
git commit -m "refactor(dashboard): contexto cartera y limpieza de la pagina"
```

---

## Verificación final antes de abrir PR

- [ ] `npm test` — verde
- [ ] `npm run lint` — sin warnings nuevos
- [ ] `npm run build` — sin errores
- [ ] Escritorio 1280 px: los dos contextos contra las secciones 2 y 3 del mockup
- [ ] Móvil 390 px: sin scroll horizontal en ninguno de los dos contextos
- [ ] Evento compartido como `viewer`: sin tarjetas de dinero, sin urgencias de pago
- [ ] Usuario sin eventos: estado vacío correcto
- [ ] Usuario con un evento: arranca en el evento, no en la cartera
- [ ] Usuario con seis eventos: arranca en cartera, el selector filtra y las barras pintan
- [ ] Marcar una tarea persiste al recargar
- [ ] Ningún monto con `$` concatenado a mano
- [ ] Ningún emoji, ningún ícono que no sea de Lucide
- [ ] `git diff --stat origin/main` no toca nada bajo `app/events/`

## Notas para quien lo ejecute

**El bug de la tabla de tareas — ya verificado, no hay nada que confirmar.** `timeline_tasks` **no existe** en la base (schema consultado el 1 de agosto de 2026; la única tabla de tareas es `event_timeline_tasks`). El dashboard actual la consulta igual, el error se entierra en `(remindersRes.data || [])`, y el resultado es que la campana de recordatorios y el badge `pendingReminders` de cada tarjeta llevan tiempo mostrando cero sin que nada falle a la vista.

Consecuencia práctica al implementar la tarea 4: **los números de recordatorios van a cambiar de cero a algo real.** No es una regresión, es el bug arreglándose. No lo "corrijas" de vuelta.

**Sobre `task_date`.** Es `date NOT NULL`, así que en la práctica no llegan tareas sin fecha. Los filtros `!!t.task_date` en `metrics.ts` y el test *"ignora las completadas y las sin fecha"* se quedan: son defensa de la función pura, cuestan nada, y protegen si algún día la columna se relaja.

**El chip negro del selector — decidido, no preguntar.** El chip de "Vista cartera" seleccionada va en negro `#1D1E20`. Aprobado por Diego el 1 de agosto de 2026: el selector maestro cuenta como dropdown de filtro porque filtra el contexto de toda la pantalla, así que no rompe la regla de CLAUDE.md. Impleméntalo así y sigue.

**RLS.** Las 15 tablas que lee este dashboard tienen RLS activo y al menos una política de `select` (verificado el 1 de agosto de 2026, ninguna en cero). Ocho tienen una sola política: `event_audit_log`, `event_budgets`, `event_collaborators`, `event_suppliers`, `gift_registry_items`, `gift_reservations`, `supplier_payments` y `users`. No se verificó el `USING` de ninguna, así que queda la posibilidad de que alguna esté escrita para un camino público por token y no cubra al planner autenticado. El paso 4 de la tarea 4 existe justo para atrapar eso. Si aparece, **es un cambio en Supabase: se pregunta, no se hace.**

**Rendimiento.** La agregación sigue en el cliente, a propósito. El umbral para mover esto a una vista de Postgres está en el spec: más de 15 eventos activos y más de 1.5 s de carga. Antes de eso sería optimizar sin medir.
