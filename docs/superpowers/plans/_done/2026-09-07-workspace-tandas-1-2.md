# Tramo 5 — El workspace, tandas 1 y 2: cimiento y /cuenta/equipo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueno de un workspace vea a su equipo, cuente asientos, agregue personas con bodas y permisos en tres pasos, invite clientes, y que un solo enlace de aceptacion active todo. Sin selector de workspace, sin Stripe, sin transferir.

**Architecture:** `workspaces` y `workspace_members` ya existen (Tramo 1). La tanda 1 agrega el catalogo de planes y la logica pura de asientos e invitacion en `lib/workspace/` (Vitest), seis columnas en `workspaces`, y mueve la lectura del plan de `users.plan` al workspace. La tanda 2 pone la pantalla `/cuenta/equipo` y sus modales; **toda escritura pasa por rutas de API con service role y un candado** (patron de `/api/actividad/restaurar`), y un disparador cuida los invariantes del dueno principal. El codigo tolera que el SQL no haya corrido.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (browser client + service role en rutas), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-workspace-tramo5-design.md` (§2, §3.1-3.6, §4, §5, §6, §7, §10 tandas 1 y 2)

**Mockup aprobado:** https://claude.ai/code/artifact/56e4c7a5-358e-4184-8287-ffb7ec080d6d (secciones 1 y 5)

**Rama:** `feat/workspace-tramo5`, worktree `C:\Users\diego\Documents\anfiora-workspace`, cortada de `origin/main` (08621d2). Dev en un puerto libre (verificar con `netstat -ano | findstr :300`); **nunca 3000 ni 3001**.

## Global Constraints

- **El codigo va a produccion ANTES que el SQL.** Cada lectura de columnas nuevas tolera que no existan (`select('*')` y defaults en el codigo). Los `.sql` se escriben y se commitean en `docs/superpowers/plans/sql/`; **nunca se corren**. Los corre Diego despues del deploy.
- **En la interfaz se dice "workspace", nunca "despacho".** En el codigo tambien `workspace`.
- **Free no invita equipo.** `puedeInvitar('free', n)` devuelve `{ ok: false, motivo: 'plan' }`. Cliente si.
- **El asiento se ocupa al invitar**: cuentan `pending` y `active`.
- **Nadie escribe en `workspaces` ni `workspace_members` desde el navegador.** Solo rutas de API con service role.
- No correr `npm run build` con el dev server arriba. Verificar con `npx tsc --noEmit` y `npm test`; `npm run build` solo antes del PR.
- UI en espanol **con acentos**. Commits **sin acentos ni enye**. Sin emojis. Solo Tailwind. Iconos `lucide-react`. CTA teal `#48C9B0`. Negro `#1D1E20` solo en dropdowns de filtro.
- Lo que se prueba con Vitest **no importa `@/lib/supabase`**.
- No tocar Supabase por ningun medio. No `git push` sin permiso. Nunca `git add -A`: hay otros agentes en el repo.
- Cada tarea termina con `npx tsc --noEmit` limpio y `npm test` verde.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/workspace/planes.ts` (crear) | Catalogo `PLANES`, `PlanId`, `normalizarPlan` (studio -> pro), `incluyeHerramienta`. Fuente unica del precio y los asientos incluidos. |
| `lib/workspace/planes.test.ts` (crear) | Pruebas del catalogo. |
| `lib/workspace/asientos.ts` (crear) | Puro: contar, extra, costo, `puedeInvitar`, `resumenAsientos`. |
| `lib/workspace/asientos.test.ts` (crear) | Pruebas. |
| `lib/workspace/invitacion.ts` (crear) | Puro: `kitDesde`, `filasDeAlta`, `validarAltaEquipo`, `validarCliente`, `filasParaActivar`. |
| `lib/workspace/invitacion.test.ts` (crear) | Pruebas. |
| `lib/workspace/tipos.ts` (crear) | Tipos compartidos entre rutas y pantallas: `Miembro`, `Cliente`, `BodaDelWorkspace`, `WorkspaceResumen`, `RolWorkspace`. |
| `lib/workspace/servidor.ts` (crear) | Solo servidor: `clienteAdmin()`, `usuarioDeRequest(req)`, `rolEnWorkspace()`. Lo importan las rutas. |
| `lib/workspace/cliente.ts` (crear) | Navegador: `misWorkspacesAdministrados()` (para el menu) y `fetchWorkspace()` con Bearer. |
| `lib/billing.ts` (modificar) | `PLAN_PRICES` sale de `PLANES`. |
| `lib/admin/change-plan.ts` (modificar) | `VALID_PLANS` sale de `PLAN_IDS`. |
| `app/api/admin/update-plan/route.ts` (modificar) | Escribe `users.plan` (legado) y `workspaces.plan` via `asegurar_workspace`; tolera que el SQL no haya corrido. |
| `app/api/admin/users/route.ts` (modificar) | Trae `plan` del workspace con respaldo a `users.plan`. |
| `lib/event-access-context.tsx` (modificar) | `rolCuenta` sale de `workspace_members` tambien cuando eres dueno del evento. |
| `docs/superpowers/plans/sql/2026-09-08-workspace-cimiento.sql` (crear) | Columnas, `es_admin_de`, `asegurar_workspace`, guard endurecido, `guard_workspace_members`, `plan_del_evento`, migracion del plan. |
| `app/api/workspace/route.ts` (crear) | GET: mis workspaces administrados + el activo con miembros, clientes, bodas y asientos. |
| `app/api/workspace/miembros/route.ts` (crear) | POST: alta de tres pasos. |
| `app/api/workspace/miembros/[id]/route.ts` (crear) | PATCH rol/bodas/permisos; DELETE revocar. |
| `app/api/workspace/clientes/route.ts` (crear) | POST: invitar cliente. |
| `app/api/invite/[token]/route.ts` (modificar) | Aprende el token de miembro (GET y POST). |
| `app/invite/[token]/page.tsx` (modificar) | Pinta la invitacion de workspace y aterriza en la primera boda. |
| `app/cuenta/layout.tsx` (crear) | Cascara: header, candado dueno/admin, contexto del workspace, pestanas. |
| `app/cuenta/WorkspaceContext.tsx` (crear) | `useWorkspace()`: activo, lista, recargar. |
| `app/cuenta/page.tsx` (crear) | Redirige a `/cuenta/equipo`. |
| `app/cuenta/equipo/page.tsx` (crear) | Asientos, lista de miembros, clientes, botones. |
| `app/components/workspace/AltaPersonaModal.tsx` (crear) | Persona -> bodas -> permisos. Reusado por Configuracion con `bodaFija`. |
| `app/components/workspace/InvitarClienteModal.tsx` (crear) | Correo, boda, punto de partida. |
| `app/components/workspace/FichaMiembroModal.tsx` (crear) | Rol, bodas y permisos, copiar enlace, revocar. |
| `app/dashboard/page.tsx` (modificar) | Entrada "Mi workspace" en el header si administras alguno. |
| `app/events/[id]/layout.tsx` (modificar) | Misma entrada en el menu del avatar. |
| `app/events/[id]/configuracion/page.tsx` (modificar) | La columna de invitar se vuelve dos botones que abren los modales. |
| `docs/superpowers/plans/sql/2026-09-08-workspace-equipo.sql` (crear) | Migracion: equipo de boda sin asiento -> miembro. |

---

## Tanda 1 — Cimiento y catalogo (nada visible cambia)

### Task 1: Catalogo de planes

**Files:**
- Create: `lib/workspace/planes.ts`
- Test: `lib/workspace/planes.test.ts`

**Interfaces:**
- Produces: `PLAN_IDS`, `type PlanId`, `interface Plan`, `PLANES: Record<PlanId, Plan>`, `PRECIO_ASIENTO_EXTRA`, `normalizarPlan(raw: unknown): PlanId`, `planDe(id: PlanId): Plan`, `incluyeHerramienta(plan: PlanId, modulo: Modulo): boolean`, `etiquetaPlan(id: PlanId): string`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/workspace/planes.test.ts
import { describe, it, expect } from 'vitest'
import { MODULOS } from '@/lib/permisos/catalogo'
import {
  PLANES, PLAN_IDS, PRECIO_ASIENTO_EXTRA,
  normalizarPlan, planDe, incluyeHerramienta, etiquetaPlan,
} from './planes'

describe('catalogo de planes', () => {
  it('tiene exactamente tres planes en orden', () => {
    expect(PLAN_IDS).toEqual(['free', 'pro', 'agency'])
  })

  it('Free es solo el dueno, sin Actividad, una boda activa', () => {
    const f = PLANES.free
    expect(f.precio).toBe(0)
    expect(f.asientosIncluidos).toBe(1)
    expect(f.ventanaActividadDias).toBe(0)
    expect(f.bodasActivas).toBe(1)
    expect(f.importExport).toBe(false)
    expect(f.whitelabel).toBe(false)
  })

  it('Pro incluye 1 asiento y Agency 3, extra a 290', () => {
    expect(PLANES.pro.precio).toBe(990)
    expect(PLANES.pro.asientosIncluidos).toBe(1)
    expect(PLANES.agency.precio).toBe(1990)
    expect(PLANES.agency.asientosIncluidos).toBe(3)
    expect(PLANES.agency.whitelabel).toBe(true)
    expect(PRECIO_ASIENTO_EXTRA).toBe(290)
  })

  it('Pro y Agency traen los doce modulos; Free no trae invitacion, mensajes ni regalos', () => {
    expect([...PLANES.pro.herramientas]).toEqual([...MODULOS])
    expect([...PLANES.agency.herramientas]).toEqual([...MODULOS])
    expect(incluyeHerramienta('free', 'invitacion')).toBe(false)
    expect(incluyeHerramienta('free', 'mensajes')).toBe(false)
    expect(incluyeHerramienta('free', 'regalos')).toBe(false)
    expect(incluyeHerramienta('free', 'invitados')).toBe(true)
    expect(incluyeHerramienta('free', 'pagos')).toBe(true)
    expect(incluyeHerramienta('pro', 'invitacion')).toBe(true)
  })

  it('normaliza lo que venga de la base', () => {
    expect(normalizarPlan('pro')).toBe('pro')
    expect(normalizarPlan(' Agency ')).toBe('agency')
    expect(normalizarPlan('studio')).toBe('pro')
    expect(normalizarPlan('solo')).toBe('free')
    expect(normalizarPlan(null)).toBe('free')
    expect(normalizarPlan(undefined)).toBe('free')
    expect(normalizarPlan(42)).toBe('free')
  })

  it('planDe y etiqueta', () => {
    expect(planDe('agency').nombre).toBe('Agency')
    expect(etiquetaPlan('free')).toBe('Free')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/workspace/planes.test.ts`
Expected: FAIL, `Cannot find module './planes'`

- [ ] **Step 3: Write the catalog**

```ts
// lib/workspace/planes.ts
import { MODULOS, type Modulo } from '@/lib/permisos/catalogo'

export const PLAN_IDS = ['free', 'pro', 'agency'] as const
export type PlanId = typeof PLAN_IDS[number]

export interface Plan {
  id: PlanId
  nombre: string
  precio: number
  asientosIncluidos: number
  // 0 = sin Actividad; null = sin limite
  ventanaActividadDias: number | null
  // null = ilimitadas
  bodasActivas: number | null
  importExport: boolean
  whitelabel: boolean
  herramientas: readonly Modulo[]
}

const HERRAMIENTAS_FREE: readonly Modulo[] = [
  'invitados', 'mesas', 'timeline', 'presupuesto', 'proveedores', 'pagos',
  'album', 'playlist', 'vestimenta',
]

export const PLANES: Record<PlanId, Plan> = {
  free: {
    id: 'free', nombre: 'Free', precio: 0, asientosIncluidos: 1,
    ventanaActividadDias: 0, bodasActivas: 1, importExport: false, whitelabel: false,
    herramientas: HERRAMIENTAS_FREE,
  },
  pro: {
    id: 'pro', nombre: 'Pro', precio: 990, asientosIncluidos: 1,
    ventanaActividadDias: 30, bodasActivas: null, importExport: true, whitelabel: false,
    herramientas: MODULOS,
  },
  agency: {
    id: 'agency', nombre: 'Agency', precio: 1990, asientosIncluidos: 3,
    ventanaActividadDias: null, bodasActivas: null, importExport: true, whitelabel: true,
    herramientas: MODULOS,
  },
}

export const PRECIO_ASIENTO_EXTRA = 290

// 'studio' es el catalogo de junio (3 asientos, 25 eventos): hoy equivale a Pro.
// 'solo' y cualquier otro valor caen a Free.
const ALIAS: Record<string, PlanId> = { studio: 'pro' }

export function normalizarPlan(raw: unknown): PlanId {
  if (typeof raw !== 'string') return 'free'
  const v = raw.trim().toLowerCase()
  if ((PLAN_IDS as readonly string[]).includes(v)) return v as PlanId
  return ALIAS[v] ?? 'free'
}

export function planDe(id: PlanId): Plan {
  return PLANES[id]
}

export function incluyeHerramienta(plan: PlanId, modulo: Modulo): boolean {
  return PLANES[plan].herramientas.includes(modulo)
}

export function etiquetaPlan(id: PlanId): string {
  return PLANES[id].nombre
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/workspace/planes.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/planes.ts lib/workspace/planes.test.ts
git commit -m "feat(workspace): catalogo de planes con asientos y herramientas"
```

---

### Task 2: Asientos

**Files:**
- Create: `lib/workspace/asientos.ts`
- Test: `lib/workspace/asientos.test.ts`

**Interfaces:**
- Consumes: `PLANES`, `PRECIO_ASIENTO_EXTRA`, `PlanId` de Task 1.
- Produces: `contarAsientos(miembros: { status: string }[]): number`, `asientosExtra(plan, ocupados): number`, `costoAsientosExtra(plan, ocupados): number`, `puedeInvitar(plan, ocupados): { ok: boolean; motivo: 'plan' | null; costoNuevoAsiento: number }`, `resumenAsientos(plan, miembros): { ocupados, incluidos, extra, costoExtraMensual }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/workspace/asientos.test.ts
import { describe, it, expect } from 'vitest'
import {
  contarAsientos, asientosExtra, costoAsientosExtra, puedeInvitar, resumenAsientos,
} from './asientos'

const m = (status: string) => ({ status })

describe('asientos', () => {
  it('cuenta pendientes y activos, no revocados', () => {
    expect(contarAsientos([m('active'), m('pending'), m('revoked')])).toBe(2)
    expect(contarAsientos([])).toBe(0)
  })

  it('extra y costo por plan', () => {
    expect(asientosExtra('pro', 1)).toBe(0)
    expect(asientosExtra('pro', 3)).toBe(2)
    expect(asientosExtra('agency', 3)).toBe(0)
    expect(asientosExtra('agency', 5)).toBe(2)
    expect(costoAsientosExtra('pro', 3)).toBe(580)
    expect(costoAsientosExtra('agency', 3)).toBe(0)
  })

  it('Free no invita equipo', () => {
    expect(puedeInvitar('free', 1)).toEqual({ ok: false, motivo: 'plan', costoNuevoAsiento: 0 })
  })

  it('Pro invita; el segundo asiento cuesta', () => {
    expect(puedeInvitar('pro', 1)).toEqual({ ok: true, motivo: null, costoNuevoAsiento: 290 })
    expect(puedeInvitar('pro', 0)).toEqual({ ok: true, motivo: null, costoNuevoAsiento: 0 })
  })

  it('Agency: los tres primeros gratis', () => {
    expect(puedeInvitar('agency', 2).costoNuevoAsiento).toBe(0)
    expect(puedeInvitar('agency', 3).costoNuevoAsiento).toBe(290)
  })

  it('resumen para la pantalla', () => {
    expect(resumenAsientos('pro', [m('active'), m('active'), m('pending'), m('revoked')]))
      .toEqual({ ocupados: 3, incluidos: 1, extra: 2, costoExtraMensual: 580 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/workspace/asientos.test.ts`
