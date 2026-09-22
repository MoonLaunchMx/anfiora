# Planes de planner y muros de la cuenta gratis — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos usan casillas (`- [ ]`) para llevar el avance.

**Goal:** Dejar en producción los cuatro planes de planner, el sello de partner fundador y las dos paredes de la cuenta gratis (un evento activo, 50 personas), sin cobrar todavía.

**Architecture:** Un solo catálogo de planes (`lib/workspace/planes.ts`) del que cuelgan todos los límites; funciones puras para contar y decidir; la base de datos como candado real (triggers) y la interfaz como aviso amable. El plan vive en `workspaces.plan` y el sello junto a él.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (Postgres + RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-planes-planner-y-muros-design.md`

## Global Constraints

- **Worktree:** `C:\Users\diego\Documents\anfiora-muro`, rama `feat/muro-un-evento`. No trabajar en el checkout principal.
- **Nunca `git push` ni tocar Supabase sin permiso explícito de Diego.** El SQL se entrega solo cuando el código ya está en producción.
- **Planes y precios (MXN):** Free $0 / 1 asiento / 1 evento activo / 50 personas por evento · Pro $490 / 1 asiento · Studio $990 / 3 asientos · Agency $1,990 provisional / 5 asientos. Asiento extra $290. Los tres de paga: eventos e invitados sin límite.
- **Ids de plan exactos:** `free`, `pro`, `studio`, `agency`. `pro` cambia de significado (antes $990 con 3 asientos) y `studio` deja de ser alias.
- **Sello:** `fundador`, 25 lugares. Quita los topes de eventos e invitados sin importar el plan.
- **Copy en español de México, con acentos.** Nunca la palabra "boda" en pantallas del producto: se dice "evento". Sin emojis. Botones de acción a la derecha. CTA en teal `#48C9B0`. Negro `#1D1E20` solo para dropdowns de filtro.
- **Commits convencionales sin acentos ni ñ** (`feat:`, `fix:`, `docs:`).
- **Tests:** Vitest solo sobre lógica pura. La UI y lo que toca I/O se verifica a mano en local → preview → main.
- **Antes de dar algo por terminado:** `npm test` y `npm run build` en verde, con el dev server apagado.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/workspace/planes.ts` (modificar) | Catálogo único: ids, precios, asientos, eventos activos, invitados por evento |
| `lib/workspace/sello.ts` (crear) | El sello de partner y los límites efectivos de una cuenta (plan + sello) |
| `lib/workspace/asientos.ts` (modificar) | Quién puede invitar equipo, con los planes nuevos |
| `lib/invitados/cupo.ts` (crear) | Contar personas, decidir cuántas caben, leer el error de la base |
| `lib/capacity.ts` (ya existe en la rama) | Consultar el cupo de eventos y leer sus errores |
| `lib/events/estado.ts` (ya existe en la rama) | Activo / pasado / archivado |
| `lib/billing.ts` (modificar) | Precios e ingreso de `/admin` con los cuatro planes |
| `lib/admin/change-plan.ts` (modificar) | Validar cambio de plan y de sello |
| `app/components/MuroModal.tsx` (crear) | El aviso de tope, los planes y el formulario de solicitud |
| `app/api/solicitud-acceso/route.ts` (crear) | Mandar la solicitud a Telegram |
| `supabase/2026-09-20-planes-y-muros.sql` (crear) | Columnas del sello, triggers de cupo, de invitados y de solo lectura, migración de estatus |

---

## Task 1: Poner la rama al día con `main`

La rama salió de `main` el 19 de agosto y quedó 406 commits atrás. Todo lo demás depende de esto.

**Files:**
- Modify: `lib/types.ts`, `lib/notifications/reminders.ts`, `app/api/webhook/whatsapp/route.ts`, `app/api/webhook/telegram/route.ts`, `vitest.config.ts`
- Modify: `lib/capacity.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: la rama compila contra el `main` de hoy, con `lib/workspace/planes.ts` disponible.

- [ ] **Paso 1: Traer main**

```bash
cd /c/Users/diego/Documents/anfiora-muro
git fetch origin
git merge origin/main
```

- [ ] **Paso 2: Resolver los conflictos esperados**

Solo cuatro archivos tienen cambios de esta rama que main también tocó:

- `lib/types.ts`: la rama deja `EventStatus = 'active' | 'archived'`. Se conserva la versión de la rama y se re-aplican encima los campos que main haya agregado al tipo `Event`.
- `lib/notifications/reminders.ts`, `app/api/webhook/whatsapp/route.ts`, `app/api/webhook/telegram/route.ts`: la rama cambia la condición de "evento cancelado o completado" por `esArchivado(...)` de `lib/events/estado.ts`. Se conserva ese cambio y se respeta cualquier lógica nueva de main alrededor.

- [ ] **Paso 3: Revertir el cambio a la configuración de pruebas**

`vitest.config.ts` no debe cargar `.env.local`: metía las llaves de servicio en los ~540 tests.

```bash
git checkout origin/main -- vitest.config.ts
```

- [ ] **Paso 4: Aislar Supabase en la prueba de capacidad**

`lib/capacity.ts` importa el cliente de Supabase, que truena al cargarse sin variables de entorno. Se resuelve en la prueba, no en la configuración global. Al inicio de `lib/capacity.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

import { parseLimitError, esErrorDeCupo, esErrorDeArchivado } from './capacity'
```

- [ ] **Paso 5: Verificar que todo compila y pasa**

```bash
npm test
npx tsc --noEmit
npm run build
```

Esperado: pruebas en verde, `tsc` sin errores, build verde. Si `tsc` marca errores por `EventStatus` en pantallas que main agregó (dashboard, configuración), se arreglan aquí: son los valores `paused`, `cancelled` y `completed` que ya no existen.

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "chore(muro): pone la rama al dia con main"
```

---

## Task 2: El catálogo de planes

**Files:**
- Modify: `lib/workspace/planes.ts`
- Modify: `lib/workspace/planes.test.ts`
- Delete: `lib/pricing.ts`, `lib/entitlements.ts`, `lib/entitlements.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `PLAN_IDS = ['free','pro','studio','agency']`, `PLANES[id].{precio, asientosIncluidos, eventosActivos, invitadosPorEvento}`, `normalizarPlan(raw): PlanId`.

Los dos archivos que se borran son el catálogo de junio (cuatro planes por cupo de eventos) que esta rama portó en agosto. Murió: hoy el catálogo es `lib/workspace/planes.ts`, que ya está en `main` y lo consumen `/admin`, billing, asientos y la pantalla de equipo.

- [ ] **Paso 1: Escribir las pruebas que fallan**

En `lib/workspace/planes.test.ts`, agregar:

```ts
describe('catalogo de planes', () => {
  it('tiene los cuatro planes con sus asientos', () => {
    expect(PLANES.free.asientosIncluidos).toBe(1)
    expect(PLANES.pro.asientosIncluidos).toBe(1)
    expect(PLANES.studio.asientosIncluidos).toBe(3)
    expect(PLANES.agency.asientosIncluidos).toBe(5)
  })

  it('tiene los precios acordados', () => {
    expect(PLANES.free.precio).toBe(0)
    expect(PLANES.pro.precio).toBe(490)
    expect(PLANES.studio.precio).toBe(990)
    expect(PLANES.agency.precio).toBe(1990)
  })

  it('solo free tiene topes', () => {
    expect(PLANES.free.eventosActivos).toBe(1)
    expect(PLANES.free.invitadosPorEvento).toBe(50)
    for (const id of ['pro', 'studio', 'agency'] as const) {
      expect(PLANES[id].eventosActivos).toBeNull()
      expect(PLANES[id].invitadosPorEvento).toBeNull()
    }
  })

  it('studio ya no es alias de pro', () => {
    expect(normalizarPlan('studio')).toBe('studio')
    expect(normalizarPlan('PRO')).toBe('pro')
    expect(normalizarPlan('solo')).toBe('free')
    expect(normalizarPlan(null)).toBe('free')
  })
})
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- planes
```

Esperado: falla en `PLANES.studio` (no existe) y en el alias.

- [ ] **Paso 3: Escribir el catálogo**

En `lib/workspace/planes.ts`:

```ts
export const PLAN_IDS = ['free', 'pro', 'studio', 'agency'] as const
export type PlanId = typeof PLAN_IDS[number]

export interface Plan {
  id: PlanId
  nombre: string
  precio: number
  asientosIncluidos: number
  // null = sin limite
  eventosActivos: number | null
  invitadosPorEvento: number | null
  ventanaActividadDias: number | null
  importExport: boolean
  whitelabel: boolean
  herramientas: readonly Modulo[]
}
```

y las cuatro entradas:

```ts
export const PLANES: Record<PlanId, Plan> = {
  free: {
    id: 'free', nombre: 'Free', precio: 0, asientosIncluidos: 1,
    eventosActivos: 1, invitadosPorEvento: 50,
    ventanaActividadDias: 0, importExport: false, whitelabel: false,
    herramientas: HERRAMIENTAS_FREE,
  },
  pro: {
    id: 'pro', nombre: 'Pro', precio: 490, asientosIncluidos: 1,
    eventosActivos: null, invitadosPorEvento: null,
    ventanaActividadDias: 30, importExport: true, whitelabel: false,
    herramientas: MODULOS,
  },
  studio: {
    id: 'studio', nombre: 'Studio', precio: 990, asientosIncluidos: 3,
    eventosActivos: null, invitadosPorEvento: null,
    ventanaActividadDias: 30, importExport: true, whitelabel: false,
    herramientas: MODULOS,
  },
  agency: {
    id: 'agency', nombre: 'Agency', precio: 1990, asientosIncluidos: 5,
    eventosActivos: null, invitadosPorEvento: null,
    ventanaActividadDias: null, importExport: true, whitelabel: true,
    herramientas: MODULOS,
  },
}
```

El mapa `ALIAS` se queda vacío: `studio` ya es un plan real y `solo` nunca existió en la base.

```ts
const ALIAS: Record<string, PlanId> = {}
```

- [ ] **Paso 4: Correr y ver que pasa**

```bash
npm test -- planes
npx tsc --noEmit
```

`tsc` va a marcar los lugares que enumeran los planes a mano (`lib/billing.ts` con `byPlan`, `/admin`). Se arreglan en la Tarea 5; si estorban para avanzar, se deja el tipo correcto y se completa ahí.

- [ ] **Paso 5: Pro trabaja solo, igual que Free**

En `lib/workspace/asientos.test.ts`:

```ts
it('pro y free no invitan equipo; studio y agency si', () => {
  expect(puedeInvitar('free', 1).ok).toBe(false)
  expect(puedeInvitar('pro', 1).ok).toBe(false)
  expect(puedeInvitar('studio', 1)).toEqual({ ok: true, motivo: null, costoNuevoAsiento: 0 })
  expect(puedeInvitar('studio', 3).costoNuevoAsiento).toBe(290)
  expect(puedeInvitar('agency', 4).costoNuevoAsiento).toBe(0)
  expect(puedeInvitar('agency', 5).costoNuevoAsiento).toBe(290)
})
```

y en `lib/workspace/asientos.ts`, el corte deja de nombrar a `free` y pasa a leer el catálogo:

```ts
export function puedeInvitar(plan: PlanId, ocupados: number): PermisoDeInvitar {
  if (PLANES[plan].asientosIncluidos <= 1) return { ok: false, motivo: 'plan', costoNuevoAsiento: 0 }
  const cuesta = ocupados + 1 > PLANES[plan].asientosIncluidos
  return { ok: true, motivo: null, costoNuevoAsiento: cuesta ? PRECIO_ASIENTO_EXTRA : 0 }
}
```

Con esto **Pro no compra asientos extra**: quien necesita equipo sube a Studio. El aviso de `AltaPersonaModal` ya dice que se necesita un plan con equipo, así que no cambia.

- [ ] **Paso 6: Borrar el catálogo viejo**

```bash
git rm lib/pricing.ts lib/entitlements.ts lib/entitlements.test.ts
npm test
```

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat(planes): cuatro planes de planner con asientos, eventos e invitados"
```

---

## Task 3: El sello de partner y los límites efectivos

**Files:**
- Create: `lib/workspace/sello.ts`, `lib/workspace/sello.test.ts`

**Interfaces:**
- Consumes: `PLANES`, `normalizarPlan`, `PlanId` de `lib/workspace/planes.ts`.
- Produces:
  - `type Sello = 'fundador' | null`
  - `normalizarSello(raw: unknown): Sello`
  - `limiteEventos(plan: string | null, sello: unknown): number | null`
  - `limiteInvitados(plan: string | null, sello: unknown): number | null`
  - `LUGARES_FUNDADOR = 25`
  - `hayLugarDeFundador(selloOcupados: number): boolean`

Ninguna pantalla pregunta por el nombre del plan: todas preguntan por estas dos funciones. `null` significa "sin límite".

- [ ] **Paso 1: Escribir las pruebas que fallan**

`lib/workspace/sello.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  normalizarSello, limiteEventos, limiteInvitados,
  LUGARES_FUNDADOR, hayLugarDeFundador,
} from './sello'