Expected: FAIL, `Cannot find module './asientos'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/workspace/asientos.ts
import { PLANES, PRECIO_ASIENTO_EXTRA, type PlanId } from './planes'

// El asiento se ocupa al invitar: una invitacion pendiente ya cuenta.
export function contarAsientos(miembros: { status: string }[]): number {
  return miembros.filter(m => m.status === 'pending' || m.status === 'active').length
}

export function asientosExtra(plan: PlanId, ocupados: number): number {
  return Math.max(0, ocupados - PLANES[plan].asientosIncluidos)
}

export function costoAsientosExtra(plan: PlanId, ocupados: number): number {
  return asientosExtra(plan, ocupados) * PRECIO_ASIENTO_EXTRA
}

export interface PermisoDeInvitar {
  ok: boolean
  motivo: 'plan' | null
  costoNuevoAsiento: number
}

export function puedeInvitar(plan: PlanId, ocupados: number): PermisoDeInvitar {
  if (plan === 'free') return { ok: false, motivo: 'plan', costoNuevoAsiento: 0 }
  const cuesta = ocupados + 1 > PLANES[plan].asientosIncluidos
  return { ok: true, motivo: null, costoNuevoAsiento: cuesta ? PRECIO_ASIENTO_EXTRA : 0 }
}

export function resumenAsientos(plan: PlanId, miembros: { status: string }[]) {
  const ocupados = contarAsientos(miembros)
  return {
    ocupados,
    incluidos: PLANES[plan].asientosIncluidos,
    extra: asientosExtra(plan, ocupados),
    costoExtraMensual: costoAsientosExtra(plan, ocupados),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/workspace/asientos.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/asientos.ts lib/workspace/asientos.test.ts
git commit -m "feat(workspace): conteo y costo de asientos por plan"
```

---
### Task 3: Tipos y logica pura de invitacion

**Files:**
- Create: `lib/workspace/tipos.ts`
- Create: `lib/workspace/invitacion.ts`
- Test: `lib/workspace/invitacion.test.ts`

**Interfaces:**
- Consumes: `PermisosEvento`, `Nivel`, `MODULOS` de `@/lib/permisos/catalogo`; `normalizarPermisos` de `@/lib/permisos/resolver`.
- Produces (tipos.ts): `RolWorkspace = 'dueno' | 'admin' | 'colaborador'`, `RolInvitable = 'admin' | 'colaborador'`, `StatusMiembro`, `BodaDelWorkspace`, `Miembro`, `Cliente`, `WorkspaceResumen`, `ROL_LABEL`.
- Produces (invitacion.ts): `nivelMayor(a, b): Nivel`, `kitDesde(filas): PermisosEvento`, `filasDeAlta(p): { miembro, colaboradores }`, `validarAltaEquipo(p): { ok, error }`, `validarCliente(p): { ok, error }`, `filasParaActivar(p): string[]`, `normalizarCorreo(s): string`.

- [ ] **Step 1: Write the shared types**

```ts
// lib/workspace/tipos.ts
import type { FeatureKey } from '@/lib/features'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import type { PlanId } from './planes'

export type RolWorkspace = 'dueno' | 'admin' | 'colaborador'
export type RolInvitable = 'admin' | 'colaborador'
export type StatusMiembro = 'pending' | 'active' | 'revoked'

export const ROL_LABEL: Record<RolWorkspace, string> = {
  dueno: 'Dueño',
  admin: 'Administrador',
  colaborador: 'Colaborador',
}

export interface BodaDelWorkspace {
  id: string
  name: string
  event_date: string | null
  event_status: string | null
  features: Record<FeatureKey, boolean>
}

export interface BodaDeMiembro {
  eventId: string
  name: string
  collaboratorId: string
  status: StatusMiembro
  permisos: PermisosEvento
}

export interface Miembro {
  id: string
  email: string
  user_id: string | null
  nombre: string | null
  rol: RolWorkspace
  es_dueno_principal: boolean
  status: StatusMiembro
  invite_token: string | null
  invited_at: string
  accepted_at: string | null
  bodas: BodaDeMiembro[]
}

export interface Cliente {
  id: string
  email: string
  user_id: string | null
  status: StatusMiembro
  invite_token: string | null
  eventId: string
  eventName: string
  permisos: PermisosEvento
}

export interface WorkspaceResumen {
  id: string
  name: string
  plan: PlanId
  miRol: RolWorkspace
  esDuenoPrincipal: boolean
  miembros: Miembro[]
  clientes: Cliente[]
  bodas: BodaDelWorkspace[]
}

export interface WorkspaceListado {
  id: string
  name: string
  plan: PlanId
  miRol: RolWorkspace
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// lib/workspace/invitacion.test.ts
import { describe, it, expect } from 'vitest'
import {
  nivelMayor, kitDesde, filasDeAlta, validarAltaEquipo, validarCliente,
  filasParaActivar, normalizarCorreo,
} from './invitacion'

describe('nivelMayor y kit', () => {
  it('escoge el nivel mas alto', () => {
    expect(nivelMayor('ver', 'editar')).toBe('editar')
    expect(nivelMayor('total', 'ninguno')).toBe('total')
    expect(nivelMayor('ninguno', 'ninguno')).toBe('ninguno')
  })

  it('el kit es el maximo por modulo de lo que ya tiene en otras bodas', () => {
    const kit = kitDesde([
      { permisos: { invitados: 'ver', mesas: 'editar' } },
      { permisos: { invitados: 'total', pagos: 'ver' } },
      { permisos: null },
    ])
    expect(kit).toEqual({ invitados: 'total', mesas: 'editar', pagos: 'ver' })
  })

  it('kit vacio si no hay filas', () => {
    expect(kitDesde([])).toEqual({})
  })
})

describe('filasDeAlta', () => {
  const base = {
    workspaceId: 'ws1', email: '  Regina@Moonlaunch.mx ', invitedBy: 'u-diego', token: 'tok',
  }

  it('colaboradora: miembro pendiente y una fila por boda, correo normalizado', () => {
    const r = filasDeAlta({
      ...base, rol: 'colaborador',
      bodas: [
        { eventId: 'e1', permisos: { mesas: 'editar' } },
        { eventId: 'e2', permisos: { pagos: 'ver' } },
      ],
    })
    expect(r.miembro).toEqual({
      workspace_id: 'ws1', email: 'regina@moonlaunch.mx', rol: 'colaborador',
      es_dueno_principal: false, status: 'pending', invite_token: 'tok',
      invited_by: 'u-diego', kit_habitual: { mesas: 'editar', pagos: 'ver' },
    })
    expect(r.colaboradores).toEqual([
      { event_id: 'e1', email: 'regina@moonlaunch.mx', invited_by: 'u-diego', status: 'pending',
        tipo: 'equipo', role: 'editor', permisos: { mesas: 'editar' } },
      { event_id: 'e2', email: 'regina@moonlaunch.mx', invited_by: 'u-diego', status: 'pending',
        tipo: 'equipo', role: 'viewer', permisos: { pagos: 'ver' } },
    ])
  })

  it('admin: entra por rol, sin filas de colaborador', () => {
    const r = filasDeAlta({ ...base, rol: 'admin', bodas: [{ eventId: 'e1', permisos: { mesas: 'editar' } }] })
    expect(r.miembro.rol).toBe('admin')
    expect(r.colaboradores).toEqual([])
    expect(r.miembro.kit_habitual).toBeNull()
  })

  it('una boda sin ningun modulo no produce fila', () => {
    const r = filasDeAlta({ ...base, rol: 'colaborador', bodas: [{ eventId: 'e1', permisos: {} }] })
    expect(r.colaboradores).toEqual([])
  })
})

describe('validaciones', () => {
  const miembros = [
    { email: 'daniela@moonlaunch.mx', status: 'active' },
    { email: 'juan@moonlaunch.mx', status: 'revoked' },
  ]

  it('equipo: rechaza correo invalido, ya miembro; acepta revocado', () => {
    expect(validarAltaEquipo({ email: 'nada', miembros })).toEqual({ ok: false, error: 'Escribe un correo válido' })
    expect(validarAltaEquipo({ email: 'Daniela@moonlaunch.mx', miembros }))
      .toEqual({ ok: false, error: 'Esa persona ya es de tu equipo' })
    expect(validarAltaEquipo({ email: 'juan@moonlaunch.mx', miembros })).toEqual({ ok: true, error: null })
  })

  it('cliente: una boda por correo en el workspace, y no si es del equipo', () => {
    const colaboradores = [
      { email: 'mafer@gmail.com', event_id: 'e1', tipo: 'cliente', status: 'active' },
      { email: 'vieja@gmail.com', event_id: 'e1', tipo: 'cliente', status: 'revoked' },
    ]
    expect(validarCliente({ email: 'mafer@gmail.com', eventId: 'e2', colaboradores, miembros }))
      .toEqual({ ok: false, error: 'Ese correo ya es cliente de otra boda. Un cliente solo tiene una' })
    expect(validarCliente({ email: 'mafer@gmail.com', eventId: 'e1', colaboradores, miembros }))
      .toEqual({ ok: false, error: 'Ese correo ya tiene acceso a esta boda' })
    expect(validarCliente({ email: 'daniela@moonlaunch.mx', eventId: 'e1', colaboradores, miembros }))
      .toEqual({ ok: false, error: 'Es de tu equipo: dale acceso desde su ficha' })
    expect(validarCliente({ email: 'vieja@gmail.com', eventId: 'e2', colaboradores, miembros }))
      .toEqual({ ok: true, error: null })
  })
})

describe('filasParaActivar', () => {
  it('solo las pendientes de ese correo en bodas del workspace', () => {
    const ids = filasParaActivar({
      email: 'Regina@moonlaunch.mx',
      colaboradores: [
        { id: 'c1', email: 'regina@moonlaunch.mx', status: 'pending', event_id: 'e1' },
        { id: 'c2', email: 'regina@moonlaunch.mx', status: 'active',  event_id: 'e2' },
        { id: 'c3', email: 'regina@moonlaunch.mx', status: 'pending', event_id: 'ajena' },
        { id: 'c4', email: 'otra@x.com',           status: 'pending', event_id: 'e1' },
      ],
      eventosDelWorkspace: ['e1', 'e2'],
    })
    expect(ids).toEqual(['c1'])
  })
})

describe('normalizarCorreo', () => {
  it('minusculas y sin espacios', () => {
    expect(normalizarCorreo('  A@B.com ')).toBe('a@b.com')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/invitacion.test.ts`
Expected: FAIL, `Cannot find module './invitacion'`

- [ ] **Step 4: Write the implementation**

```ts
// lib/workspace/invitacion.ts
import { MODULOS, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import { normalizarPermisos } from '@/lib/permisos/resolver'
import type { RolInvitable } from './tipos'

const ORDEN: Record<Nivel, number> = { ninguno: 0, ver: 1, editar: 2, total: 3 }
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizarCorreo(s: string): string {
  return (s || '').trim().toLowerCase()
}

export function nivelMayor(a: Nivel, b: Nivel): Nivel {
  return ORDEN[a] >= ORDEN[b] ? a : b
}

// El kit habitual es lo que la persona ya tiene en sus otras bodas: por modulo,
// el nivel mas alto que aparezca. Si no tiene nada, el kit es vacio y la
// pantalla precarga su propio punto de partida.
export function kitDesde(filas: { permisos: unknown }[]): PermisosEvento {
  const kit: PermisosEvento = {}
  for (const f of filas) {
    const p = normalizarPermisos(f.permisos)
    for (const m of MODULOS) {
      const n = p[m]
      if (!n || n === 'ninguno') continue
      kit[m] = nivelMayor(kit[m] ?? 'ninguno', n)
    }
  }
  return kit
}

function tieneAlgo(p: PermisosEvento): boolean {
  return MODULOS.some(m => p[m] && p[m] !== 'ninguno')
}

// `role` legado se sigue escribiendo como punto de partida: los helpers de
// Postgres (is_event_editor) todavia lo leen. editor si edita algo, viewer si no.
function roleLegado(p: PermisosEvento): 'editor' | 'viewer' {
  return MODULOS.some(m => p[m] === 'editar' || p[m] === 'total') ? 'editor' : 'viewer'
}

export interface BodaElegida { eventId: string; permisos: PermisosEvento }

export interface FilaMiembroNueva {
  workspace_id: string
  email: string
  rol: RolInvitable
  es_dueno_principal: false
  status: 'pending'
  invite_token: string
  invited_by: string
  kit_habitual: PermisosEvento | null
}

export interface FilaColaboradorNueva {
  event_id: string
  email: string
  invited_by: string
  status: 'pending'
  tipo: 'equipo'
  role: 'editor' | 'viewer'
  permisos: PermisosEvento
}

export function filasDeAlta(p: {
  workspaceId: string
  email: string
  rol: RolInvitable
  bodas: BodaElegida[]
  invitedBy: string
  token: string
}): { miembro: FilaMiembroNueva; colaboradores: FilaColaboradorNueva[] } {
  const email = normalizarCorreo(p.email)
  const conAlgo = p.rol === 'admin' ? [] : p.bodas
    .map(b => ({ eventId: b.eventId, permisos: normalizarPermisos(b.permisos) }))
    .filter(b => tieneAlgo(b.permisos))

  const colaboradores: FilaColaboradorNueva[] = conAlgo.map(b => ({
    event_id: b.eventId, email, invited_by: p.invitedBy, status: 'pending',
    tipo: 'equipo', role: roleLegado(b.permisos), permisos: b.permisos,
  }))

  const kit = p.rol === 'admin' ? null : kitDesde(conAlgo)

  return {
    miembro: {
      workspace_id: p.workspaceId, email, rol: p.rol, es_dueno_principal: false,
      status: 'pending', invite_token: p.token, invited_by: p.invitedBy, kit_habitual: kit,
    },
    colaboradores,
  }
}

export interface Validacion { ok: boolean; error: string | null }

const ok: Validacion = { ok: true, error: null }
const falla = (error: string): Validacion => ({ ok: false, error })

export function validarAltaEquipo(p: {
  email: string
  miembros: { email: string; status: string }[]
}): Validacion {
  const email = normalizarCorreo(p.email)
  if (!RE_CORREO.test(email)) return falla('Escribe un correo válido')
  const vivo = p.miembros.find(m => normalizarCorreo(m.email) === email && m.status !== 'revoked')
  if (vivo) return falla('Esa persona ya es de tu equipo')
  return ok
}

export function validarCliente(p: {
  email: string
  eventId: string
  colaboradores: { email: string; event_id: string; tipo: string | null; status: string }[]
  miembros: { email: string; status: string }[]
}): Validacion {
  const email = normalizarCorreo(p.email)
  if (!RE_CORREO.test(email)) return falla('Escribe un correo válido')
  if (p.miembros.some(m => normalizarCorreo(m.email) === email && m.status !== 'revoked')) {
    return falla('Es de tu equipo: dale acceso desde su ficha')
  }
  const vivas = p.colaboradores.filter(c => normalizarCorreo(c.email) === email && c.status !== 'revoked')
  if (vivas.some(c => c.event_id === p.eventId)) return falla('Ese correo ya tiene acceso a esta boda')
  if (vivas.some(c => c.tipo === 'cliente')) {
    return falla('Ese correo ya es cliente de otra boda. Un cliente solo tiene una')
  }
  return ok
}

// Al aceptar el enlace de miembro se activan, de un jalon, todas las filas de
// colaborador que la invitacion dejo pendientes en bodas de ESE workspace.
export function filasParaActivar(p: {
  email: string
  colaboradores: { id: string; email: string; status: string; event_id: string }[]
  eventosDelWorkspace: string[]
}): string[] {
  const email = normalizarCorreo(p.email)
  const propios = new Set(p.eventosDelWorkspace)
  return p.colaboradores
    .filter(c => normalizarCorreo(c.email) === email && c.status === 'pending' && propios.has(c.event_id))
    .map(c => c.id)
}

export type { Modulo }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/invitacion.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/workspace/tipos.ts lib/workspace/invitacion.ts lib/workspace/invitacion.test.ts
git commit -m "feat(workspace): logica pura del alta, el kit y la aceptacion"
```