describe('sello de partner', () => {
  it('solo reconoce fundador', () => {
    expect(normalizarSello('fundador')).toBe('fundador')
    expect(normalizarSello(' FUNDADOR ')).toBe('fundador')
    expect(normalizarSello('vip')).toBeNull()
    expect(normalizarSello(null)).toBeNull()
  })

  it('free tiene topes y los de paga no', () => {
    expect(limiteEventos('free', null)).toBe(1)
    expect(limiteInvitados('free', null)).toBe(50)
    expect(limiteEventos('pro', null)).toBeNull()
    expect(limiteInvitados('studio', null)).toBeNull()
  })

  it('el sello quita los topes aunque el plan sea free', () => {
    expect(limiteEventos('free', 'fundador')).toBeNull()
    expect(limiteInvitados('free', 'fundador')).toBeNull()
  })

  it('un plan desconocido se trata como free', () => {
    expect(limiteEventos('lo-que-sea', null)).toBe(1)
    expect(limiteInvitados(null, null)).toBe(50)
  })

  it('los lugares de fundador son 25', () => {
    expect(LUGARES_FUNDADOR).toBe(25)
    expect(hayLugarDeFundador(24)).toBe(true)
    expect(hayLugarDeFundador(25)).toBe(false)
  })
})
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- sello
```

Esperado: falla por módulo inexistente.

- [ ] **Paso 3: Escribir el módulo**

`lib/workspace/sello.ts`:

```ts
import { PLANES, normalizarPlan } from './planes'