---

### Task 4: El plan se lee y se escribe en el workspace

**Files:**
- Modify: `lib/billing.ts:5-9` (`PLAN_PRICES`)
- Modify: `lib/admin/change-plan.ts:1-15` (`VALID_PLANS`)
- Modify: `app/api/admin/update-plan/route.ts`
- Modify: `app/api/admin/users/route.ts:23`
- Test: `lib/admin/change-plan.test.ts` (ya existe; sigue verde)

**Interfaces:**
- Consumes: `PLANES`, `PLAN_IDS`, `normalizarPlan` de Task 1.
- Produces: `/api/admin/users` devuelve `plan` ya normalizado y leido del workspace cuando existe.

- [ ] **Step 1: `PLAN_PRICES` sale del catalogo**

En `lib/billing.ts` reemplaza el bloque `export const PLAN_PRICES = { free: 0, pro: 1990, agency: 3990 }` por:

```ts
import { PLANES, PLAN_IDS } from '@/lib/workspace/planes'

export const PLAN_PRICES: Record<string, number> = Object.fromEntries(
  PLAN_IDS.map(id => [id, PLANES[id].precio]),
)
```

En `lib/admin/change-plan.ts` reemplaza `import { PLAN_PRICES } from '@/lib/billing'` y `export const VALID_PLANS = Object.keys(PLAN_PRICES)` por:

```ts
import { PLAN_IDS, normalizarPlan } from '@/lib/workspace/planes'

export const VALID_PLANS: readonly string[] = PLAN_IDS
```

y en `checkPlanChange` cambia `if (normalize(target.plan || 'free') === newPlan)` por `if (normalizarPlan(target.plan) === newPlan)`. Deja `normalize` para `newPlan` (un plan que no exista debe seguir fallando con "Plan no valido", no caer a free).

- [ ] **Step 2: Run the existing tests**

Run: `npx vitest run lib/admin`
Expected: PASS. Si `change-plan.test.ts` compara contra 'pro' con `plan: 'free'` sigue igual; si alguna prueba usa un precio (1990) para pro, actualizarla a 990: el precio real vive en el catalogo.

- [ ] **Step 3: La ruta de cambio de plan escribe el workspace**

Reemplaza el bloque desde `const newPlan = String(plan).trim().toLowerCase()` hasta el `return` final de `app/api/admin/update-plan/route.ts` por:

```ts
  const newPlan = String(plan).trim().toLowerCase()

  // users.plan se sigue escribiendo por compatibilidad (nadie lo lee ya), y el
  // plan de verdad va al workspace de esa persona. Si el SQL del Tramo 5 no ha
  // corrido, la segunda escritura falla y se reporta como aviso: el cambio en
  // users.plan basta mientras tanto porque /api/admin/users cae a esa columna.
  const { data: rows, error } = await supabaseAdmin
    .from('users')
    .update({ plan: newPlan })
    .eq('id', userId)
    .select('id, plan')

  const result = interpretPlanUpdate({ error, rows })
  if (!result.ok) {
    console.error('[updatePlan] no se guardo el cambio', JSON.stringify({ userId, newPlan, error }))
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  let warning: string | null = null
  const { data: wsId, error: errWs } = await supabaseAdmin.rpc('asegurar_workspace', { uid: userId })
  if (errWs || !wsId) {
    warning = 'El plan quedo en users.plan; el workspace no se pudo actualizar (falta correr el SQL del Tramo 5)'
    console.warn('[updatePlan]', warning, errWs?.message)
  } else {
    const { error: errPlan } = await supabaseAdmin
      .from('workspaces').update({ plan: newPlan }).eq('id', wsId)
    if (errPlan) {
      warning = 'El workspace existe pero no acepto el plan: ' + errPlan.message
      console.warn('[updatePlan]', warning)
    }
  }

  return NextResponse.json({ ok: true, plan: newPlan, warning })
```

- [ ] **Step 4: `/api/admin/users` lee el plan del workspace**

En `app/api/admin/users/route.ts`, agrega a la lista de `Promise.all` (despues de la consulta de `users`) una lectura tolerante:

```ts
    supabaseAdmin.from('workspaces').select('primary_owner_id, plan'),
```

Recibe su resultado en la desestructuracion con el nombre `wsRes`. Justo antes de donde se arma la respuesta de usuarios, calcula:

```ts
  // Si el SQL del Tramo 5 no ha corrido, la columna plan no existe y wsRes.error
  // viene lleno: se cae a users.plan sin ruido.
  const planPorDueno = new Map<string, string>()
  if (!wsRes.error) {
    for (const w of (wsRes.data ?? []) as { primary_owner_id: string; plan: string | null }[]) {
      planPorDueno.set(w.primary_owner_id, normalizarPlan(w.plan))
    }
  }
```

y donde cada usuario se serializa con `plan: u.plan` (o equivalente), cambia a `plan: planPorDueno.get(u.id) ?? normalizarPlan(u.plan)`. Importa `normalizarPlan` de `@/lib/workspace/planes`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores; todo verde.

- [ ] **Step 6: Commit**

```bash
git add lib/billing.ts lib/admin/change-plan.ts lib/admin/change-plan.test.ts app/api/admin/update-plan/route.ts app/api/admin/users/route.ts
git commit -m "feat(workspace): el plan se lee y se escribe en el workspace, con respaldo a users.plan"
```

---

### Task 5: `rolCuenta` deja de ser un atajo

**Files:**
- Modify: `lib/event-access-context.tsx:86-96, 121-148`

**Interfaces:**
- Produces: `rolCuenta` en `useEventAccess()` siempre viene de `workspace_members` (o `null`).

- [ ] **Step 1: Extraer la lectura de membresia**

Dentro de `checkAccess`, antes de `if (event?.user_id === user.id)`, agrega:

```ts
        // Una sola lectura de membresia para los dos caminos. 'dueno' aqui
        // significa dueno DEL WORKSPACE, verificado contra workspace_members;
        // ser dueno del evento ya lo expresa esDuenoDelEvento.
        const leerRolCuenta = async (): Promise<RolCuenta> => {
          try {
            const { data: ev } = await supabase
              .from('events').select('workspace_id').eq('id', eventId).maybeSingle()
            if (!ev?.workspace_id) return null
            const { data: miembro } = await supabase
              .from('workspace_members').select('rol')
              .eq('workspace_id', ev.workspace_id).eq('user_id', user.id).eq('status', 'active')
              .maybeSingle()
            return (miembro?.rol as RolCuenta) ?? null
          } catch {
            return null
          }
        }
```

- [ ] **Step 2: Usarla en el camino del dueno**

Reemplaza el bloque que empieza en `if (event?.user_id === user.id) {` (con su comentario largo y `setRolCuenta('dueno')`) por:

```ts
        if (event?.user_id === user.id) {
          setRole('owner')
          setRolCuenta(await leerRolCuenta())
          return
        }
```

- [ ] **Step 3: Usarla en el camino del colaborador**

En el `try` de "Membresia de despacho y permisos por herramienta", reemplaza el `Promise.all` que lee `events.workspace_id` y `event_collaborators.permisos`, y el `if (ev?.workspace_id) {...}` que sigue, por:

```ts
          const [{ data: fila }, rolLeido] = await Promise.all([
            supabase
              .from('event_collaborators')
              .select('permisos')
              .eq('event_id', eventId)
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle(),
            leerRolCuenta(),
          ])

          if (fila?.permisos != null) permisosLeidos = normalizarPermisos(fila.permisos)
          setRolCuenta(rolLeido)
```

Cambia la palabra "despacho" por "workspace" en los comentarios que toques.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: limpio. Abre una boda propia en local: nada cambia a la vista (el dueno del evento sigue con Total por `esDuenoDelEvento`).

- [ ] **Step 5: Commit**

```bash
git add lib/event-access-context.tsx
git commit -m "fix(accesos): rolCuenta sale de workspace_members en los dos caminos"
```

---

### Task 6: SQL del cimiento

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-08-workspace-cimiento.sql`

**Interfaces:**
- Produces (en Postgres, cuando Diego lo corra): columnas `workspaces.plan|billing_email|legal_name|rfc|tax_regime|postal_code`; `es_admin_de(ws uuid)`; `asegurar_workspace(uid uuid) returns uuid`; `plan_del_evento(evento uuid) returns text`; trigger `guard_workspace_members`; `guard_events_workspace` exige dueno/admin; `set_event_workspace` usa `asegurar_workspace`; migracion del plan.

- [ ] **Step 1: Write the file**

```sql
-- Tramo 5, el workspace — tanda 1: cimiento.
--
-- Spec: docs/superpowers/specs/2026-09-07-workspace-tramo5-design.md (§3)
--
-- REQUISITO: el codigo de la tanda 1 en main y desplegado. Antes de eso la app
-- ya tolera que nada de esto exista; despues, /admin escribe workspaces.plan.
--
-- QUE HACE: seis columnas en workspaces, tres funciones nuevas (es_admin_de,
-- asegurar_workspace, plan_del_evento), un disparador nuevo
-- (guard_workspace_members), dos disparadores existentes reescritos
-- (guard_events_workspace exige dueno/admin; set_event_workspace delega en
-- asegurar_workspace), y la migracion del plan de users a workspaces.
--
-- NO toca policies de RLS ni is_event_*: eso es la tanda 3.
-- RE-CORRIBLE: todo es IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
-- CORRERLO ENTERO DE UN JALON. La seccion 0 es solo lectura: mirala antes.

-- ============================================================
-- 0. PREVIO (solo lectura) — esperado el 7-sep: 18 free, 1 agency, 1 studio
-- ============================================================
SELECT u.email, u.plan AS plan_en_users,
       CASE lower(coalesce(u.plan,'free'))
         WHEN 'pro' THEN 'pro' WHEN 'agency' THEN 'agency' WHEN 'studio' THEN 'pro'
         ELSE 'free' END AS plan_que_quedara,
       w.name AS workspace
  FROM users u
  JOIN workspaces w ON w.primary_owner_id = u.id
 WHERE coalesce(u.plan,'free') <> 'free'
 ORDER BY u.email;

BEGIN;

-- ============================================================
-- 1. Las seis columnas
-- ============================================================
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan          text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS legal_name    text,
  ADD COLUMN IF NOT EXISTS rfc           text,
  ADD COLUMN IF NOT EXISTS tax_regime    text,
  ADD COLUMN IF NOT EXISTS postal_code   text;

ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_valido;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_valido CHECK (plan IN ('free', 'pro', 'agency'));

-- ============================================================
-- 2. Quien administra un workspace
-- ============================================================
CREATE OR REPLACE FUNCTION public.es_admin_de(ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members m
    WHERE m.workspace_id = ws
      AND m.user_id = auth.uid()
      AND m.status  = 'active'
      AND m.rol IN ('dueno', 'admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.es_admin_de(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.es_admin_de(uuid) TO authenticated, service_role;

-- ============================================================
-- 3. El workspace propio, creado la primera vez que hace falta
--    (antes vivia inline en set_event_workspace; ahora tambien lo llama /admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.asegurar_workspace(uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ws uuid;
BEGIN
  SELECT w.id INTO v_ws FROM workspaces w WHERE w.primary_owner_id = uid;
  IF v_ws IS NOT NULL THEN
    RETURN v_ws;
  END IF;

  INSERT INTO workspaces (name, primary_owner_id, plan)
  SELECT COALESCE(u.full_name, u.email, 'Mi workspace'), u.id,
         CASE lower(coalesce(u.plan,'free'))
           WHEN 'pro' THEN 'pro' WHEN 'agency' THEN 'agency' WHEN 'studio' THEN 'pro'
           ELSE 'free' END
    FROM users u WHERE u.id = uid
  ON CONFLICT (primary_owner_id) DO NOTHING;

  INSERT INTO workspace_members (workspace_id, user_id, email, rol, es_dueno_principal, status, accepted_at)
  SELECT w.id, u.id, COALESCE(u.email, u.id::text), 'dueno', true, 'active', now()
    FROM workspaces w
    JOIN users u ON u.id = w.primary_owner_id
   WHERE w.primary_owner_id = uid
     AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = u.id)
  ON CONFLICT DO NOTHING;

  SELECT w.id INTO v_ws FROM workspaces w WHERE w.primary_owner_id = uid;
  RETURN v_ws;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asegurar_workspace(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.asegurar_workspace(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_event_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.workspace_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.workspace_id := public.asegurar_workspace(NEW.user_id);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Crear o mover una boda a un workspace es de dueno o admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_events_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.workspace_id IS NOT NULL AND NOT public.es_admin_de(NEW.workspace_id) THEN
      RAISE EXCEPTION 'Solo el dueno o un administrador del workspace puede crear bodas en el'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Solo el dueno del evento puede cambiar su workspace'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.workspace_id IS NOT NULL AND NOT public.es_admin_de(NEW.workspace_id) THEN
      RAISE EXCEPTION 'No puedes mover un evento a un workspace que no administras'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. El dueno principal no se toca, venga de donde venga la escritura
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_workspace_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.es_dueno_principal THEN
      RAISE EXCEPTION 'El dueno principal no se puede borrar del workspace' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.es_dueno_principal THEN
      IF NEW.status <> 'active' THEN
        RAISE EXCEPTION 'El dueno principal no se puede revocar' USING ERRCODE = '42501';
      END IF;
      IF NEW.rol <> 'dueno' THEN
        RAISE EXCEPTION 'El dueno principal siempre es dueno' USING ERRCODE = '42501';
      END IF;
    END IF;
    -- Transferir la propiedad es operacion de soporte (ver seccion 8): desde la
    -- app nunca cambia esta bandera.
    IF NEW.es_dueno_principal IS DISTINCT FROM OLD.es_dueno_principal THEN
      RAISE EXCEPTION 'La propiedad del workspace no se cambia desde aqui' USING ERRCODE = '42501';
    END IF;
    -- user_id se escribe una sola vez, al aceptar.
    IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'La membresia ya esta ligada a una cuenta' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_workspace_members ON public.workspace_members;
CREATE TRIGGER guard_workspace_members
  BEFORE UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_members();

-- ============================================================
-- 6. El plan que gobierna una boda (lo usara actividad_ver en su momento)
-- ============================================================
CREATE OR REPLACE FUNCTION public.plan_del_evento(evento uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT w.plan FROM events e JOIN workspaces w ON w.id = e.workspace_id WHERE e.id = evento),
    'free'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.plan_del_evento(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.plan_del_evento(uuid) TO authenticated, service_role;

-- ============================================================
-- 7. Migracion del plan: users.plan -> workspaces.plan (studio -> pro)
-- ============================================================
UPDATE workspaces w
   SET plan = CASE lower(coalesce(u.plan,'free'))
                WHEN 'pro' THEN 'pro' WHEN 'agency' THEN 'agency' WHEN 'studio' THEN 'pro'
                ELSE 'free' END
  FROM users u
 WHERE u.id = w.primary_owner_id;

COMMIT;

-- ============================================================
-- VERIFICACION (solo lectura)
-- ============================================================
SELECT plan, count(*) FROM workspaces GROUP BY plan ORDER BY plan;
-- esperado: agency 1, pro 1, free el resto

-- ============================================================
-- 8. SOPORTE: transferir la propiedad (NO correr; queda documentado)
-- ============================================================
-- El disparador de la seccion 5 lo impide a proposito. Para transferir, con el
-- nuevo dueno YA miembro activo del workspace:
--   ALTER TABLE workspace_members DISABLE TRIGGER guard_workspace_members;
--   UPDATE workspace_members SET es_dueno_principal = false WHERE workspace_id = :ws AND es_dueno_principal;
--   UPDATE workspace_members SET es_dueno_principal = true, rol = 'dueno' WHERE workspace_id = :ws AND user_id = :nuevo;
--   UPDATE workspaces SET primary_owner_id = :nuevo WHERE id = :ws;
--   ALTER TABLE workspace_members ENABLE TRIGGER guard_workspace_members;
-- Ojo con el indice unico workspaces_un_dueno: el nuevo dueno no puede ser ya
-- dueno principal de otro workspace.

-- ============================================================
-- DESHACER (solo si hace falta)
-- ============================================================
-- UPDATE workspaces SET plan = 'free';
-- DROP TRIGGER IF EXISTS guard_workspace_members ON workspace_members;
-- Las columnas y funciones nuevas se pueden dejar: son inertes sin el codigo.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-08-workspace-cimiento.sql
git commit -m "docs(sql): cimiento del workspace, plan y dueno principal protegido"
```

---
## Tanda 2 — `/cuenta/equipo` (aqui se para y se prueba con una colaboradora real)

### Task 7: Helpers de servidor y de navegador

**Files:**
- Create: `lib/workspace/servidor.ts`
- Create: `lib/workspace/cliente.ts`

**Interfaces:**
- Produces (servidor): `clienteAdmin(): SupabaseClient`, `usuarioDeRequest(req): Promise<{ user, admin } | null>`, `rolEnWorkspace(admin, workspaceId, userId): Promise<RolWorkspace | null>`, `esAdministrador(rol): boolean`, `bodasDelWorkspace(admin, workspaceId): Promise<BodaDelWorkspace[]>`.
- Produces (cliente): `bearer(): Promise<HeadersInit | null>`, `misWorkspacesAdministrados(): Promise<WorkspaceListado[]>`, `fetchWorkspace(id?: string): Promise<{ workspaces: WorkspaceListado[]; activo: WorkspaceResumen | null }>`, `postJson(url, body)`, `patchJson`, `deleteJson`.

- [ ] **Step 1: Write `lib/workspace/servidor.ts`**

```ts
// lib/workspace/servidor.ts
// Solo se importa desde rutas de API. Nunca desde un componente.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { resolveFeatures } from '@/lib/features'
import { normalizarPlan } from './planes'
import type { BodaDelWorkspace, RolWorkspace } from './tipos'

export function clienteAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function usuarioDeRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const admin = clienteAdmin()
  const { data: { user }, error } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) return null
  return { user, admin }
}

export async function rolEnWorkspace(admin: SupabaseClient, workspaceId: string, userId: string): Promise<RolWorkspace | null> {
  const { data } = await admin
    .from('workspace_members').select('rol')
    .eq('workspace_id', workspaceId).eq('user_id', userId).eq('status', 'active')
    .maybeSingle()
  return (data?.rol as RolWorkspace) ?? null
}

export function esAdministrador(rol: RolWorkspace | null): boolean {
  return rol === 'dueno' || rol === 'admin'
}

export async function bodasDelWorkspace(admin: SupabaseClient, workspaceId: string): Promise<BodaDelWorkspace[]> {
  const { data: eventos } = await admin
    .from('events').select('id, name, event_date, event_status, event_type')
    .eq('workspace_id', workspaceId)
    .order('event_date', { ascending: true })
  const ids = (eventos ?? []).map(e => e.id)
  const { data: settings } = ids.length
    ? await admin.from('event_settings').select('event_id, enabled_features').in('event_id', ids)
    : { data: [] as { event_id: string; enabled_features: unknown }[] }
  const porEvento = new Map((settings ?? []).map(s => [s.event_id, s.enabled_features]))
  return (eventos ?? []).map(e => ({
    id: e.id, name: e.name, event_date: e.event_date, event_status: e.event_status,
    features: resolveFeatures(e.event_type, (porEvento.get(e.id) ?? null) as never),
  }))
}

// La columna plan puede no existir todavia: select('*') y normalizar.
export function planDeFila(fila: Record<string, unknown> | null | undefined) {
  return normalizarPlan(fila?.plan)
}
```

Nota: revisa la firma real de `resolveFeatures` en `lib/features.ts:76` y ajusta el segundo argumento al tipo que pida (`EnabledFeatures | null`); quita el `as never` si no hace falta.

- [ ] **Step 2: Write `lib/workspace/cliente.ts`**

```ts
// lib/workspace/cliente.ts
'use client'
import { supabase } from '@/lib/supabase'
import { normalizarPlan } from './planes'
import type { WorkspaceListado, WorkspaceResumen } from './tipos'

export async function bearer(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  return { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
}

// Para el menu: solo necesita saber si administras alguno. Lee con RLS
// (user_id = auth.uid()) y tolera que la columna plan no exista.
export async function misWorkspacesAdministrados(): Promise<WorkspaceListado[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('workspace_members')
    .select('rol, workspaces ( id, name, plan )')
    .eq('user_id', user.id).eq('status', 'active').in('rol', ['dueno', 'admin'])
  if (error || !data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter(f => f.workspaces)
    .map(f => ({
      id: f.workspaces.id, name: f.workspaces.name,
      plan: normalizarPlan(f.workspaces.plan), miRol: f.rol,
    }))
}

export async function fetchWorkspace(id?: string) {
  const h = await bearer()
  if (!h) throw new Error('Sesión expirada')
  const res = await fetch('/api/workspace' + (id ? `?id=${id}` : ''), { headers: h })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo cargar el workspace')
  return res.json() as Promise<{ workspaces: WorkspaceListado[]; activo: WorkspaceResumen | null }>
}

async function conCuerpo(method: string, url: string, body?: unknown) {
  const h = await bearer()
  if (!h) throw new Error('Sesión expirada')
  const res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Algo salió mal')
  return json
}
export const postJson   = (url: string, body: unknown) => conCuerpo('POST', url, body)
export const patchJson  = (url: string, body: unknown) => conCuerpo('PATCH', url, body)
export const deleteJson = (url: string) => conCuerpo('DELETE', url)
```

Si la relacion `workspaces ( id, name, plan )` falla porque `plan` no existe, PostgREST devuelve error y la funcion regresa `[]`: el menu no aparece hasta que corra el SQL. Para no depender de eso, pide `workspaces ( id, name )` y en un segundo paso, tolerante, lee `plan` con `select('id, plan').in('id', ids)` cayendo a `'free'` si falla.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add lib/workspace/servidor.ts lib/workspace/cliente.ts
git commit -m "feat(workspace): helpers de servidor (service role) y de navegador"
```

---

### Task 8: GET `/api/workspace`

**Files:**
- Create: `app/api/workspace/route.ts`

**Interfaces:**
- Consumes: Task 7, `resumenAsientos` (Task 2), tipos (Task 3).
- Produces: `GET /api/workspace?id=<uuid>` -> `{ workspaces: WorkspaceListado[], activo: WorkspaceResumen | null }`. Sin `id`: el activo es el propio (dueño principal) o, si no hay, el primero que administras. Candado: solo workspaces donde `rol in (dueno, admin)`.

- [ ] **Step 1: Write the route**

```ts
// app/api/workspace/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { normalizarPermisos } from '@/lib/permisos/resolver'
import { bodasDelWorkspace, esAdministrador, planDeFila, usuarioDeRequest } from '@/lib/workspace/servidor'
import type { Cliente, Miembro, RolWorkspace, WorkspaceListado, WorkspaceResumen } from '@/lib/workspace/tipos'

export async function GET(req: NextRequest) {
  const s = await usuarioDeRequest(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { user, admin } = s

  const { data: mem } = await admin
    .from('workspace_members').select('workspace_id, rol, es_dueno_principal')
    .eq('user_id', user.id).eq('status', 'active').in('rol', ['dueno', 'admin'])
  const filas = (mem ?? []) as { workspace_id: string; rol: RolWorkspace; es_dueno_principal: boolean }[]
  if (filas.length === 0) return NextResponse.json({ workspaces: [], activo: null })

  const { data: wss } = await admin.from('workspaces').select('*').in('id', filas.map(f => f.workspace_id))
  const porId = new Map((wss ?? []).map(w => [w.id as string, w as Record<string, unknown>]))
  const workspaces: WorkspaceListado[] = filas
    .filter(f => porId.has(f.workspace_id))
    .map(f => ({
      id: f.workspace_id, name: String(porId.get(f.workspace_id)!.name),
      plan: planDeFila(porId.get(f.workspace_id)), miRol: f.rol,
    }))

  const pedido = req.nextUrl.searchParams.get('id')
  const propio = filas.find(f => f.es_dueno_principal)?.workspace_id
  const activoId = pedido ?? propio ?? workspaces[0]?.id
  const mia = filas.find(f => f.workspace_id === activoId)
  if (!activoId || !mia || !esAdministrador(mia.rol)) {
    return NextResponse.json({ error: 'No administras ese workspace' }, { status: 403 })
  }
  const ws = porId.get(activoId)!

  const [bodas, { data: miembrosRaw }] = await Promise.all([
    bodasDelWorkspace(admin, activoId),
    admin.from('workspace_members').select('*').eq('workspace_id', activoId).neq('status', 'revoked')
      .order('invited_at', { ascending: true }),
  ])
  const eventIds = bodas.map(b => b.id)
  const { data: colabs } = eventIds.length
    ? await admin.from('event_collaborators')
        .select('id, event_id, email, user_id, status, invite_token, tipo, permisos')
        .in('event_id', eventIds).neq('status', 'revoked')
    : { data: [] }
  const nombreBoda = new Map(bodas.map(b => [b.id, b.name]))

  const userIds = [...new Set([
    ...(miembrosRaw ?? []).map(m => m.user_id).filter(Boolean),
    ...(colabs ?? []).map(c => c.user_id).filter(Boolean),
  ])] as string[]
  const { data: perfiles } = userIds.length
    ? await admin.from('users').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nombre = new Map((perfiles ?? []).map(p => [p.id, p.full_name as string | null]))

  const miembros: Miembro[] = (miembrosRaw ?? []).map(m => ({
    id: m.id, email: m.email, user_id: m.user_id, nombre: m.user_id ? nombre.get(m.user_id) ?? null : null,
    rol: m.rol, es_dueno_principal: m.es_dueno_principal, status: m.status,
    invite_token: m.invite_token, invited_at: m.invited_at, accepted_at: m.accepted_at,
    bodas: (colabs ?? [])
      .filter(c => c.tipo !== 'cliente' && c.email.toLowerCase() === m.email.toLowerCase())
      .map(c => ({
        eventId: c.event_id, name: nombreBoda.get(c.event_id) ?? 'Boda', collaboratorId: c.id,
        status: c.status, permisos: normalizarPermisos(c.permisos),
      })),
  }))

  const correosEquipo = new Set(miembros.map(m => m.email.toLowerCase()))
  const clientes: Cliente[] = (colabs ?? [])
    .filter(c => c.tipo === 'cliente' && !correosEquipo.has(c.email.toLowerCase()))
    .map(c => ({
      id: c.id, email: c.email, user_id: c.user_id, status: c.status, invite_token: c.invite_token,
      eventId: c.event_id, eventName: nombreBoda.get(c.event_id) ?? 'Boda',
      permisos: normalizarPermisos(c.permisos),
    }))

  const activo: WorkspaceResumen = {
    id: activoId, name: String(ws.name), plan: planDeFila(ws), miRol: mia.rol,
    esDuenoPrincipal: mia.es_dueno_principal, miembros, clientes, bodas,
  }
  return NextResponse.json({ workspaces, activo })
}
```

- [ ] **Step 2: Verify by hand**

Con el dev server arriba y sesion de Diego, en la consola del navegador:

```js
const { data: { session } } = await (await import('/lib/supabase')).supabase.auth.getSession()
```

Si el import no resuelve, prueba desde una pagina cualquiera con `fetch('/api/workspace', { headers: { Authorization: 'Bearer ' + (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sb-')))).access_token) } }).then(r => r.json()).then(console.log)`.
Expected: `workspaces` con tu workspace, `activo.miembros` con tu fila de dueño principal, `activo.bodas` con tus 43 bodas, `plan: 'free'` si el SQL no ha corrido.

- [ ] **Step 3: Commit**

```bash
git add app/api/workspace/route.ts
git commit -m "feat(workspace): GET del workspace con miembros, clientes, bodas y asientos"
```

---

### Task 9: Escrituras: alta, ficha, revocar, cliente

**Files:**
- Create: `app/api/workspace/miembros/route.ts`
- Create: `app/api/workspace/miembros/[id]/route.ts`
- Create: `app/api/workspace/clientes/route.ts`

**Interfaces:**
- Consumes: Task 7 helpers; `filasDeAlta`, `validarAltaEquipo`, `validarCliente`, `normalizarCorreo` (Task 3); `puedeInvitar`, `contarAsientos` (Task 2); `permisosDeRol`, `aplicarKit`, `normalizarPermisos` de `@/lib/permisos/resolver`.
- Produces:
  - `POST /api/workspace/miembros` body `{ workspaceId, email, rol: 'admin'|'colaborador', bodas: { eventId, permisos }[] }` -> `{ ok, miembroId, inviteToken }`.
  - `PATCH /api/workspace/miembros/[id]` body `{ rol?: 'admin'|'colaborador', bodas?: { eventId, permisos }[] }` -> `{ ok }`. Bodas ausentes de la lista se revocan; presentes se crean o actualizan.
  - `DELETE /api/workspace/miembros/[id]` -> `{ ok }`. Revoca al miembro y todas sus filas de colaborador en bodas del workspace.
  - `POST /api/workspace/clientes` body `{ workspaceId, eventId, email, puntoDePartida: 'ver'|'editar' }` -> `{ ok, collaboratorId, inviteToken }`.

- [ ] **Step 1: POST miembros**

```ts
// app/api/workspace/miembros/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { contarAsientos, puedeInvitar } from '@/lib/workspace/asientos'
import { filasDeAlta, validarAltaEquipo, type BodaElegida } from '@/lib/workspace/invitacion'
import { esAdministrador, planDeFila, rolEnWorkspace, usuarioDeRequest } from '@/lib/workspace/servidor'
import type { RolInvitable } from '@/lib/workspace/tipos'

export async function POST(req: NextRequest) {
  const s = await usuarioDeRequest(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { user, admin } = s

  let body: { workspaceId?: string; email?: string; rol?: RolInvitable; bodas?: BodaElegida[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }
  const { workspaceId, email, rol } = body
  const bodas = Array.isArray(body.bodas) ? body.bodas : []
  if (!workspaceId || !email || (rol !== 'admin' && rol !== 'colaborador')) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const miRol = await rolEnWorkspace(admin, workspaceId, user.id)
  if (!esAdministrador(miRol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [{ data: ws }, { data: miembros }] = await Promise.all([
    admin.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
    admin.from('workspace_members').select('id, email, status').eq('workspace_id', workspaceId),
  ])
  if (!ws) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })

  const v = validarAltaEquipo({ email, miembros: miembros ?? [] })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const permiso = puedeInvitar(planDeFila(ws), contarAsientos(miembros ?? []))
  if (!permiso.ok) {
    return NextResponse.json({ error: 'Para trabajar en equipo necesitas Pro', motivo: 'plan' }, { status: 402 })
  }

  // Solo bodas de este workspace.
  const { data: propias } = await admin.from('events').select('id').eq('workspace_id', workspaceId)
  const ids = new Set((propias ?? []).map(e => e.id))
  const bodasValidas = bodas.filter(b => ids.has(b.eventId))

  const token = randomUUID()
  const { miembro, colaboradores } = filasDeAlta({
    workspaceId, email, rol, bodas: bodasValidas, invitedBy: user.id, token,
  })

  // Un correo revocado antes se reactiva sobre su misma fila (unique workspace_id, email).
  const revocada = (miembros ?? []).find(m => m.email.toLowerCase() === miembro.email && m.status === 'revoked')
  const escritura = revocada
    ? admin.from('workspace_members').update({ ...miembro, accepted_at: null, user_id: null }).eq('id', revocada.id).select('id').single()
    : admin.from('workspace_members').insert(miembro).select('id').single()
  const { data: fila, error } = await escritura
  if (error || !fila) return NextResponse.json({ error: 'No se pudo crear la invitación: ' + (error?.message ?? '') }, { status: 500 })

  if (colaboradores.length > 0) {
    // Filas viejas del mismo correo en esas bodas se reemplazan.
    await admin.from('event_collaborators').delete()
      .in('event_id', colaboradores.map(c => c.event_id)).eq('email', miembro.email).neq('status', 'active')
    const { error: errC } = await admin.from('event_collaborators').insert(colaboradores)
    if (errC) return NextResponse.json({ error: 'La persona quedó invitada pero sus bodas no: ' + errC.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, miembroId: fila.id, inviteToken: token })
}
```

Si al revocar y reinvitar el `update` choca con el disparador `guard_workspace_members` por `user_id` (regla "se escribe una sola vez"), omite `user_id: null` del update: la fila revocada conserva su cuenta y al aceptar se valida el correo igual.

- [ ] **Step 2: PATCH y DELETE de un miembro**

```ts
// app/api/workspace/miembros/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { normalizarPermisos } from '@/lib/permisos/resolver'
import { MODULOS } from '@/lib/permisos/catalogo'
import type { BodaElegida } from '@/lib/workspace/invitacion'
import { esAdministrador, rolEnWorkspace, usuarioDeRequest } from '@/lib/workspace/servidor'
import type { RolInvitable } from '@/lib/workspace/tipos'

type Ctx = { params: Promise<{ id: string }> }

async function cargar(req: NextRequest, id: string) {
  const s = await usuarioDeRequest(req)
  if (!s) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: m } = await s.admin.from('workspace_members').select('*').eq('id', id).maybeSingle()
  if (!m) return { error: NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 }) }
  const miRol = await rolEnWorkspace(s.admin, m.workspace_id, s.user.id)
  if (!esAdministrador(miRol)) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  const { data: eventos } = await s.admin.from('events').select('id').eq('workspace_id', m.workspace_id)
  return { s, m, eventIds: (eventos ?? []).map(e => e.id as string) }
}

const editaAlgo = (p: ReturnType<typeof normalizarPermisos>) =>
  MODULOS.some(k => p[k] === 'editar' || p[k] === 'total')

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const c = await cargar(req, id)
  if ('error' in c) return c.error
  const { s, m, eventIds } = c

  let body: { rol?: RolInvitable; bodas?: BodaElegida[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }

  if (body.rol && body.rol !== m.rol) {
    if (m.es_dueno_principal) return NextResponse.json({ error: 'El dueño principal siempre es dueño' }, { status: 400 })
    if (body.rol !== 'admin' && body.rol !== 'colaborador') return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    const { error } = await s.admin.from('workspace_members').update({ rol: body.rol }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(body.bodas)) {
    const propias = new Set(eventIds)
    const deseadas = body.bodas
      .filter(b => propias.has(b.eventId))
      .map(b => ({ eventId: b.eventId, permisos: normalizarPermisos(b.permisos) }))
    const { data: actuales } = await s.admin.from('event_collaborators')
      .select('id, event_id, status').in('event_id', eventIds).eq('email', m.email).neq('tipo', 'cliente')
    const porEvento = new Map((actuales ?? []).map(a => [a.event_id, a]))

    for (const b of deseadas) {
      const vacia = !MODULOS.some(k => b.permisos[k] && b.permisos[k] !== 'ninguno')
      const existente = porEvento.get(b.eventId)
      if (vacia) {
        if (existente && existente.status !== 'revoked') {
          await s.admin.from('event_collaborators').update({ status: 'revoked' }).eq('id', existente.id)
        }
        continue
      }
      const role = editaAlgo(b.permisos) ? 'editor' : 'viewer'
      if (existente) {
        const status = existente.status === 'revoked' ? (m.user_id ? 'active' : 'pending') : existente.status
        await s.admin.from('event_collaborators')
          .update({ permisos: b.permisos, role, tipo: 'equipo', status, user_id: m.user_id ?? undefined }).eq('id', existente.id)
      } else {
        await s.admin.from('event_collaborators').insert({
          event_id: b.eventId, email: m.email, invited_by: s.user.id, tipo: 'equipo', role,
          permisos: b.permisos, status: m.user_id ? 'active' : 'pending', user_id: m.user_id,
        })
      }
    }
    const deseadosIds = new Set(deseadas.map(d => d.eventId))
    for (const a of actuales ?? []) {
      if (!deseadosIds.has(a.event_id) && a.status !== 'revoked') {
        await s.admin.from('event_collaborators').update({ status: 'revoked' }).eq('id', a.id)
      }
    }
    // El kit habitual sigue a lo que tiene hoy.
    if (m.rol === 'colaborador') {
      const { kitDesde } = await import('@/lib/workspace/invitacion')
      await s.admin.from('workspace_members').update({ kit_habitual: kitDesde(deseadas) }).eq('id', id)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const c = await cargar(req, id)
  if ('error' in c) return c.error
  const { s, m, eventIds } = c
  if (m.es_dueno_principal) return NextResponse.json({ error: 'El dueño principal no se puede quitar' }, { status: 400 })
  if (m.user_id === s.user.id) return NextResponse.json({ error: 'No puedes quitarte a ti mismo' }, { status: 400 })

  const { error } = await s.admin.from('workspace_members').update({ status: 'revoked' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (eventIds.length) {
    await s.admin.from('event_collaborators').update({ status: 'revoked' })
      .in('event_id', eventIds).eq('email', m.email).neq('tipo', 'cliente')
  }
  return NextResponse.json({ ok: true })
}
```

Cambia el `await import(...)` dinamico por un import normal arriba (`import { kitDesde } from '@/lib/workspace/invitacion'`); esta asi solo para que el bloque se lea de corrido.

- [ ] **Step 3: POST clientes**

```ts
// app/api/workspace/clientes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
import { normalizarCorreo, validarCliente } from '@/lib/workspace/invitacion'
import { bodasDelWorkspace, esAdministrador, rolEnWorkspace, usuarioDeRequest } from '@/lib/workspace/servidor'

export async function POST(req: NextRequest) {
  const s = await usuarioDeRequest(req)
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { user, admin } = s

  let body: { workspaceId?: string; eventId?: string; email?: string; puntoDePartida?: 'ver' | 'editar' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }
  const { workspaceId, eventId, email } = body
  const punto = body.puntoDePartida === 'editar' ? 'editor' : 'viewer'
  if (!workspaceId || !eventId || !email) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const miRol = await rolEnWorkspace(admin, workspaceId, user.id)
  if (!esAdministrador(miRol)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const bodas = await bodasDelWorkspace(admin, workspaceId)
  const boda = bodas.find(b => b.id === eventId)
  if (!boda) return NextResponse.json({ error: 'Esa boda no es de este workspace' }, { status: 400 })

  const [{ data: miembros }, { data: colaboradores }] = await Promise.all([
    admin.from('workspace_members').select('email, status').eq('workspace_id', workspaceId),
    admin.from('event_collaborators').select('email, event_id, tipo, status').in('event_id', bodas.map(b => b.id)),
  ])
  const v = validarCliente({ email, eventId, colaboradores: colaboradores ?? [], miembros: miembros ?? [] })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data: fila, error } = await admin.from('event_collaborators').insert({
    event_id: eventId, email: normalizarCorreo(email), invited_by: user.id, status: 'pending',
    tipo: 'cliente', role: punto, permisos: aplicarKit(permisosDeRol(punto), boda.features),
  }).select('id, invite_token').single()
  if (error || !fila) return NextResponse.json({ error: 'No se pudo crear la invitación: ' + (error?.message ?? '') }, { status: 500 })

  return NextResponse.json({ ok: true, collaboratorId: fila.id, inviteToken: fila.invite_token })
}
```

`event_collaborators.invite_token` lo pone la base por default (hoy el insert de Configuracion no lo manda). Si al probar sale `null`, genera `invite_token: randomUUID()` en el insert.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add app/api/workspace/miembros/route.ts "app/api/workspace/miembros/[id]/route.ts" app/api/workspace/clientes/route.ts
git commit -m "feat(workspace): alta de personas, ficha, revocar e invitar cliente por API"
```

---

### Task 10: El enlace de miembro se acepta en `/invite/[token]`

**Files:**
- Modify: `app/api/invite/[token]/route.ts`
- Modify: `app/invite/[token]/page.tsx`

**Interfaces:**
- Produces: `GET /api/invite/[token]` devuelve, para tokens de miembro, `{ status: 'pending', kind: 'workspace', account_exists, invite: { workspace_id, workspace_name, email, rol, rolLabel, bodas: { id, name }[] } }`; los de boda siguen igual mas `kind: 'event'`. `POST` para miembro devuelve `{ ok, kind: 'workspace', event_id: string | null }`.

- [ ] **Step 1: GET aprende el token de miembro**

En el `GET`, donde hoy `if (error || !data) return NextResponse.json({ status: 'invalid' }, { status: 404 })`, reemplaza por una busqueda de respaldo:

```ts
  if (error || !data) {
    const { data: m } = await db
      .from('workspace_members')
      .select('id, workspace_id, email, rol, status, user_id, workspaces ( name )')
      .eq('invite_token', token)
      .maybeSingle()
    if (!m || m.status === 'revoked') return NextResponse.json({ status: 'invalid' }, { status: 404 })
    if (m.status === 'active') return NextResponse.json({ status: 'already_used', kind: 'workspace', event_id: null })

    const { data: bodas } = await db
      .from('event_collaborators').select('event_id, events ( name )')
      .eq('email', m.email).eq('status', 'pending').neq('tipo', 'cliente')
    const { data: existing } = await db.from('users').select('id').ilike('email', m.email).maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = m.workspaces as any
    return NextResponse.json({
      status: 'pending', kind: 'workspace', account_exists: !!existing,
      invite: {
        workspace_id: m.workspace_id, workspace_name: ws?.name ?? 'Workspace',
        email: m.email, rol: m.rol, rolLabel: m.rol === 'admin' ? 'Administrador' : 'Colaborador',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bodas: (bodas ?? []).map((b: any) => ({ id: b.event_id, name: b.events?.name ?? 'Boda' })),
      },
    })
  }
```

Y en la respuesta `pending` de evento agrega `kind: 'event'`.

- [ ] **Step 2: POST activa miembro y bodas de un jalon**

En el `POST`, donde `if (!invite || invite.status === 'revoked') return ... 404`, reemplaza por:

```ts
  if (!invite || invite.status === 'revoked') {
    const { data: m } = await db.from('workspace_members')
      .select('id, workspace_id, email, rol, status, user_id').eq('invite_token', token).maybeSingle()
    if (!m || m.status === 'revoked') return NextResponse.json({ error: 'invalid' }, { status: 404 })

    const invitedEmail = (m.email || '').trim().toLowerCase()
    const sessionEmail = (user.email || '').trim().toLowerCase()
    if (invitedEmail && sessionEmail !== invitedEmail) {
      return NextResponse.json({ error: 'email_mismatch', invited: m.email, your_email: user.email }, { status: 403 })
    }

    const { data: eventos } = await db.from('events').select('id').eq('workspace_id', m.workspace_id)
    const eventIds = (eventos ?? []).map(e => e.id as string)

    if (m.status === 'pending') {
      const { error: e1 } = await db.from('workspace_members')
        .update({ user_id: user.id, status: 'active', accepted_at: new Date().toISOString() })
        .eq('id', m.id).eq('status', 'pending')
      if (e1) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })
    }

    const { data: colabs } = await db.from('event_collaborators')
      .select('id, email, status, event_id').in('event_id', eventIds.length ? eventIds : ['00000000-0000-0000-0000-000000000000'])
    const ids = filasParaActivar({ email: m.email, colaboradores: colabs ?? [], eventosDelWorkspace: eventIds })
    if (ids.length) {
      await db.from('event_collaborators')
        .update({ user_id: user.id, status: 'active', accepted_at: new Date().toISOString() }).in('id', ids)
    }

    // Aterriza en la primera boda que le toque; el admin, en la primera del workspace.
    const primera = m.rol === 'admin'
      ? eventIds[0] ?? null
      : (colabs ?? []).find(c => ids.includes(c.id))?.event_id
        ?? (colabs ?? []).find(c => c.email.toLowerCase() === invitedEmail && c.status === 'active')?.event_id
        ?? null
    return NextResponse.json({ ok: true, kind: 'workspace', event_id: primera })
  }
```

Importa `filasParaActivar` de `@/lib/workspace/invitacion` arriba del archivo.

- [ ] **Step 3: La pagina pinta la invitacion de workspace**

En `app/invite/[token]/page.tsx`:
- Amplia `InviteData` con `kind?: 'event' | 'workspace'`, `workspace_name?: string`, `bodas?: { id: string; name: string }[]`.
- Donde se muestra el encabezado de la invitacion (nombre del evento, fecha, venue), si `invite.kind === 'workspace'` muestra en su lugar: titulo "Te invitaron al workspace **{workspace_name}**", subtitulo "{rolLabel}", y si `bodas.length > 0` la lista "Vas a entrar a: {nombres separados por coma}"; si es admin, "Entras a todas las bodas del workspace".
- En `acceptInvite`, tras `result.ok`, si `result.event_id` es null manda a `/dashboard` en vez de `/events/<id>`.

- [ ] **Step 4: Verify by hand**

Crea una persona desde la API (Task 9) o espera a la pantalla (Task 12), abre el enlace en una ventana privada, registrate con ese correo. Expected: aterrizas en la primera boda con los permisos elegidos; en `/cuenta/equipo` la persona aparece activa.

- [ ] **Step 5: Commit**

```bash
git add "app/api/invite/[token]/route.ts" "app/invite/[token]/page.tsx"
git commit -m "feat(workspace): un solo enlace activa al miembro y todas sus bodas"
```

---
### Task 11: La cascara `/cuenta` y la entrada en el menu

**Files:**
- Create: `app/cuenta/WorkspaceContext.tsx`
- Create: `app/cuenta/layout.tsx`
- Create: `app/cuenta/page.tsx`
- Modify: `app/dashboard/page.tsx:613-626` (header)
- Modify: `app/events/[id]/layout.tsx:451, 556` (menu del avatar)

**Interfaces:**
- Consumes: `fetchWorkspace`, `misWorkspacesAdministrados` (Task 7); `Cargando`.
- Produces: `useWorkspace(): { activo: WorkspaceResumen | null; workspaces: WorkspaceListado[]; cargando: boolean; error: string | null; recargar: () => Promise<void> }`.

- [ ] **Step 1: Context**

```tsx
// app/cuenta/WorkspaceContext.tsx
'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchWorkspace } from '@/lib/workspace/cliente'
import type { WorkspaceListado, WorkspaceResumen } from '@/lib/workspace/tipos'

interface Ctx {
  activo: WorkspaceResumen | null
  workspaces: WorkspaceListado[]
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
}

const WorkspaceCtx = createContext<Ctx>({ activo: null, workspaces: [], cargando: true, error: null, recargar: async () => {} })

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams()
  const pedido = params.get('ws') ?? undefined
  const [activo, setActivo] = useState<WorkspaceResumen | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      const r = await fetchWorkspace(pedido)
      setWorkspaces(r.workspaces)
      setActivo(r.activo)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    } finally {
      setCargando(false)
    }
  }, [pedido])

  useEffect(() => { recargar() }, [recargar])

  const value = useMemo(() => ({ activo, workspaces, cargando, error, recargar }), [activo, workspaces, cargando, error, recargar])
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
}