export type Sello = 'fundador' | null

export const LUGARES_FUNDADOR = 25

export function normalizarSello(raw: unknown): Sello {
  if (typeof raw !== 'string') return null
  return raw.trim().toLowerCase() === 'fundador' ? 'fundador' : null
}

export function hayLugarDeFundador(ocupados: number): boolean {
  return ocupados < LUGARES_FUNDADOR
}

export function limiteEventos(plan: string | null | undefined, sello: unknown): number | null {
  if (normalizarSello(sello)) return null
  return PLANES[normalizarPlan(plan)].eventosActivos
}

export function limiteInvitados(plan: string | null | undefined, sello: unknown): number | null {
  if (normalizarSello(sello)) return null
  return PLANES[normalizarPlan(plan)].invitadosPorEvento
}
```

- [ ] **Paso 4: Correr y ver que pasa**

```bash
npm test -- sello
```

- [ ] **Paso 5: Commit**

```bash
git add lib/workspace/sello.ts lib/workspace/sello.test.ts
git commit -m "feat(planes): sello de partner fundador y limites efectivos"
```

---

## Task 4: Contar personas y decidir cuántas caben

**Files:**
- Create: `lib/invitados/cupo.ts`, `lib/invitados/cupo.test.ts`

**Interfaces:**
- Consumes: `limiteInvitados` de `lib/workspace/sello.ts`.
- Produces:
  - `contarPersonas(invitados: number, acompanantes: number): number`
  - `lugaresLibres(personas: number, limite: number | null): number | null`
  - `cuantasCaben(porAgregar: number, personas: number, limite: number | null): { caben: number; sobran: number }`
  - `parseErrorInvitados(msg: string): { personas: number; limite: number } | null`
  - `esErrorDeInvitados(error: { message: string } | null): boolean`

El error que levanta la base es `INVITADOS_LIMITE:<personas>:<limite>`, con el mismo formato que el de eventos.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`lib/invitados/cupo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  contarPersonas, lugaresLibres, cuantasCaben,
  parseErrorInvitados, esErrorDeInvitados,
} from './cupo'

describe('cupo de invitados', () => {
  it('cuenta invitados mas acompanantes', () => {
    expect(contarPersonas(40, 12)).toBe(52)
    expect(contarPersonas(0, 0)).toBe(0)
  })

  it('sin limite siempre hay lugar', () => {
    expect(lugaresLibres(500, null)).toBeNull()
    expect(cuantasCaben(200, 500, null)).toEqual({ caben: 200, sobran: 0 })
  })

  it('calcula lugares libres sin bajar de cero', () => {
    expect(lugaresLibres(32, 50)).toBe(18)
    expect(lugaresLibres(50, 50)).toBe(0)
    expect(lugaresLibres(213, 50)).toBe(0)
  })

  it('corta la importacion a lo que cabe', () => {
    expect(cuantasCaben(200, 32, 50)).toEqual({ caben: 18, sobran: 182 })
    expect(cuantasCaben(5, 45, 50)).toEqual({ caben: 5, sobran: 0 })
    expect(cuantasCaben(5, 50, 50)).toEqual({ caben: 0, sobran: 5 })
    expect(cuantasCaben(1, 49, 50)).toEqual({ caben: 1, sobran: 0 })
  })

  it('lee el error de la base', () => {
    expect(parseErrorInvitados('INVITADOS_LIMITE:51:50')).toEqual({ personas: 51, limite: 50 })
    expect(parseErrorInvitados('otra cosa')).toBeNull()
    expect(esErrorDeInvitados({ message: 'x INVITADOS_LIMITE:51:50 y' })).toBe(true)
    expect(esErrorDeInvitados(null)).toBe(false)
  })
})
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- cupo
```

- [ ] **Paso 3: Escribir el módulo**

`lib/invitados/cupo.ts`:

```ts
export function contarPersonas(invitados: number, acompanantes: number): number {
  return invitados + acompanantes
}

export function lugaresLibres(personas: number, limite: number | null): number | null {
  if (limite === null) return null
  return Math.max(0, limite - personas)
}

export function cuantasCaben(
  porAgregar: number,
  personas: number,
  limite: number | null,
): { caben: number; sobran: number } {
  const libres = lugaresLibres(personas, limite)
  if (libres === null) return { caben: porAgregar, sobran: 0 }
  const caben = Math.min(porAgregar, libres)
  return { caben, sobran: porAgregar - caben }
}

export function parseErrorInvitados(msg: string): { personas: number; limite: number } | null {
  const m = msg.match(/INVITADOS_LIMITE:(\d+):(\d+)/)
  return m ? { personas: Number(m[1]), limite: Number(m[2]) } : null
}

export function esErrorDeInvitados(error: { message: string } | null): boolean {
  return !!error && parseErrorInvitados(error.message) !== null
}
```

- [ ] **Paso 4: Correr y ver que pasa**

```bash
npm test -- cupo
```

- [ ] **Paso 5: Commit**

```bash
git add lib/invitados/
git commit -m "feat(invitados): contar personas y decidir cuantas caben"
```

---

## Task 5: Los cuatro planes en `/admin` y en el ingreso

**Files:**
- Modify: `lib/billing.ts`, `lib/billing.test.ts`
- Modify: `lib/admin/change-plan.ts`, `lib/admin/change-plan.test.ts`
- Modify: `app/admin/UsuariosTab.tsx` (selector de plan, ~línea 190 y ~334)

**Interfaces:**
- Consumes: `PLAN_IDS`, `PLANES`, `normalizarPlan`.
- Produces: `BillingSummary.byPlan` con los cuatro ids; el selector de `/admin` ofrece los cuatro.

`BillingSummary.byPlan` hoy declara `{ pro: number; agency: number; free: number }` a mano. Si se queda así, Studio no aparece en el ingreso.

- [ ] **Paso 1: Escribir las pruebas que fallan**

En `lib/billing.test.ts`:

```ts
it('cuenta los cuatro planes y cobra el precio nuevo', () => {
  const rows = getBillingRows([
    { id: '1', email: 'a@a.com', full_name: null, plan: 'pro',    created_at: '2026-01-01' },
    { id: '2', email: 'b@a.com', full_name: null, plan: 'studio', created_at: '2026-01-01' },
    { id: '3', email: 'c@a.com', full_name: null, plan: 'agency', created_at: '2026-01-01' },
    { id: '4', email: 'd@a.com', full_name: null, plan: 'free',   created_at: '2026-01-01' },
  ])
  const resumen = getBillingSummary(rows)
  expect(resumen.mrr).toBe(490 + 990 + 1990)
  expect(resumen.byPlan.studio).toBe(1)
  expect(resumen.byPlan.pro).toBe(1)
})
```

En `lib/admin/change-plan.test.ts`:

```ts
it('acepta studio y rechaza los ids viejos', () => {
  const target = { id: '1', email: 'a@a.com', plan: 'free' }
  expect(checkPlanChange({ target, newPlan: 'studio' }).ok).toBe(true)
  expect(checkPlanChange({ target, newPlan: 'solo' }).ok).toBe(false)
})
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- billing change-plan
```

- [ ] **Paso 3: Arreglar el tipo y el conteo**

En `lib/billing.ts`, `byPlan` deja de enumerarse a mano:

```ts
export interface BillingSummary {
  mrr: number
  arr: number
  payingCustomers: number
  avgTicket: number
  byPlan: Record<PlanId, number>
}
```

y donde se arma el resumen, partir de todos los ids:

```ts
const byPlan = Object.fromEntries(PLAN_IDS.map(id => [id, 0])) as Record<PlanId, number>
for (const r of rows) byPlan[normalizarPlan(r.plan)] += 1
```

- [ ] **Paso 4: El selector de `/admin`**

En `app/admin/UsuariosTab.tsx`, las dos listas de opciones (tarjeta y tabla) dejan de estar escritas a mano:

```tsx
{PLAN_IDS.map(id => (
  <option key={id} value={id}>{PLANES[id].nombre}</option>
))}
```

- [ ] **Paso 5: Correr y verificar**

```bash
npm test
npx tsc --noEmit
```

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "feat(admin): los cuatro planes en el selector y en el ingreso"
```