export const useWorkspace = () => useContext(WorkspaceCtx)
```

- [ ] **Step 2: Layout con header, candado y pestanas**

```tsx
// app/cuenta/layout.tsx
'use client'
import { Suspense, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Lock, Users } from 'lucide-react'
import { Cargando } from '@/app/components/ui/Cargando'
import { etiquetaPlan } from '@/lib/workspace/planes'
import { ROL_LABEL } from '@/lib/workspace/tipos'
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext'

// Solo Equipo por ahora. Actividad y Plan y facturacion llegan en las tandas 4 y 5:
// agregar aqui un renglon y su carpeta, nada mas.
const PESTANAS = [
  { key: 'equipo', label: 'Equipo', href: '/cuenta/equipo', icon: Users },
]

function Cascara({ children }: { children: ReactNode }) {
  const { activo, workspaces, cargando, error } = useWorkspace()
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <header className="sticky top-0 z-10 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <button onClick={() => router.push('/dashboard')} className="shrink-0">
            <Image src="/images/Logo-010526newest.svg" alt="Anfiora" width={110} height={45} priority className="h-8 w-auto object-contain" />
          </button>
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#48C9B0]">
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {cargando ? (
          <Cargando mensaje="Cargando tu workspace" />
        ) : !activo ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-[#e0e0e0] text-[#bbb]"><Lock size={18} /></span>
            <h2 className="text-[15px] font-semibold text-[#1D1E20]">No administras ningún workspace</h2>
            <p className="max-w-xs text-[13px] text-[#888]">{error ?? 'Esta sección es de dueños y administradores.'}</p>
            <Link href="/dashboard" className="mt-1 rounded-lg bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-[#08312a]">Volver al inicio</Link>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-xs text-[#888]">Mi workspace</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">{activo.name}</h1>
                <span className="rounded-full border border-[#e0e0e0] px-2.5 py-0.5 text-[11px] font-semibold text-[#666]">{etiquetaPlan(activo.plan)}</span>
                <span className="text-[11px] text-[#aaa]">{ROL_LABEL[activo.miRol]}</span>
              </div>
              {workspaces.length > 1 && (
                <p className="mt-1 text-xs text-[#888]">
                  También administras:{' '}
                  {workspaces.filter(w => w.id !== activo.id).map((w, i) => (
                    <span key={w.id}>{i > 0 && ', '}<Link href={`${pathname}?ws=${w.id}`} className="text-[#1a9e88] underline">{w.name}</Link></span>
                  ))}
                </p>
              )}
            </div>
            <nav className="mb-5 flex gap-1 border-b border-[#e8e8e8]">
              {PESTANAS.map(p => {
                const on = pathname.startsWith(p.href)
                const Icon = p.icon
                return (
                  <Link key={p.key} href={p.href} className={'-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ' + (on ? 'border-[#1D1E20] text-[#1D1E20]' : 'border-transparent text-[#999] hover:text-[#1D1E20]')}>
                    <Icon size={14} /> {p.label}
                  </Link>
                )
              })}
            </nav>
            {children}
          </>
        )}
      </main>
    </div>
  )
}