---

## Task 6: Asignar y mostrar el sello desde `/admin`

**Files:**
- Modify: `app/api/admin/update-plan/route.ts`
- Modify: `app/api/admin/users/route.ts` (devolver el sello)
- Modify: `app/admin/UsuariosTab.tsx`, `app/admin/lib/types.ts`
- Create: `lib/admin/sello.test.ts` (sobre `lib/workspace/sello.ts`)

**Interfaces:**
- Consumes: `normalizarSello`, `hayLugarDeFundador`, `LUGARES_FUNDADOR`.
- Produces: la ruta acepta `{ userId, plan?, sello? }` y escribe `workspaces.sello`; `/api/admin/users` devuelve `sello` por cuenta.

- [ ] **Paso 1: Escribir la prueba que falla**

`lib/admin/sello.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hayLugarDeFundador, normalizarSello } from '@/lib/workspace/sello'

describe('asignacion del sello', () => {
  it('no deja pasar del lugar 25', () => {
    expect(hayLugarDeFundador(24)).toBe(true)
    expect(hayLugarDeFundador(25)).toBe(false)
  })

  it('quitar el sello siempre se puede', () => {
    expect(normalizarSello('')).toBeNull()
  })
})
```

- [ ] **Paso 2: Correr y ver que pasa o falla**

```bash
npm test -- sello
```

- [ ] **Paso 3: La ruta escribe el sello**

En `app/api/admin/update-plan/route.ts`, después de escribir el plan en el workspace, aceptar el sello del cuerpo:

```ts
const sello = normalizarSello(body.sello)

if (sello === 'fundador') {
  const { count } = await supabaseAdmin
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('sello', 'fundador')
  if (!hayLugarDeFundador(count ?? 0)) {
    return NextResponse.json(
      { error: 'Ya no hay lugares de partner fundador: son ' + LUGARES_FUNDADOR },
      { status: 400 },
    )
  }
}

const { data: filas, error: errSello } = await supabaseAdmin
  .from('workspaces').update({ sello }).eq('id', wsId).select('id')
```

Igual que con el plan, el éxito se decide por filas afectadas, no por la ausencia de error: un `update` filtrado por RLS devuelve cero filas sin fallar.

- [ ] **Paso 4: Mostrarlo en la tabla**

En `/admin`, junto al selector de plan, una casilla "Partner fundador" y, cuando está puesto, un chip dorado con el texto `Partner`. Debajo del selector, el conteo: `N de 25 lugares`.

- [ ] **Paso 5: Verificar**

```bash
npm test
npm run build
```

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "feat(admin): asignar y ver el sello de partner fundador"
```

---

## Task 7: El aviso de tope y la solicitud de acceso

**Files:**
- Create: `app/components/MuroModal.tsx`
- Create: `app/api/solicitud-acceso/route.ts`
- Create: `lib/solicitud/mensaje.ts`, `lib/solicitud/mensaje.test.ts`

**Interfaces:**
- Consumes: `PLANES`, `PLAN_IDS`.
- Produces:
  - `<MuroModal open motivo={'eventos' | 'invitados'} limite={number} onClose />`
  - `armarMensajeSolicitud(datos): string`
  - `POST /api/solicitud-acceso`

El envío a Telegram reutiliza el canal de soporte que ya existe en `app/api/feedback/route.ts` (`TELEGRAM_SUPPORT_BOT_TOKEN`, `TELEGRAM_SUPPORT_CHAT_ID`). **Sin tabla nueva.**

- [ ] **Paso 1: Escribir la prueba que falla**

`lib/solicitud/mensaje.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { armarMensajeSolicitud } from './mensaje'

describe('mensaje de solicitud', () => {
  it('incluye lo que Diego necesita para decidir sin preguntar', () => {
    const texto = armarMensajeSolicitud({
      nombre: 'Bodas Planner',
      email: 'patty@ejemplo.com',
      telefono: '+528111111111',
      tipoDeCuenta: 'planner',
      planActual: 'free',
      sello: null,
      eventosVigentes: 2,
      personasEnEvento: 151,
      motivo: 'invitados',
      eventosAlAno: '12',
      tipoDeEventos: 'Bodas',
      tamanoDeEquipo: '3',
      contactoPreferido: 'WhatsApp',
      ciudad: 'Monterrey',
      mensaje: 'Necesito mas invitados',
    })
    expect(texto).toContain('patty@ejemplo.com')
    expect(texto).toContain('planner')
    expect(texto).toContain('free')
    expect(texto).toContain('151')
    expect(texto).toContain('+528111111111')
  })
})
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- solicitud
```

- [ ] **Paso 3: Escribir el armador del mensaje**

`lib/solicitud/mensaje.ts`:

```ts
export interface DatosSolicitud {
  nombre: string; email: string; telefono: string
  tipoDeCuenta: string; planActual: string; sello: string | null
  eventosVigentes: number; personasEnEvento: number
  motivo: 'eventos' | 'invitados'
  eventosAlAno: string; tipoDeEventos: string; tamanoDeEquipo: string
  contactoPreferido: string; ciudad: string; mensaje: string
}

export function armarMensajeSolicitud(d: DatosSolicitud): string {
  return [
    'SOLICITUD DE ACCESO',
    'Correo: ' + d.email,
    'Nombre: ' + d.nombre,
    'Tipo de cuenta: ' + d.tipoDeCuenta,
    'Plan actual: ' + d.planActual + (d.sello ? ' (' + d.sello + ')' : ''),
    'Tope que topo: ' + d.motivo,
    'Eventos vigentes: ' + d.eventosVigentes,
    'Personas en el evento: ' + d.personasEnEvento,
    'Eventos al ano: ' + d.eventosAlAno,
    'Tipo de eventos: ' + d.tipoDeEventos,
    'Tamano de equipo: ' + d.tamanoDeEquipo,
    'Contactar por: ' + d.contactoPreferido,
    'WhatsApp: ' + d.telefono,
    'Ciudad: ' + d.ciudad,
    'Mensaje: ' + (d.mensaje || 'sin mensaje'),
  ].join('\n')
}
```

- [ ] **Paso 4: La ruta**

`app/api/solicitud-acceso/route.ts`: valida sesión, arma el mensaje con `armarMensajeSolicitud` y lo manda al bot de soporte con el mismo `fetch` que usa `app/api/feedback/route.ts`. Responde `{ ok: true }`.

- [ ] **Paso 5: El modal**

`app/components/MuroModal.tsx`, con el primitivo `Modal` del proyecto:

- Título según el motivo: "Llegaste al tope de la cuenta gratis".
- Una línea: "Con tu cuenta puedes llevar un evento a la vez, con hasta 50 invitados."
- Los tres planes de paga con nombre, precio y asientos, leídos de `PLANES`. Sin botón de pago.
- Botones: `Solicitar acceso` (teal, a la derecha) y `Ahora no`.
- Al pedir acceso, el formulario del spec: nombre, eventos al año, tipo de eventos, tamaño de equipo, cómo contactarlo, WhatsApp con `PhoneInput`, correo precargado, ciudad y un mensaje libre.
- Al enviar: "Listo, te escribimos hoy mismo."

- [ ] **Paso 6: Verificar**

```bash
npm test
npm run build
```

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat(muro): aviso de tope con los planes y solicitud de acceso"
```

---

## Task 8: La pared de eventos en el dashboard

**Files:**
- Modify: `app/components/NewEventModal.tsx` (el `insert` está en las líneas 119-138)
- Modify: `app/dashboard/page.tsx`
- Modify: `app/events/[id]/layout.tsx`
- Modify: `app/events/[id]/configuracion/page.tsx`

**Interfaces:**
- Consumes: `fetchAccountCapacity`, `esErrorDeCupo` (`lib/capacity.ts`), `estadoEvento`, `esArchivado` (`lib/events/estado.ts`), `<MuroModal>`.
- Produces: nada que otra tarea consuma.

- [ ] **Paso 1: El modal de evento nuevo consulta antes de crear**

Antes del `insert` de la línea 119:

```ts
const cupo = await fetchAccountCapacity(user.id)
if (cupo && cupo.lim !== null && cupo.remaining !== null && cupo.remaining <= 0) {
  setMuro({ motivo: 'eventos', limite: cupo.lim })
  setSaving(false)
  return
}
```

Y después del `insert`, por si alguien trae dos pestañas abiertas:

```ts
if (esErrorDeCupo(error)) {
  const datos = parseLimitError(error!.message)!
  setMuro({ motivo: 'eventos', limite: datos.limit })
  return
}
```

- [ ] **Paso 2: El dashboard con tres pestañas**

`Activos` / `Pasados` / `Archivados`, derivadas con `estadoEvento(evento, new Date())`. El menú de cada evento ofrece Archivar o Reactivar. El botón de evento nuevo **no se esconde** cuando no hay cupo: abre el aviso.

- [ ] **Paso 3: Reactivar pasa por la pared**

Reactivar hace `update` de `event_status` a `active`. Si la base lo rechaza, `esErrorDeCupo` abre el aviso.

- [ ] **Paso 4: El banner del evento archivado**

En `app/events/[id]/layout.tsx`, banner sticky arriba del contenido: "Este evento está archivado. Solo lectura." con botón Reactivar, visible solo para el dueño. Y en el contexto de acceso, `canEdit` en falso cuando el evento está archivado.

- [ ] **Paso 5: El control de estatus en configuración**

En `app/events/[id]/configuracion/page.tsx`, el selector de estatus pasa de cuatro valores a dos: Activo y Archivado.

- [ ] **Paso 6: Verificar a mano y con build**