export default function CuentaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Cargando mensaje="Cargando" pantallaCompleta />}>
      <WorkspaceProvider>
        <Cascara>{children}</Cascara>
      </WorkspaceProvider>
    </Suspense>
  )
}
```

`app/cuenta/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
export default function CuentaPage() { redirect('/cuenta/equipo') }
```

Agrega `'/cuenta'` a `AUTHED_PREFIXES` en `app/components/InstallPrompt.tsx:15` y revisa si `LegalGate` o el `FeedbackWidget` filtran por prefijo de ruta (`grep -rn "'/perfil'" app/components`); donde aparezca `/perfil` en una lista de rutas autenticadas, agrega `/cuenta`.

- [ ] **Step 3: Entrada "Mi workspace" en el dashboard**

En `app/dashboard/page.tsx`, agrega estado `const [administra, setAdministra] = useState(false)` y en el `useEffect` que ya carga al usuario (junto a `loadData`), `misWorkspacesAdministrados().then(ws => setAdministra(ws.length > 0))`. En el header, justo antes del boton de "Mi perfil" (linea ~621), agrega:

```tsx
            {administra && (
              <button
                onClick={() => window.location.href = '/cuenta/equipo'}
                title="Mi workspace"
                className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-2.5 py-2 text-xs text-[#888] transition hover:border-[#48C9B0] hover:text-[#1a9e88]"
              >
                <Building2 size={16} />
                <span className="hidden sm:inline">Mi workspace</span>
              </button>
            )}
```

Importa `Building2` de `lucide-react` y `misWorkspacesAdministrados` de `@/lib/workspace/cliente`.

- [ ] **Step 4: Misma entrada en el menu del avatar de la boda**

En `app/events/[id]/layout.tsx`, el `AvatarDropdown` (linea ~451) y el dropdown movil (linea ~556) tienen un boton que hace `irA('/perfil')`. Agrega el mismo `administra` (estado + `misWorkspacesAdministrados()` en el `useEffect` que carga `userName`), y **antes** del boton de perfil en los dos menus:

```tsx
        {administra && (
          <button
            onClick={() => { setAvatarOpen(false); irA('/cuenta/equipo') }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-[#666] transition hover:bg-[#f5f5f5]"
          >
            <Building2 size={14} /> Mi workspace
          </button>
        )}
```

Copia las clases exactas del boton de "Mi perfil" que ya esta ahi para que se vean iguales.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`. En local: el dashboard muestra "Mi workspace"; `/cuenta` redirige a `/cuenta/equipo` y pinta el encabezado con tu nombre y plan.

```bash
git add app/cuenta/WorkspaceContext.tsx app/cuenta/layout.tsx app/cuenta/page.tsx app/dashboard/page.tsx "app/events/[id]/layout.tsx" app/components/InstallPrompt.tsx
git commit -m "feat(workspace): seccion /cuenta con su cascara y la entrada en el menu"
```

---

### Task 12: `/cuenta/equipo` y sus tres modales

**Files:**
- Create: `app/components/workspace/AltaPersonaModal.tsx`
- Create: `app/components/workspace/InvitarClienteModal.tsx`
- Create: `app/components/workspace/FichaMiembroModal.tsx`
- Create: `app/cuenta/equipo/page.tsx`

**Interfaces:**
- Consumes: `useWorkspace` (Task 11), `postJson/patchJson/deleteJson` (Task 7), `PermisosEditor` de `app/events/[id]/configuracion/PermisosEditor.tsx`, `Modal`, `useConfirm`, `resumenAsientos`, `puedeInvitar`, `kitDesde`, `aplicarKit`, `permisosDeRol`, `ponerNivel`.
- Produces:
  - `<AltaPersonaModal open onClose workspace={WorkspaceResumen} bodaFija?: string onHecho={(r: { inviteToken: string }) => void} />`
  - `<InvitarClienteModal open onClose workspace bodaFija? onHecho />`
  - `<FichaMiembroModal open onClose workspace miembro={Miembro} onHecho={() => void} />`

- [ ] **Step 1: AltaPersonaModal (tres pasos)**

```tsx
// app/components/workspace/AltaPersonaModal.tsx
'use client'
import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { PermisosEditor } from '@/app/events/[id]/configuracion/PermisosEditor'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
import { contarAsientos, puedeInvitar } from '@/lib/workspace/asientos'
import { postJson } from '@/lib/workspace/cliente'
import { kitDesde, validarAltaEquipo } from '@/lib/workspace/invitacion'
import { PLANES } from '@/lib/workspace/planes'
import type { RolInvitable, WorkspaceResumen } from '@/lib/workspace/tipos'

interface Props {
  open: boolean
  onClose: () => void
  workspace: WorkspaceResumen
  bodaFija?: string
  onHecho: (r: { inviteToken: string }) => void
}

type Paso = 1 | 2 | 3

export function AltaPersonaModal({ open, onClose, workspace, bodaFija, onHecho }: Props) {
  const [paso, setPaso] = useState<Paso>(1)
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<RolInvitable>('colaborador')
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(bodaFija ? [bodaFija] : []))
  const [permisos, setPermisos] = useState<Record<string, PermisosEvento>>({})
  const [bodaActual, setBodaActual] = useState<string | null>(bodaFija ?? null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const ocupados = contarAsientos(workspace.miembros)
  const permiso = puedeInvitar(workspace.plan, ocupados)
  const bodasActivas = workspace.bodas.filter(b => b.event_status !== 'archived' && b.event_status !== 'cancelled')

  // Kit: lo que ese correo ya tiene en otras bodas; si nada, "Puede editar".
  const kit = useMemo(() => {
    const m = workspace.miembros.find(x => x.email.toLowerCase() === email.trim().toLowerCase())
    return m ? kitDesde(m.bodas) : {}
  }, [workspace.miembros, email])

  const permisosDe = (eventId: string): PermisosEvento => {
    if (permisos[eventId]) return permisos[eventId]
    const boda = workspace.bodas.find(b => b.id === eventId)!
    const base = Object.keys(kit).length ? kit : permisosDeRol('editor')
    return aplicarKit(base, boda.features)
  }

  const siguiente = () => {
    setError('')
    if (paso === 1) {
      const v = validarAltaEquipo({ email, miembros: workspace.miembros })
      if (!v.ok) { setError(v.error!); return }
      if (rol === 'admin') { setPaso(3); return }
      setPaso(2)
      return
    }
    if (paso === 2) {
      if (elegidas.size === 0) { setError('Elige al menos una boda'); return }
      setBodaActual([...elegidas][0])
      setPaso(3)
    }
  }

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      const bodas = rol === 'admin' ? [] : [...elegidas].map(eventId => ({ eventId, permisos: permisosDe(eventId) }))
      const r = await postJson('/api/workspace/miembros', { workspaceId: workspace.id, email: email.trim(), rol, bodas })
      setToken(r.inviteToken)
      onHecho({ inviteToken: r.inviteToken })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const link = token ? `${window.location.origin}/invite/${token}` : ''
  const copiar = async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }

  const titulos: Record<Paso, string> = { 1: 'Persona', 2: 'Bodas', 3: 'Permisos' }
  const pasos = (
    <p className="mb-1 text-[11px] text-[#999]">
      {([1, 2, 3] as Paso[]).filter(p => !(rol === 'admin' && p === 2)).map((p, i) => (
        <span key={p}>{i > 0 && <span className="mx-1 text-[#ccc]">›</span>}<span className={p === paso ? 'font-semibold text-[#1D1E20]' : ''}>{p} {titulos[p]}</span></span>
      ))}
    </p>
  )

  const btnBase = 'rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60'
  const btnCta = btnBase + ' bg-[#48C9B0] text-[#08312a]'
  const btnSec = 'rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]'

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header
        title={token ? 'Invitación lista' : 'Agregar persona al workspace'}
        subtitle={token ? 'Copia el enlace y mándaselo. Al entrar ya tiene sus bodas y sus permisos.' : 'Recibe un enlace. Al entrar ya tiene sus bodas y sus permisos.'}
      />
      <Modal.Body>
        {token ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-[#666]">{link}</span>
            <button onClick={copiar} className="flex items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
              {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : !permiso.ok ? (
          <div className="rounded-xl border border-[#f0dfae] bg-[#fffbf0] px-4 py-3 text-sm text-[#7a5a14]">
            <p className="font-semibold">Para trabajar en equipo necesitas Pro.</p>
            <p className="mt-1 text-[13px]">Tu plan {PLANES[workspace.plan].nombre} es solo para ti. Escríbenos y te lo activamos.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pasos}
            {paso === 1 && (
              <>
                <label className="text-xs font-semibold text-[#666]">Correo
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com" autoFocus
                    className="mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]" />
                </label>
                <div>
                  <p className="text-xs font-semibold text-[#666]">Rol en el workspace</p>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {([['colaborador', 'Colaborador', 'Solo entra a las bodas que le des'], ['admin', 'Administrador', 'Entra a todas y reparte accesos']] as const).map(([v, l, d]) => (
                      <button key={v} type="button" onClick={() => setRol(v)}
                        className={'rounded-lg border px-3 py-2.5 text-left transition ' + (rol === v ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] bg-white hover:border-[#48C9B0]')}>
                        <span className="block text-[12px] font-semibold text-[#1D1E20]">{l}</span>
                        <span className="block text-[11px] text-[#888]">{d}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={'rounded-lg px-3 py-2.5 text-[13px] ' + (permiso.costoNuevoAsiento > 0 ? 'border border-[#f0dfae] bg-[#fffbf0] text-[#7a5a14]' : 'border border-[#a0e0c0] bg-[#f0fff6] text-[#2a7a50]')}>
                  {permiso.costoNuevoAsiento > 0
                    ? <><strong>Ocupa un asiento nuevo.</strong> Tu plan incluye {PLANES[workspace.plan].asientosIncluidos} y ya usas {ocupados}. Se suma <strong>+${permiso.costoNuevoAsiento} / mes</strong>.</>
                    : <><strong>Usa un asiento incluido</strong> en tu plan {PLANES[workspace.plan].nombre}.</>}
                </div>
              </>
            )}
            {paso === 2 && (
              <div className="flex flex-col gap-1.5">
                {bodasActivas.length === 0 && <p className="text-sm text-[#888]">No tienes bodas activas todavía.</p>}
                {bodasActivas.map(b => {
                  const on = elegidas.has(b.id)
                  return (
                    <label key={b.id} className={'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ' + (on ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] bg-white')}>
                      <input type="checkbox" checked={on} onChange={() => setElegidas(prev => { const n = new Set(prev); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n })} className="accent-[#48C9B0]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#1D1E20]">{b.name}</span>
                        <span className="block text-[11px] text-[#999]">{b.event_date ?? 'Sin fecha'}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            {paso === 3 && rol === 'admin' && (
              <p className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5 text-[13px] text-[#666]">Como administrador entra a todas las bodas con acceso total y puede repartir accesos. No hay permisos que ajustar.</p>
            )}
            {paso === 3 && rol === 'colaborador' && bodaActual && (
              <>
                {elegidas.size > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {[...elegidas].map(id => (
                      <button key={id} type="button" onClick={() => setBodaActual(id)}
                        className={'rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + (bodaActual === id ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] text-[#666]')}>
                        {workspace.bodas.find(b => b.id === id)?.name}
                      </button>
                    ))}
                  </div>
                )}
                <PermisosEditor
                  permisos={permisosDe(bodaActual)}
                  features={workspace.bodas.find(b => b.id === bodaActual)!.features}
                  onChange={next => setPermisos(prev => ({ ...prev, [bodaActual]: next }))}
                />
              </>
            )}
            {error && <p className="text-xs text-[#cc3333]">{error}</p>}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {token ? (
          <button className={btnCta + ' ml-auto'} onClick={onClose}>Listo</button>
        ) : !permiso.ok ? (
          <button className={btnSec + ' ml-auto'} onClick={onClose}>Cerrar</button>
        ) : (
          <>
            {paso > 1 && <button className={btnSec} onClick={() => setPaso((paso === 3 && rol === 'admin' ? 1 : paso - 1) as Paso)}>Atrás</button>}
            <button className={btnSec} onClick={onClose}>Cancelar</button>
            {paso < 3
              ? <button className={btnCta + ' ml-auto'} onClick={siguiente}>{paso === 1 ? (rol === 'admin' ? 'Siguiente' : 'Siguiente: bodas') : 'Siguiente: permisos'}</button>
              : <button className={btnCta + ' ml-auto'} disabled={guardando} onClick={guardar}>{guardando ? 'Creando…' : 'Crear enlace'}</button>}
          </>
        )}
      </Modal.Footer>
    </Modal>
  )
}
```

Si `PermisosEditor` no se puede importar desde `app/events/[id]/configuracion/` por la ruta con corchetes, muevelo a `app/components/workspace/PermisosEditor.tsx` y deja en el lugar viejo un `export { PermisosEditor } from '@/app/components/workspace/PermisosEditor'`.

- [ ] **Step 2: InvitarClienteModal**

```tsx
// app/components/workspace/InvitarClienteModal.tsx
'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { postJson } from '@/lib/workspace/cliente'
import type { WorkspaceResumen } from '@/lib/workspace/tipos'

interface Props {
  open: boolean
  onClose: () => void
  workspace: WorkspaceResumen
  bodaFija?: string
  onHecho: (r: { inviteToken: string }) => void
}

export function InvitarClienteModal({ open, onClose, workspace, bodaFija, onHecho }: Props) {
  const [email, setEmail] = useState('')
  const [eventId, setEventId] = useState(bodaFija ?? workspace.bodas[0]?.id ?? '')
  const [punto, setPunto] = useState<'ver' | 'editar'>('ver')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      const r = await postJson('/api/workspace/clientes', { workspaceId: workspace.id, eventId, email: email.trim(), puntoDePartida: punto })
      setToken(r.inviteToken)
      onHecho({ inviteToken: r.inviteToken })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally { setGuardando(false) }
  }
  const link = token ? `${window.location.origin}/invite/${token}` : ''
  const copiar = async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }
  const inputCls = 'mt-1 w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]'

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header title={token ? 'Invitación lista' : 'Invitar cliente'} subtitle="Los novios, sus papás, quien sea de esa boda. Entra solo ahí y no ocupa asiento." />
      <Modal.Body>
        {token ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-[#666]">{link}</span>
            <button onClick={copiar} className="flex items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
              {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-[#666]">Correo
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@correo.com" autoFocus className={inputCls} />
            </label>
            <label className="text-xs font-semibold text-[#666]">Boda
              <select value={eventId} onChange={e => setEventId(e.target.value)} disabled={!!bodaFija} className={inputCls}>
                {workspace.bodas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <div>
              <p className="text-xs font-semibold text-[#666]">Punto de partida</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {([['ver', 'Solo lectura', 'Ve todo, no toca nada'], ['editar', 'Puede editar', 'Agrega y corrige, no borra']] as const).map(([v, l, d]) => (
                  <button key={v} type="button" onClick={() => setPunto(v)}
                    className={'rounded-lg border px-3 py-2.5 text-left transition ' + (punto === v ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e0e0e0] bg-white hover:border-[#48C9B0]')}>
                    <span className="block text-[12px] font-semibold text-[#1D1E20]">{l}</span>
                    <span className="block text-[11px] text-[#888]">{d}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-[#aaa]">Después le ajustas herramienta por herramienta desde la pestaña Equipo de la boda.</p>
            </div>
            {error && <p className="text-xs text-[#cc3333]">{error}</p>}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]" onClick={onClose}>{token ? 'Listo' : 'Cancelar'}</button>
        {!token && <button className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] disabled:opacity-60" disabled={guardando || !email.trim() || !eventId} onClick={guardar}>{guardando ? 'Creando…' : 'Crear enlace'}</button>}
      </Modal.Footer>
    </Modal>
  )
}
```

- [ ] **Step 3: FichaMiembroModal**

```tsx
// app/components/workspace/FichaMiembroModal.tsx
'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { PermisosEditor } from '@/app/events/[id]/configuracion/PermisosEditor'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
import { deleteJson, patchJson } from '@/lib/workspace/cliente'
import { kitDesde } from '@/lib/workspace/invitacion'
import { ROL_LABEL, type Miembro, type RolInvitable, type WorkspaceResumen } from '@/lib/workspace/tipos'

interface Props {
  open: boolean
  onClose: () => void
  workspace: WorkspaceResumen
  miembro: Miembro
  onHecho: () => void
}

export function FichaMiembroModal({ open, onClose, workspace, miembro, onHecho }: Props) {
  const confirm = useConfirm()
  const [rol, setRol] = useState<RolInvitable>(miembro.rol === 'admin' ? 'admin' : 'colaborador')
  const [bodas, setBodas] = useState<Record<string, PermisosEvento>>(
    Object.fromEntries(miembro.bodas.filter(b => b.status !== 'revoked').map(b => [b.eventId, b.permisos])),
  )
  const [abierta, setAbierta] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const kit = kitDesde(miembro.bodas)
  const bodasActivas = workspace.bodas.filter(b => b.event_status !== 'archived' && b.event_status !== 'cancelled')

  const alternar = (eventId: string) => {
    setBodas(prev => {
      const n = { ...prev }
      if (n[eventId]) delete n[eventId]
      else {
        const boda = workspace.bodas.find(b => b.id === eventId)!
        n[eventId] = aplicarKit(Object.keys(kit).length ? kit : permisosDeRol('editor'), boda.features)
      }
      return n
    })
  }

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      await patchJson(`/api/workspace/miembros/${miembro.id}`, {
        rol,
        bodas: rol === 'admin' ? [] : Object.entries(bodas).map(([eventId, permisos]) => ({ eventId, permisos })),
      })
      onHecho(); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setGuardando(false) }
  }

  const revocar = async () => {
    const ok = await confirm({
      title: `¿Quitar a ${miembro.nombre ?? miembro.email} del workspace?`,
      message: 'Pierde el acceso a todas sus bodas. Su asiento se libera. Puedes volver a invitarla después.',
      confirmText: 'Quitar', danger: true,
    })
    if (!ok) return
    setGuardando(true)
    try { await deleteJson(`/api/workspace/miembros/${miembro.id}`); onHecho(); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo quitar') }
    finally { setGuardando(false) }
  }

  const link = miembro.invite_token ? `${window.location.origin}/invite/${miembro.invite_token}` : ''
  const copiar = async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <Modal.Header title={miembro.nombre ?? miembro.email} subtitle={miembro.email + ' · ' + ROL_LABEL[miembro.rol] + (miembro.status === 'pending' ? ' · Invitación pendiente' : '')} />
      <Modal.Body>
        <div className="flex flex-col gap-4">
          {miembro.status === 'pending' && link && (
            <div className="flex items-center gap-2 rounded-lg border border-[#f0dfae] bg-[#fffbf0] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-[#7a5a14]">Todavía no entra. Enlace: {link}</span>
              <button onClick={copiar} className="flex items-center gap-1 rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-xs font-semibold text-[#1D1E20]">
                {copiado ? <Check size={12} className="text-[#48C9B0]" /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}
          {!miembro.es_dueno_principal && (
            <div>
              <p className="text-xs font-semibold text-[#666]">Rol en el workspace</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {([['colaborador', 'Colaborador'], ['admin', 'Administrador']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setRol(v)} className={'rounded-lg border px-3 py-2 text-[12px] font-semibold transition ' + (rol === v ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : 'border-[#e0e0e0] text-[#666]')}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {rol === 'admin' || miembro.es_dueno_principal ? (
            <p className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2.5 text-[13px] text-[#666]">Entra a todas las bodas con acceso total.</p>
          ) : (
            <div>
              <p className="text-xs font-semibold text-[#666]">Bodas y permisos</p>
              <div className="mt-1 flex flex-col gap-1.5">
                {bodasActivas.map(b => {
                  const on = !!bodas[b.id]
                  return (
                    <div key={b.id} className={'rounded-lg border ' + (on ? 'border-[#48C9B0]' : 'border-[#e0e0e0]')}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <input type="checkbox" checked={on} onChange={() => alternar(b.id)} className="accent-[#48C9B0]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1D1E20]">{b.name}</span>
                        {on && <button type="button" onClick={() => setAbierta(abierta === b.id ? null : b.id)} className="text-[11px] font-semibold text-[#1a9e88]">{abierta === b.id ? 'Cerrar' : 'Permisos'}</button>}
                      </div>
                      {on && abierta === b.id && (
                        <div className="border-t border-[#e8e8e8] px-3 py-3">
                          <PermisosEditor permisos={bodas[b.id]} features={b.features} onChange={next => setBodas(prev => ({ ...prev, [b.id]: next }))} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-[#cc3333]">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Footer>
        {!miembro.es_dueno_principal && <button className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-4 py-2 text-sm text-[#cc3333]" disabled={guardando} onClick={revocar}>Quitar del workspace</button>}
        <button className="ml-auto rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#888] transition hover:bg-[#f5f5f5]" onClick={onClose}>Cancelar</button>
        {!miembro.es_dueno_principal && <button className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-[#08312a] disabled:opacity-60" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>}
      </Modal.Footer>
    </Modal>
  )
}
```

Revisa la firma real de `useConfirm()` en `app/components/ui/ConfirmModal.tsx` (que campos acepta: `title`, `message`, `confirmText`, `danger` o sus nombres reales) y ajusta la llamada.

- [ ] **Step 4: La pagina**

```tsx
// app/cuenta/equipo/page.tsx
'use client'
import { useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { AltaPersonaModal } from '@/app/components/workspace/AltaPersonaModal'
import { FichaMiembroModal } from '@/app/components/workspace/FichaMiembroModal'
import { InvitarClienteModal } from '@/app/components/workspace/InvitarClienteModal'
import { resumenAsientos } from '@/lib/workspace/asientos'
import { PLANES } from '@/lib/workspace/planes'
import { ROL_LABEL, type Miembro } from '@/lib/workspace/tipos'
import { useWorkspace } from '../WorkspaceContext'

const TONOS = ['#5b7c99', '#8a6d9c', '#6f9b7a', '#b08a5b', '#7a8a9c', '#9c6f6f']
const tono = (s: string) => TONOS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TONOS.length]
const iniciales = (nombre: string | null, email: string) =>
  (nombre ?? email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')

export default function EquipoPage() {
  const { activo, recargar } = useWorkspace()
  const [alta, setAlta] = useState(false)
  const [cliente, setCliente] = useState(false)
  const [ficha, setFicha] = useState<Miembro | null>(null)
  if (!activo) return null

  const asientos = resumenAsientos(activo.plan, activo.miembros)
  const plan = PLANES[activo.plan]

  const Pastilla = ({ texto, tono }: { texto: string; tono: 'gold' | 'teal' | 'muted' | 'plain' }) => (
    <span className={'rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + ({
      gold: 'border-[#f0dfae] bg-[#fffbf0] text-[#c49a3a]', teal: 'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]',
      muted: 'border-[#e8e8e8] bg-[#f2f2f2] text-[#999]', plain: 'border-[#e0e0e0] text-[#666]',
    })[tono]}>{texto}</span>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1D1E20]">Equipo</h2>
          <p className="text-xs text-[#888]">Quién existe en tu workspace y a qué bodas entra.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCliente(true)} className="rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]">Invitar cliente</button>
          <button onClick={() => setAlta(true)} className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-sm font-semibold text-[#08312a]"><UserPlus size={14} /> Agregar persona</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[
          ['Asientos', `${asientos.ocupados}`, 'ocupados'],
          [`Incluidos en ${plan.nombre}`, `${asientos.incluidos}`, ''],
          ['Extra', `${asientos.extra}`, asientos.extra > 0 ? `· $${asientos.costoExtraMensual.toLocaleString('es-MX')} / mes` : ''],
        ].map(([k, v, s]) => (
          <div key={k} className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">{k}</p>
            <p className="text-xl font-bold text-[#1D1E20]">{v} <span className="text-xs font-medium text-[#888]">{s}</span></p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
        <div className="hidden grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 bg-[#f8f8f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#999] sm:grid">
          <span /><span>Persona</span><span>En el workspace</span><span>Bodas</span><span />
        </div>
        {activo.miembros.map(m => {
          const bodas = m.bodas.filter(b => b.status !== 'revoked')
          const esAdmin = m.rol === 'dueno' || m.rol === 'admin'
          return (
            <div key={m.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e8e8e8] px-3 py-2.5 sm:grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: tono(m.email) }}>{iniciales(m.nombre, m.email)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#1D1E20]">{m.nombre ?? m.email}</span>
                <span className="block truncate text-xs text-[#999]">{m.email}</span>
              </span>
              <span className="hidden flex-wrap gap-1 sm:flex">
                <Pastilla texto={m.es_dueno_principal ? 'Dueño principal' : ROL_LABEL[m.rol]} tono={m.es_dueno_principal ? 'gold' : 'plain'} />
                {m.status === 'pending' && <Pastilla texto="Invitación pendiente" tono="muted" />}
              </span>
              <span className="hidden text-sm text-[#666] sm:block">
                {esAdmin ? `Todas (${activo.bodas.length})` : bodas.length === 0 ? 'Ninguna' : bodas.length === 1 ? bodas[0].name : `${bodas.length} bodas`}
              </span>
              {m.es_dueno_principal
                ? <Pastilla texto="Eres tú" tono="muted" />
                : <button onClick={() => setFicha(m)} className="rounded-md px-2 py-1 text-sm font-semibold text-[#666] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]">Editar</button>}
            </div>
          )
        })}
        <div className="border-t border-[#e8e8e8] bg-[#f8f8f8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#999]">Clientes · no ocupan asiento</div>
        {activo.clientes.length === 0 && (
          <p className="border-t border-[#e8e8e8] px-3 py-4 text-center text-xs text-[#aaa]">Todavía no has invitado clientes.</p>
        )}
        {activo.clientes.map(c => (
          <div key={c.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e8e8e8] px-3 py-2.5 sm:grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: tono(c.email) }}>{iniciales(null, c.email)}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#1D1E20]">{c.email}</span></span>
            <span className="hidden gap-1 sm:flex"><Pastilla texto="Cliente" tono="teal" />{c.status === 'pending' && <Pastilla texto="Invitación pendiente" tono="muted" />}</span>
            <span className="hidden truncate text-sm text-[#666] sm:block">{c.eventName}</span>
            <a href={`/events/${c.eventId}/configuracion?tab=equipo`} className="rounded-md px-2 py-1 text-sm font-semibold text-[#666] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]">Editar</a>
          </div>
        ))}
      </div>

      {activo.miembros.length <= 1 && activo.plan === 'free' && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#888]"><Users size={14} /> Tu plan Free es solo para ti. Con Pro puedes agregar personas a tu equipo.</p>
      )}

      {alta && <AltaPersonaModal open onClose={() => setAlta(false)} workspace={activo} onHecho={() => recargar()} />}
      {cliente && <InvitarClienteModal open onClose={() => setCliente(false)} workspace={activo} onHecho={() => recargar()} />}
      {ficha && <FichaMiembroModal open onClose={() => setFicha(null)} workspace={activo} miembro={ficha} onHecho={() => recargar()} />}
    </div>
  )
}
```

Los `style={{ background }}` del avatar son la excepcion justificada: el tono sale del nombre (regla del Tramo 4).

- [ ] **Step 5: Verify by hand**

Con tu cuenta (Free hasta que corras el SQL o te subas a Pro en `/admin`): `/cuenta/equipo` muestra tu fila como Dueño principal, "1 ocupado · 1 incluido · 0 extra". "Agregar persona" muestra el aviso de Pro. Subete a Pro en `/admin` (si el SQL corrio) o cambia temporalmente el plan en local: el alta de 3 pasos crea a Regina con dos bodas, aparece pendiente con asiento contado, "Editar" abre la ficha, "Quitar" la revoca. "Invitar cliente" crea el enlace y la lista de clientes la muestra.

- [ ] **Step 6: Commit**

```bash
git add app/components/workspace app/cuenta/equipo/page.tsx
git commit -m "feat(workspace): pantalla de equipo con asientos, alta en tres pasos, ficha y clientes"
```

---

### Task 13: La pestana Equipo de la boda usa los mismos modales

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx:102-105, 304, 525-546, 1111-1167`

**Interfaces:**
- Consumes: `AltaPersonaModal`, `InvitarClienteModal` (Task 12), `fetchWorkspace` (Task 7).

- [ ] **Step 1: Cargar el workspace de la boda**

Agrega estado `const [workspace, setWorkspace] = useState<WorkspaceResumen | null>(null)`, `const [modalEquipo, setModalEquipo] = useState<'persona' | 'cliente' | null>(null)`. En el `useEffect` que carga el evento (donde ya lee `events`), lee tambien `workspace_id` y, si viene, `fetchWorkspace(workspace_id).then(r => setWorkspace(r.activo)).catch(() => setWorkspace(null))`. Si `fetchWorkspace` responde 403 (eres dueño del evento pero no administras el workspace: caso raro, evento movido a mano), `workspace` queda `null` y los botones se deshabilitan con el titulo "Administra el equipo desde el workspace".

- [ ] **Step 2: Reemplazar la columna de invitar**

Borra `ROLES`, `inviteRole`, `inviteEmail`, `inviteError`, `inviting` y `handleInvite`. Reemplaza el bloque de la columna izquierda ("Invitar a este evento", lineas ~1114-1167) por:

```tsx
                <div className="rounded-xl border border-[#e8e8e8] bg-white p-4 lg:sticky lg:top-0">
                  <div className="mb-1 flex items-center gap-2">
                    <UserPlus size={16} className="text-[#48C9B0]" />
                    <h2 className="text-sm font-semibold text-[#1D1E20]">Dar acceso a esta boda</h2>
                  </div>
                  <p className="mb-3 text-xs text-[#888]">Tu equipo entra por el workspace; el cliente, solo aquí.</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setModalEquipo('persona')}
                      disabled={!workspace}
                      title={workspace ? undefined : 'Administra el equipo desde el workspace'}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-[#08312a] transition disabled:opacity-40"
                    >
                      <UserPlus size={14} /> Agregar persona del equipo
                    </button>
                    <button
                      onClick={() => setModalEquipo('cliente')}
                      disabled={!workspace}
                      className="w-full rounded-lg border border-[#e0e0e0] bg-white px-4 py-2.5 text-sm font-semibold text-[#1D1E20] transition hover:border-[#48C9B0] disabled:opacity-40"
                    >
                      Invitar cliente
                    </button>
                    <p className="text-[11px] leading-relaxed text-[#aaa]">Después le ajustas herramienta por herramienta con el engrane.</p>
                  </div>
                </div>
```

Y junto al modal de permisos que ya existe al final de la pestana, agrega:

```tsx
              {workspace && modalEquipo === 'persona' && (
                <AltaPersonaModal open onClose={() => setModalEquipo(null)} workspace={workspace} bodaFija={id as string}
                  onHecho={() => { recargarColaboradores(); fetchWorkspace(workspace.id).then(r => setWorkspace(r.activo)).catch(() => {}) }} />
              )}
              {workspace && modalEquipo === 'cliente' && (
                <InvitarClienteModal open onClose={() => setModalEquipo(null)} workspace={workspace} bodaFija={id as string}
                  onHecho={() => recargarColaboradores()} />
              )}
```

`recargarColaboradores` es la consulta que ya existe en la linea ~345 (`from('event_collaborators').select('*')...`); si esta inline dentro del `useEffect`, extraela a una funcion con `useCallback` para poder llamarla desde aqui.

- [ ] **Step 3: La lista distingue equipo y cliente**

En cada fila de "Personas con acceso", junto al correo, agrega `{c.tipo === 'cliente' && <span className="rounded-full border border-[#48C9B0] bg-[#f0fdfb] px-1.5 py-px text-[10px] font-semibold text-[#1a9e88]">Cliente</span>}`.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npm test`. En local, desde una boda: "Agregar persona del equipo" abre el alta con esa boda ya palomeada; "Invitar cliente" con la boda fija.

```bash
git add "app/events/[id]/configuracion/page.tsx"
git commit -m "feat(workspace): la pestana Equipo de la boda invita por el workspace"
```

---

### Task 14: SQL de la tanda 2 — equipo sin asiento

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-08-workspace-equipo.sql`

- [ ] **Step 1: Write the file**

```sql
-- Tramo 5, el workspace — tanda 2: equipo de boda sin asiento -> miembro.
--
-- REQUISITO: 2026-09-08-workspace-cimiento.sql corrido, y el codigo de la
-- tanda 2 en main y desplegado.
--
-- QUE HACE: a cada persona de equipo (tipo 'equipo' o NULL) que tiene acceso a
-- una boda y NO tiene fila en workspace_members del workspace de esa boda, le
-- crea una: colaborador, active si ya acepto (user_id), pending si no. Un
-- correo en varias bodas del mismo workspace produce UNA fila.
--
-- Medido el 7-sep: 9 filas de event_collaborators, ninguna de
-- bodasplanner@hotmail.com. Si alguna es en realidad un cliente (una novia),
-- marcala ANTES con: UPDATE event_collaborators SET tipo='cliente' WHERE id=...
-- RE-CORRIBLE: el NOT EXISTS lo hace idempotente.

-- ============================================================
-- 0. PREVIO (solo lectura): lo que va a crear
-- ============================================================
SELECT e.workspace_id, lower(c.email) AS email,
       bool_or(c.user_id IS NOT NULL) AS ya_acepto,
       count(*) AS bodas, string_agg(e.name, ' | ') AS cuales
  FROM event_collaborators c
  JOIN events e ON e.id = c.event_id
 WHERE c.status <> 'revoked'
   AND coalesce(c.tipo, 'equipo') = 'equipo'
   AND e.workspace_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM workspace_members m
                    WHERE m.workspace_id = e.workspace_id AND lower(m.email) = lower(c.email))
 GROUP BY e.workspace_id, lower(c.email)
 ORDER BY 1, 2;

BEGIN;

INSERT INTO workspace_members (workspace_id, user_id, email, rol, es_dueno_principal, status, invited_by, invite_token, accepted_at, kit_habitual)
SELECT e.workspace_id,
       max(c.user_id::text)::uuid,
       lower(c.email),
       'colaborador',
       false,
       CASE WHEN bool_or(c.user_id IS NOT NULL) THEN 'active' ELSE 'pending' END,
       max(c.invited_by::text)::uuid,
       gen_random_uuid()::text,
       CASE WHEN bool_or(c.user_id IS NOT NULL) THEN min(coalesce(c.accepted_at, c.invited_at)) END,
       NULL
  FROM event_collaborators c
  JOIN events e ON e.id = c.event_id
 WHERE c.status <> 'revoked'
   AND coalesce(c.tipo, 'equipo') = 'equipo'
   AND e.workspace_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM workspace_members m
                    WHERE m.workspace_id = e.workspace_id AND lower(m.email) = lower(c.email))
 GROUP BY e.workspace_id, lower(c.email)
ON CONFLICT DO NOTHING;

-- Las filas con tipo NULL se normalizan a 'equipo'.
UPDATE event_collaborators SET tipo = 'equipo' WHERE tipo IS NULL;

COMMIT;

-- ============================================================
-- VERIFICACION (solo lectura): esperado 0
-- ============================================================
SELECT count(*) AS equipo_sin_asiento
  FROM event_collaborators c
  JOIN events e ON e.id = c.event_id
 WHERE c.status <> 'revoked' AND c.tipo = 'equipo' AND e.workspace_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM workspace_members m
                    WHERE m.workspace_id = e.workspace_id AND lower(m.email) = lower(c.email));