```bash
npm test
npm run build
```

Recorrido local: crear un segundo evento con una cuenta free abre el aviso; archivar libera el lugar; reactivar con el lugar ocupado vuelve a abrirlo.

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat(muro): pared de eventos, pestanas y banner de archivado"
```

---

## Task 9: La pared de invitados en la lista

**Files:**
- Modify: `app/events/[id]/page.tsx` (alta individual ~1218, importación CSV ~1317, acompañantes ~962, ~1108, ~1223, ~1320)
- Modify: `app/events/[id]/mesas/page.tsx` (~1422)

**Interfaces:**
- Consumes: `contarPersonas`, `lugaresLibres`, `cuantasCaben`, `esErrorDeInvitados` (`lib/invitados/cupo.ts`), `limiteInvitados` (`lib/workspace/sello.ts`), `<MuroModal motivo="invitados">`.
- Produces: nada que otra tarea consuma.

**El límite es el del dueño del evento, no el de quien está escribiendo.** La página ya carga el evento; el plan y el sello del dueño se piden junto con él.

- [ ] **Paso 1: El contador siempre visible**

Arriba de la lista, junto al título: `32 de 50 invitados` cuando hay límite, y solo el número cuando no lo hay. Se calcula con `contarPersonas(guests.length, partyMembers.length)`.

- [ ] **Paso 2: El alta individual**

Antes de insertar, en `submitAddGuest`:

```ts
const personas = contarPersonas(guests.length, partyMembers.length)
const porAgregar = 1 + nuevosAcompanantes.length
const { sobran } = cuantasCaben(porAgregar, personas, limiteDelEvento)
if (sobran > 0) {
  setMuro({ motivo: 'invitados', limite: limiteDelEvento! })
  return
}
```

Y después del `insert`, el mismo aviso si la base lo rechaza:

```ts
if (esErrorDeInvitados(error)) {
  const datos = parseErrorInvitados(error!.message)!
  setMuro({ motivo: 'invitados', limite: datos.limite })
  return
}
```

- [ ] **Paso 3: La importación corta, no rechaza**

Con `cuantasCaben(filas.length, personas, limite)`: se insertan las que caben y el resumen dice, sin rodeos, cuántas quedaron fuera y por qué. Nunca se rechaza el archivo completo.

- [ ] **Paso 4: Los acompañantes cuentan igual**

Los cuatro lugares donde se agregan acompañantes (edición de invitado, alta en lote, alta junto con el invitado, y el modal de Mesas) pasan por la misma revisión.

- [ ] **Paso 5: Verificar a mano**

```bash
npm test
npm run build
```

Recorrido local con una cuenta free: llegar a 50 entre invitados y acompañantes, ver el contador, intentar agregar uno más, importar un archivo de 200 filas con 18 lugares libres.

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "feat(muro): pared de invitados con contador y corte en la importacion"
```

---

## Task 10: Un cliente por evento

**Files:**
- Modify: `app/api/workspace/clientes/route.ts`
- Modify: `lib/workspace/invitacion.ts`, `lib/workspace/invitacion.test.ts`
- Modify: `app/events/[id]/configuracion/page.tsx` (`guardarPermisos`)

**Interfaces:**
- Consumes: `validarCliente` de `lib/workspace/invitacion.ts`.
- Produces: `validarCliente` rechaza el segundo cliente del evento; `topeDeCliente(permisos)` recorta `total` a `editar`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

En `lib/workspace/invitacion.test.ts`:

```ts
it('un evento solo admite un cliente', () => {
  const v = validarCliente({
    email: 'otro@ejemplo.com',
    eventId: 'e1',
    colaboradores: [
      { email: 'novia@ejemplo.com', event_id: 'e1', tipo: 'cliente', status: 'active' },
    ],
    miembros: [],
  })
  expect(v.ok).toBe(false)
  expect(v.error).toContain('ya tiene un cliente')
})

it('un cliente revocado deja libre el lugar', () => {
  const v = validarCliente({
    email: 'otro@ejemplo.com',
    eventId: 'e1',
    colaboradores: [
      { email: 'novia@ejemplo.com', event_id: 'e1', tipo: 'cliente', status: 'revoked' },
    ],
    miembros: [],
  })
  expect(v.ok).toBe(true)
})

it('el cliente nunca llega a total', () => {
  expect(topeDeCliente({ invitados: 'total', mesas: 'ver' }).invitados).toBe('editar')
})
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- invitacion
```

- [ ] **Paso 3: Implementar**

En `validarCliente`, antes de devolver `ok`, contar los clientes vivos de ese evento:

```ts
const clientesDelEvento = p.colaboradores.filter(
  c => c.event_id === p.eventId && c.tipo === 'cliente' && c.status !== 'revoked',
)
if (clientesDelEvento.length > 0) {
  return falla('Este evento ya tiene un cliente. Quita el acceso del actual para invitar a otro')
}
```

Y `topeDeCliente(permisos)`, que devuelve los mismos permisos con cada `total` convertido en `editar`. La ruta de alta lo aplica siempre, venga lo que venga en el cuerpo.

- [ ] **Paso 4: La pantalla de permisos respeta el tope**

En `guardarPermisos` de `app/events/[id]/configuracion/page.tsx`, cuando el colaborador es de tipo `cliente`, se guarda `topeDeCliente(borrador)` y el editor no ofrece la opción "Total" para ese renglón.

- [ ] **Paso 5: Verificar**