-- ============================================================
-- DESHACER: las filas que creo este script son las de rol colaborador cuyo
-- invited_at coincide con la corrida (default now()):
-- DELETE FROM workspace_members WHERE rol = 'colaborador' AND invited_at >= '<fecha de la corrida>';
```

Ojo: si `workspace_members_un_usuario` (indice unico por `workspace_id, user_id`) choca porque la misma cuenta aparece con dos correos (`testviewer@` y `diego.garza17@` son la misma cuenta), el `ON CONFLICT DO NOTHING` deja pasar la primera y salta la segunda. El previo lo enseña; es correcto.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-08-workspace-equipo.sql
git commit -m "docs(sql): migracion del equipo de boda sin asiento a miembros del workspace"
```

---

### Task 15: Verificacion final antes del PR

- [ ] **Step 1: Todo verde**

Run: `npx tsc --noEmit && npm test && npx eslint app/cuenta app/components/workspace app/api/workspace lib/workspace`
Expected: sin errores; eslint sin nada nuevo en los archivos tocados.

- [ ] **Step 2: Recorrido completo en local con Diego** (dev server en el puerto del worktree)

1. Como Diego (dueño): `/cuenta/equipo` con tu fila y las 43 bodas en el alta. Sube tu plan a Pro desde `/admin` (o directo en local) y agrega a `diego.garza17@gmail.com` como colaborador en dos bodas con permisos distintos.
2. En ventana privada, abre el enlace, entra con esa cuenta: aterrizas en la primera boda con esos permisos; en la otra, los otros.
3. De vuelta como Diego: la persona sale activa, 2 asientos ocupados, 1 extra $290. "Editar": quitale una boda, guarda; en la otra sesion esa boda desaparece del dashboard al refrescar.
4. "Invitar cliente" desde una boda: el enlace funciona, el cliente no ocupa asiento y no aparece en la lista de equipo.
5. "Quitar del workspace": la persona pierde las dos bodas de un golpe.
6. Free: baja tu plan a Free; "Agregar persona" muestra el aviso; "Invitar cliente" sigue funcionando.

- [ ] **Step 3: Build y PR**

Con el dev server apagado: `npm run build`. Luego push de la rama y PR contra `main` (con permiso de Diego), con el orden de SQL en la descripcion: primero `2026-09-08-workspace-cimiento.sql`, despues `2026-09-08-workspace-equipo.sql`, ambos DESPUES del deploy.