```bash
npm test
npm run build
```

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "feat(accesos): un cliente por evento y tope de editar"
```

---

## Task 11: El plan y el sello donde el usuario los ve

**Files:**
- Modify: `app/configuracion/page.tsx` (~79 y ~155), `app/configuracion/layout.tsx` (~453)
- Modify: `app/configuracion/perfil/page.tsx`
- Modify: `app/api/workspace/route.ts` (devolver el sello junto al plan)

**Interfaces:**
- Consumes: `etiquetaPlan`, `normalizarSello`.
- Produces: nada.

- [ ] **Paso 1: El sello viaja con el workspace**

`app/api/workspace/route.ts` ya devuelve `plan`; agregar `sello`, leído de la misma fila.

- [ ] **Paso 2: El chip**

Donde hoy se muestra `etiquetaPlan(activo.plan)`, cuando hay sello el chip dice `Partner fundador` en dorado (`#b98d2e` sobre `#fdf8ec`), y cuando no, el nombre del plan como hoy.

- [ ] **Paso 3: El trato completo en el perfil**

En `app/configuracion/perfil/page.tsx`, una línea bajo el nombre: el plan, y si hay sello: "Partner fundador · sin costo mientras no cobramos. Al empezar, 40% el primer año."

- [ ] **Paso 4: Verificar**

```bash
npm run build
```

- [ ] **Paso 5: Commit**

```bash
git add -A
git commit -m "feat(workspace): chip de plan y sello de partner en su cuenta"
```

---

## Task 12: El SQL

**Files:**
- Create: `supabase/2026-09-20-planes-y-muros.sql`
- Delete: `supabase/2026-08-19-muro-eventos.sql` (se reemplaza por completo)

**Interfaces:**
- Consumes: nada.
- Produces: el archivo que Diego corre **después** de que el código esté en producción.

**No se corre nada en Supabase desde aquí.** El archivo se escribe, se revisa y se entrega cuando el deploy esté verificado.

- [ ] **Paso 1: Bloque 0, verificación previa**

Consultas de solo lectura que el propio archivo corre antes de cambiar nada, y que abortan si algo no cuadra: ¿existe un CHECK sobre `events.event_status` que impida el valor `archived`? ¿cuántos eventos se van a archivar? ¿alguna cuenta en `pro` tiene más de un asiento ocupado?

- [ ] **Paso 2: El sello**

```sql
alter table public.workspaces add column if not exists sello text
  check (sello is null or sello = 'fundador');
alter table public.workspaces add column if not exists sello_desde date;
```

Y el disparador que impide que alguien se lo ponga solo: la misma forma del candado de `users.plan` del 17 de septiembre, que deja pasar solo cuando `auth.uid()` es nulo, es decir, service role.

- [ ] **Paso 3: El cupo de eventos**

Función `limite_de_eventos(uid)` que lee plan y sello del workspace del dueño, y un trigger `before insert or update` en `events` que levanta `EVENT_LIMIT_EXCEEDED:<activos>:<limite>` cuando el evento entra a contar: al crearse, al reactivarse, o al mover la fecha hacia el futuro. Nunca al editar.

- [ ] **Paso 4: El cupo de invitados**

Trigger `before insert` en `guests` y en `party_members` que cuenta personas del evento y levanta `INVITADOS_LIMITE:<personas>:<limite>`. **Solo actúa cuando `auth.uid()` no es nulo**, para que el registro público y las respuestas por WhatsApp o Telegram nunca se rechacen.

- [ ] **Paso 5: Solo lectura del evento archivado**

`evento_editable(event_id)` y el trigger genérico sobre las tablas hijas, con la misma condición de sesión presente. Las tablas que no cuelgan directo de `event_id` (`supplier_payments`, `gift_reservations`) resuelven el evento con un join; si alguna no sale limpia, se anota como hueco conocido y se queda cubierta solo por la interfaz.

- [ ] **Paso 6: La migración de estatus**

```sql
update events set event_status = 'archived'
 where event_status in ('paused', 'cancelled', 'completed');
```

- [ ] **Paso 7: Verificación y reversa**

Al final del archivo, las consultas que confirman que quedó bien, y comentado, el bloque para revertir cada pieza.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "docs(muro): sql de planes, sello y muros"
```

---

## Orden y qué se cae si no llegamos

1. Tareas 1 a 4 son cimiento: sin ellas no hay nada. Van primero y seguidas.
2. Tareas 5 y 6 dejan a Diego operando: puede asignar planes y sellos aunque las paredes no existan.
3. Tarea 7 es el aviso, que las dos paredes necesitan.
4. Tareas 8 y 9 son las paredes. La 9 es la más riesgosa: toca la pantalla más usada.
5. Tarea 10 cierra el hueco de clientes; es independiente de todo lo demás y puede ir en cualquier momento.
6. Tarea 11 es la que se cae si el tiempo aprieta: es la única que no cambia comportamiento.
7. Tarea 12 se escribe al final y se entrega después del deploy.

## Antes del deploy, del lado de Diego

- Subir a Pro, a mano en `/admin`: `mauriciolopez940@gmail.com`, `ambrozzia.eventos@gmail.com`, `aechevarria128@gmail.com`, `fernando.slo771@gmail.com`. Se regresan a Free cuando pase su evento.
- Poner el sello de partner fundador a `bodasplanner@hotmail.com`.
- Revisar que su propia cuenta (`diego.garza@moonlaunch.mx`, hoy en `agency`) quede sin topes.
