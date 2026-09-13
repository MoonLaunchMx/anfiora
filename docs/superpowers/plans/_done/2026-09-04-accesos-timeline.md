# Timeline gateado y pantalla de Equipo — plan de implementación (Tramo 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el permiso por herramienta se sienta por primera vez: el menú esconde lo que no te toca, la pantalla de Equipo reparte accesos, y el Timeline queda gateado de punta a punta — interfaz y base de datos.

**Architecture:** El cimiento del Tramo 1 ya existe y nadie lo consume. Este tramo lo enchufa a **un solo módulo**, `timeline`, y a las dos superficies transversales (el menú y la puerta de las rutas). Todo cuelga de `nivelDeModulo()` del lado de la app y de `puede_ver/puede_editar/puede_borrar(evento, 'timeline')` del lado de Postgres. **Después de este tramo se para una semana** a usarlo con una sesión de colaborador de verdad, antes de repetirlo en los otros once módulos.

**Tech Stack:** Next 16 App Router, React 19, TypeScript, Supabase (Postgres + RLS), Vitest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-04-accesos-por-herramienta-design.md`
**Tramo anterior:** `docs/superpowers/plans/2026-09-04-accesos-cimiento.md` — su sección **Bloqueantes del Tramo 2** es el punto de partida de este plan.
**Wireframe aprobado:** https://claude.ai/code/artifact/4efc6a59-1da9-4695-b8e0-dac6d14a952a

## Global Constraints

- **Idioma de la interfaz: español, con acentos.** Los mensajes de commit van **sin acentos ni ñ**.
- **Sin emojis** en interfaz ni en código. Iconos de `lucide-react`.
- **Solo Tailwind** para estilos. Botones de acción en teal `#48C9B0`; el negro `#1D1E20` es exclusivo de dropdowns de filtro.
- **Sin comentarios** salvo cuando el *porqué* no es obvio.
- **Vitest solo para lógica pura.** La interfaz se verifica en **preview**, no en local: mientras otro agente trabaje en este checkout, no se levanta `npm run dev`. Al terminar una tarea con cambios de interfaz, se le pasa a Diego **la URL del preview** y qué revisar, en lenguaje de producto.
- **Nunca correr SQL en Supabase.** Los `.sql` se escriben y se commitean; los corre Diego.
- Los cuatro niveles son exactamente `'ninguno' | 'ver' | 'editar' | 'total'`. Las tres acciones son exactamente `'ver' | 'editar' | 'borrar'`.
- **`editar` nunca implica `borrar`.** Solo `total` borra.
- **Un control que no se puede usar no se dibuja.** No deshabilitado, no en gris, no con candado.
- **El menú esconde la herramienta que no te toca** (decisión de Diego, 4-sep). No la muestra apagada.
- **Configuración es de dueños y administradores**, nadie más, ni para mirar. Equipo y Actividad viven dentro.
- Ninguna pantalla aplica un cambio en la interfaz antes de que la base lo confirme.

## Estado de la base, ya leído (no re-investigar)

Verificado en producción el 4-sep, después de correr el Tramo 1:

- **`event_timeline_tasks`** tiene dos policies: `Planners can manage their own timeline tasks` (ALL, con la condición `events.user_id = auth.uid()` escrita a mano, sin usar los helpers) y `collaborators can read timeline_tasks` (SELECT, dueño ∪ colaboradores activos). **Ésta es la causa exacta del "se ve normal y no guarda".**
- **`event_itinerary_moments`** ya está bien: `itinerary_editor_write` (ALL, `is_event_editor`) e `itinerary_member_select` (SELECT, `is_event_member`).
- Los cuatro helpers (`is_event_owner`, `is_event_member`, `is_event_editor`, `is_event_admin`) son `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'` — **sin `pg_temp`**.
- **No hay índice único en `event_collaborators(event_id, user_id)`.** Hay tres pares duplicados, pero en los tres **solo una fila está `active`** y el resto `revoked`. Nadie está bloqueado hoy.
- **`event_audit_log`**: `user_id` y `user_name` aceptan NULL, `user_email` es NOT NULL, **no hay ningún CHECK** sobre `action` ni `entity_type`, y la llave `event_id -> events(id)` es **`ON DELETE CASCADE`**.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `app/components/ui/SinAcceso.tsx` | **Crear.** La pantalla de "esto no te toca", con salida |
| `lib/permisos/rutas.ts` | **Crear.** El puente ruta del nav → módulo, y el filtro del menú. Lógica pura |
| `lib/permisos/rutas.test.ts` | **Crear.** Que el filtro esconda lo correcto y no de más |
| `app/events/[id]/layout.tsx` | **Modificar.** Filtrar el nav por permiso y cerrar la puerta de la ruta |
| `app/events/[id]/configuracion/PermisosEditor.tsx` | **Crear.** Los doce módulos con su nivel. Sin lógica: recibe y avisa |
| `app/events/[id]/configuracion/page.tsx` | **Modificar.** La invitación escribe permisos; cada colaborador se edita con el editor |
| `app/events/[id]/timeline/page.tsx` | **Modificar.** Envolver los controles de mutación |
| `app/events/[id]/timeline/TaskModal.tsx` | **Modificar.** Guardar solo con permiso; borrar solo con Total |
| `app/events/[id]/timeline/ItineraryToolbar.tsx` | **Modificar.** Envolver los controles de mutación |
| `app/events/[id]/timeline/MomentCard.tsx` | **Modificar.** Envolver editar y borrar |
| `docs/superpowers/plans/sql/2026-09-05-accesos-timeline-cimiento.sql` | **Crear.** Índice único parcial y `pg_temp` en los helpers |
| `docs/superpowers/plans/sql/2026-09-05-accesos-timeline-policies.sql` | **Crear.** Las policies del Timeline y sus disparadores de bitácora |

**Dos desvíos deliberados del spec, y su razón:**

**1. Los helpers no se reimplementan encima de `nivel_en`.** El §5.3 del spec decía que sí. Leyendo sus cuerpos reales quedó claro que **no se puede sin abrir un hueco**: `is_event_editor` significa "puede escribir *todo* el evento", y `nivel_en` es por módulo. Reimplementarlo como "puede editar *algún* módulo" le daría a alguien con solo `pagos: editar` permiso de escritura sobre `events`, `guests` y `tables`. Se hace lo contrario: **cada tabla se muda a su `puede_*` cuando le toca su tramo**, y los helpers se borran cuando ninguna policy los llame. Lo único que se les toca aquí es agregarles `pg_temp`.

**2. `hasAccess` no cambia todavía.** El §6 del spec dice que el acceso es la suma de las herramientas. Cambiar `hasAccess` hoy toca todas las pantallas a la vez, que es lo contrario de la idea de este tramo. La puerta de la ruta (Tarea 1) consigue el mismo efecto práctico —sin módulos no entras a ningún lado— sin tocar nada más. `hasAccess` se deriva de `resumir()` en el Tramo 3.

---

## Task 1: La puerta — el menú esconde y la ruta cierra

**Files:**
- Create: `app/components/ui/SinAcceso.tsx`
- Create: `lib/permisos/rutas.ts`
- Test: `lib/permisos/rutas.test.ts`
- Modify: `app/events/[id]/layout.tsx`

**Interfaces:**
- Consumes: `MODULOS_CONFIG`, `type Modulo`, `type Nivel` de `@/lib/permisos/catalogo`; `useEventAccess` de `@/lib/event-access-context`
- Produces:
  - `MODULO_POR_RUTA: Record<string, Modulo>` — de la ruta del nav (`''`, `'/timeline'`, …) al módulo
  - `moduloDeRutaNav(path: string): Modulo | null`
  - `filtrarPorPermiso<T extends { type: string }>(entries: T[], nivel: (m: Modulo) => Nivel): T[]` — se tipa contra la forma real del nav en el layout
  - `<SinAcceso modulo="pagos" />`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/permisos/rutas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MODULO_POR_RUTA, moduloDeRutaNav, filtrarPorPermiso } from './rutas'
import { MODULOS_CONFIG, type Modulo, type Nivel } from './catalogo'

const TODO_TOTAL = (): Nivel => 'total'
const NADA = (): Nivel => 'ninguno'

type Entrada =
  | { type: 'item'; path: string }
  | { type: 'group'; defaultPath: string; children: { path: string }[] }

const NAV: Entrada[] = [
  { type: 'item', path: '' },
  { type: 'item', path: '/timeline' },
  { type: 'item', path: '/configuracion' },
  { type: 'group', defaultPath: '/presupuesto', children: [
    { path: '/presupuesto' }, { path: '/proveedores' }, { path: '/pagos' },
  ] },
]

describe('MODULO_POR_RUTA', () => {
  it('cubre las rutas de los doce modulos', () => {
    for (const m of MODULOS_CONFIG) {
      for (const r of m.rutas) expect(MODULO_POR_RUTA[r]).toBe(m.key)
    }
  })

  it('la raiz del evento es invitados', () => {
    expect(moduloDeRutaNav('')).toBe('invitados')
  })

  it('configuracion y comida no son modulos', () => {
    expect(moduloDeRutaNav('/configuracion')).toBeNull()
    expect(moduloDeRutaNav('/comida')).toBeNull()
  })
})

describe('filtrarPorPermiso', () => {
  it('con todo en total no esconde nada', () => {
    expect(filtrarPorPermiso(NAV, TODO_TOTAL)).toHaveLength(4)
  })

  it('sin ningun permiso solo sobrevive lo que no es modulo', () => {
    const out = filtrarPorPermiso(NAV, NADA)
    expect(out).toEqual([{ type: 'item', path: '/configuracion' }])
  })

  it('esconde el modulo que esta en ninguno y deja los demas', () => {
    const nivel = (m: Modulo): Nivel => (m === 'timeline' ? 'ninguno' : 'ver')
    const paths = filtrarPorPermiso(NAV, nivel)
      .filter((e): e is Extract<Entrada, { type: 'item' }> => e.type === 'item')
      .map(e => e.path)
    expect(paths).not.toContain('/timeline')
    expect(paths).toContain('')
  })

  it('un grupo se queda con los hijos permitidos', () => {
    const nivel = (m: Modulo): Nivel => (m === 'pagos' ? 'ninguno' : 'ver')
    const grupo = filtrarPorPermiso(NAV, nivel)
      .find((e): e is Extract<Entrada, { type: 'group' }> => e.type === 'group')!
    expect(grupo.children.map(c => c.path)).toEqual(['/presupuesto', '/proveedores'])
  })

  it('un grupo sin hijos permitidos desaparece entero', () => {
    const nivel = (m: Modulo): Nivel =>
      (['presupuesto', 'proveedores', 'pagos'] as Modulo[]).includes(m) ? 'ninguno' : 'ver'
    expect(filtrarPorPermiso(NAV, nivel).some(e => e.type === 'group')).toBe(false)
  })

  it('si el destino del grupo se escondio, apunta al primer hijo que quedo', () => {
    const nivel = (m: Modulo): Nivel => (m === 'presupuesto' ? 'ninguno' : 'ver')
    const grupo = filtrarPorPermiso(NAV, nivel)
      .find((e): e is Extract<Entrada, { type: 'group' }> => e.type === 'group')!
    expect(grupo.defaultPath).toBe('/proveedores')
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/permisos/rutas.test.ts`
Expected: FAIL — `Failed to resolve import "./rutas"`

- [ ] **Step 3: Escribir `lib/permisos/rutas.ts`**

```ts
import { MODULOS_CONFIG, type Modulo, type Nivel } from './catalogo'

export const MODULO_POR_RUTA: Record<string, Modulo> = Object.fromEntries(
  MODULOS_CONFIG.flatMap(m => m.rutas.map(r => [r, m.key])),
)

export function moduloDeRutaNav(path: string): Modulo | null {
  return MODULO_POR_RUTA[path] ?? null
}

type EntradaNav =
  | { type: 'item'; path: string }
  | { type: 'group'; defaultPath: string; children: { path: string }[] }

// Una ruta que no es modulo (configuracion) pasa derecho: su candado es otro.
export function filtrarPorPermiso<T extends EntradaNav>(
  entries: T[],
  nivel: (m: Modulo) => Nivel,
): T[] {
  const permitida = (path: string) => {
    const m = moduloDeRutaNav(path)
    return m === null || nivel(m) !== 'ninguno'
  }

  const out: T[] = []
  for (const entry of entries) {
    if (entry.type === 'item') {
      if (permitida(entry.path)) out.push(entry)
      continue
    }
    const children = entry.children.filter(c => permitida(c.path))
    if (children.length === 0) continue
    out.push({
      ...entry,
      children,
      defaultPath: children.some(c => c.path === entry.defaultPath)
        ? entry.defaultPath
        : children[0].path,
    })
  }
  return out
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/permisos/rutas.test.ts`
Expected: PASS

- [ ] **Step 5: Escribir la pantalla de "no te toca"**

Crear `app/components/ui/SinAcceso.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { MODULOS_CONFIG, type Modulo } from '@/lib/permisos/catalogo'

export function SinAcceso({ modulo }: { modulo: Modulo }) {
  const { id } = useParams()
  const label = MODULOS_CONFIG.find(m => m.key === modulo)?.label ?? 'esta herramienta'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-[#e0e0e0] text-[#bbb]">
        <Lock size={18} />
      </span>
      <h2 className="text-[15px] font-semibold text-[#0a0a0a]">
        No tienes acceso a {label} en esta boda
      </h2>
      <p className="max-w-xs text-[13px] text-[#666]">
        Si crees que deberías, pídeselo a quien administra la cuenta.
      </p>
      <Link
        href={`/events/${id}`}
        className="mt-1 rounded-lg bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-[#08312a]"
      >
        Volver a Invitados
      </Link>
    </div>
  )
}
```

- [ ] **Step 6: Enchufarlo al layout**

En `app/events/[id]/layout.tsx`, dentro de `EventLayoutInner`:

Agregar a los imports:

```tsx
import { filtrarPorPermiso, moduloDeRutaNav } from '@/lib/permisos/rutas'
import { SinAcceso } from '@/app/components/ui/SinAcceso'
```

Cambiar la desestructuración del hook para traer `nivelDeModulo` e `isLoading`:

```tsx
  const { canAdmin, features, nivelDeModulo, isLoading } = useEventAccess()
```

Envolver el filtro que ya existe (línea 317) con el nuevo, **por fuera**, para que el permiso se aplique después de las features:

```tsx
  const visibleEntries = filtrarPorPermiso(
    filterNavByFeatures(
      NAV_ITEMS.filter(entry =>
        entry.type === 'item' ? (!entry.adminOnly || canAdmin) : true
      ),
      features,
    ),
    nivelDeModulo,
  )
```

Y justo antes del `return` del componente, cerrar la puerta de la ruta. El sufijo de la ruta actual sale de quitarle el prefijo del evento a `pathname`:

```tsx
  const sufijoRuta = pathname.replace(`/events/${id}`, '').replace(/\/+$/, '')
  const moduloActual = moduloDeRutaNav(sufijoRuta)
  const rutaBloqueada =
    !isLoading && moduloActual !== null && nivelDeModulo(moduloActual) === 'ninguno'
```

Donde el layout renderiza `{children}`, sustituirlo por:

```tsx
  {rutaBloqueada && moduloActual ? <SinAcceso modulo={moduloActual} /> : children}
```

**Importante:** la guarda exige `!isLoading`. Mientras el permiso carga no se bloquea nada — si bloqueara, todo el mundo vería la pantalla de "no te toca" por un instante en cada carga.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/permisos/rutas.ts lib/permisos/rutas.test.ts \
        app/components/ui/SinAcceso.tsx "app/events/[id]/layout.tsx"
git commit -m "feat(accesos): el menu esconde lo que no te toca y la ruta cierra"
```

---

## Task 2: La invitación escribe permisos

Es el **bloqueante 1** del Tramo 1, y va antes que cualquier policy: si no, cada persona que invites después de la migración cae al respaldo legado, que le da `total` en los doce módulos — incluido borrar, que es justo lo que la migración le quitó al editor.

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx`
- Modify: `lib/permisos/resolver.ts`
- Test: `lib/permisos/resolver.test.ts`

**Interfaces:**
- Consumes: `MODULOS`, `type Modulo`, `type Nivel`, `type PermisosEvento` de `@/lib/permisos/catalogo`; `aplicarKit` de `@/lib/permisos/resolver`
- Produces: `permisosDeRol(role: 'admin' | 'editor' | 'viewer'): PermisosEvento` en `lib/permisos/resolver.ts`

- [ ] **Step 1: Escribir la prueba que falla**

Agregar a `lib/permisos/resolver.test.ts` (y sumar `permisosDeRol` al `import` de arriba del archivo):

```ts
describe('permisosDeRol', () => {
  it('un admin nace con total en los doce', () => {
    const p = permisosDeRol('admin')
    expect(Object.keys(p)).toHaveLength(12)
    expect(new Set(Object.values(p))).toEqual(new Set(['total']))
  })

  it('un editor nace pudiendo editar, nunca borrar', () => {
    const p = permisosDeRol('editor')
    expect(new Set(Object.values(p))).toEqual(new Set(['editar']))
  })

  it('un viewer nace solo mirando', () => {
    expect(new Set(Object.values(permisosDeRol('viewer')))).toEqual(new Set(['ver']))
  })

  it('coincide con lo que la migracion escribio para ese rol', () => {
    expect(permisosDeRol('editor').pagos).toBe('editar')
    expect(permisosDeRol('admin').pagos).toBe('total')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run lib/permisos/resolver.test.ts`
Expected: FAIL — `permisosDeRol is not a function`

- [ ] **Step 3: Escribir `permisosDeRol`**

Al final de `lib/permisos/resolver.ts`:

```ts
// El punto de partida de alguien recien invitado. Tiene que dar exactamente lo
// mismo que escribio -migracion-aplicar.sql para ese rol, o la primera persona
// que invites despues de migrar queda con permisos distintos a sus companeros.
export function permisosDeRol(role: 'admin' | 'editor' | 'viewer'): PermisosEvento {
  const nivel: Nivel = role === 'admin' ? 'total' : role === 'editor' ? 'editar' : 'ver'
  return Object.fromEntries(MODULOS.map(m => [m, nivel])) as PermisosEvento
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run lib/permisos/resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Que la invitación lo escriba**

En `app/events/[id]/configuracion/page.tsx`, el `insert` de la invitación (alrededor de la línea 517) hoy es:

```ts
      .insert({ event_id: id, invited_by: user.id, email, role: inviteRole, status: 'pending' })
```

Cambiarlo por:

```ts
      .insert({
        event_id: id, invited_by: user.id, email, role: inviteRole, status: 'pending',
        permisos: aplicarKit(permisosDeRol(inviteRole), features),
        tipo: 'equipo',
      })
```

Agregar a los imports del archivo:

```ts
import { aplicarKit, permisosDeRol } from '@/lib/permisos/resolver'
```

`features` ya está disponible en ese componente vía `useEventAccess()`. `aplicarKit` es lo que descarta los módulos cuya herramienta está apagada en esta boda: no tiene sentido otorgar Playlist en una boda que no la usa.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit` — sin errores
Run: `npm test` — PASS

- [ ] **Step 7: Commit**

```bash
git add lib/permisos/resolver.ts lib/permisos/resolver.test.ts \
        "app/events/[id]/configuracion/page.tsx"
git commit -m "feat(accesos): invitar a una boda ya escribe los permisos"
```

---

## Task 3: El editor de permisos

**Files:**
- Create: `app/events/[id]/configuracion/PermisosEditor.tsx`

**Interfaces:**
- Consumes: `MODULOS_CONFIG`, `type Modulo`, `type Nivel`, `type PermisosEvento` de `@/lib/permisos/catalogo`; `type FeatureKey` de `@/lib/features`
- Produces: `<PermisosEditor permisos features onChange />` con
  `onChange: (siguiente: PermisosEvento) => void`

No lleva prueba de Vitest: no tiene lógica propia, solo dibuja y avisa. La decisión vive en el resolver, que ya está probado.

- [ ] **Step 1: Escribir el componente**

Crear `app/events/[id]/configuracion/PermisosEditor.tsx`:

```tsx
'use client'

import { MODULOS_CONFIG, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import type { FeatureKey } from '@/lib/features'

const GRUPOS: { key: 'boda' | 'herramientas' | 'finanzas'; label: string }[] = [
  { key: 'boda',         label: 'Siempre parte de la boda' },
  { key: 'herramientas', label: 'Herramientas de esta boda' },
  { key: 'finanzas',     label: 'Finanzas' },
]

const NIVELES_VISIBLES: { valor: Nivel; label: string }[] = [
  { valor: 'ver',    label: 'Ver' },
  { valor: 'editar', label: 'Editar' },
  { valor: 'total',  label: 'Total' },
]

interface Props {
  permisos: PermisosEvento
  features: Record<FeatureKey, boolean> | null
  onChange: (siguiente: PermisosEvento) => void
}

export function PermisosEditor({ permisos, features, onChange }: Props) {
  const estaPrendida = (modulo: Modulo) => {
    const f = MODULOS_CONFIG.find(m => m.key === modulo)!.feature
    return f === null || features?.[f] === true
  }

  const poner = (modulo: Modulo, nivel: Nivel) => {
    const siguiente = { ...permisos }
    if (nivel === 'ninguno') delete siguiente[modulo]
    else siguiente[modulo] = nivel
    onChange(siguiente)
  }

  return (
    <div className="flex flex-col gap-4">
      {GRUPOS.map(grupo => {
        const modulos = MODULOS_CONFIG.filter(m => m.grupo === grupo.key)
        if (modulos.length === 0) return null
        return (
          <div key={grupo.key} className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#999]">
              {grupo.label}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {modulos.map(m => {
                const prendida = estaPrendida(m.key)
                const nivel: Nivel = prendida ? (permisos[m.key] ?? 'ninguno') : 'ninguno'
                const activo = nivel !== 'ninguno'
                return (
                  <div
                    key={m.key}
                    className={[
                      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5',
                      !prendida ? 'border-dashed border-[#e8e8e8] opacity-60'
                        : nivel === 'total' ? 'border-[#d4a853] bg-[#fffbf0]'
                        : activo ? 'border-[#48C9B0] bg-[#f0fdfa]'
                        : 'border-[#e8e8e8] bg-white',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      disabled={!prendida}
                      onClick={() => poner(m.key, activo ? 'ninguno' : 'ver')}
                      className="flex flex-1 items-center gap-2 text-left text-[13px] text-[#0a0a0a] disabled:cursor-not-allowed"
                    >
                      <span
                        className={[
                          'h-4 w-4 flex-none rounded border',
                          nivel === 'total' ? 'border-[#d4a853] bg-[#d4a853]'
                            : activo ? 'border-[#48C9B0] bg-[#48C9B0]'
                            : 'border-[#e0e0e0] bg-white',
                        ].join(' ')}
                      />
                      {m.label}
                    </button>

                    {prendida ? (
                      <span className="flex flex-none overflow-hidden rounded-md border border-[#e8e8e8]">
                        {NIVELES_VISIBLES.map(n => (
                          <button
                            key={n.valor}
                            type="button"
                            onClick={() => poner(m.key, n.valor)}
                            className={[
                              'px-2 py-0.5 text-[11px] font-semibold',
                              nivel !== n.valor ? 'text-[#999]'
                                : n.valor === 'total' ? 'bg-[#d4a853] text-[#3a2a08]'
                                : 'bg-[#48C9B0] text-[#08312a]',
                              nivel === 'ninguno' ? 'invisible' : '',
                            ].join(' ')}
                          >
                            {n.label}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span className="flex-none text-[10.5px] text-[#999]">
                        apagada en esta boda
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add "app/events/[id]/configuracion/PermisosEditor.tsx"
git commit -m "feat(accesos): editor de los doce modulos con su nivel"
```

---

## Task 4: La pestaña Equipo reparte accesos

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx`

**Interfaces:**
- Consumes: `<PermisosEditor>` de `./PermisosEditor`; `resumir`, `normalizarPermisos` de `@/lib/permisos/resolver`; `type PermisosEvento` de `@/lib/permisos/catalogo`
- Produces: nada para otras tareas

- [ ] **Step 1: Traer los permisos al leer los colaboradores**

En la consulta que ya existe (alrededor de la línea 329) el `select('*')` ya trae `permisos` y `tipo` ahora que las columnas existen. No hay que cambiarla. Sí hay que agregar los dos campos a la `interface Collaborator`, que está en la **línea 109** de ese mismo archivo:

```ts
  permisos: PermisosEvento | null
  tipo: 'equipo' | 'cliente' | null
```

Y a los imports:

```ts
import { PermisosEditor } from './PermisosEditor'
import { normalizarPermisos, resumir } from '@/lib/permisos/resolver'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
```

- [ ] **Step 2: Estado y guardado**

Agregar junto a los demás estados del componente:

```tsx
  const [editandoPermisos, setEditandoPermisos] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<PermisosEvento>({})
  const [guardando, setGuardando] = useState(false)
```

Y la función que guarda. **No aplica el cambio en pantalla antes de que la base conteste**, y cuenta las filas para no tragarse un rechazo de RLS:

```tsx
  const guardarPermisos = async (colaboradorId: string) => {
    setGuardando(true)
    const { data, error } = await supabase
      .from('event_collaborators')
      .update({ permisos: borrador })
      .eq('id', colaboradorId)
      .select('id')

    setGuardando(false)
    if (error || !data || data.length === 0) {
      alert('No se pudieron guardar los permisos. Vuelve a intentar.')
      return
    }

    setCollaborators(prev =>
      prev.map(c => (c.id === colaboradorId ? { ...c, permisos: borrador } : c)),
    )
    setEditandoPermisos(null)
    logAction({
      eventId: id as string,
      action: 'collaborator.invited',
      entityType: 'collaborator',
      entityId: colaboradorId,
      entityLabel: collaborators.find(c => c.id === colaboradorId)?.email ?? '',
      newValue: borrador,
    })
  }
```

**Por qué se cuenta `data.length`:** un `UPDATE` filtrado por RLS devuelve cero filas **sin error**. Sin ese conteo, la pantalla diría "guardado" y la base no habría escrito nada — es el defecto que ya nos costó una sesión entera en la invitación.

- [ ] **Step 3: Dibujar el resumen y el editor en cada colaborador**

En la lista de colaboradores que ya existe (alrededor de la línea 1095), agregar debajo de cada fila:

```tsx
{(() => {
  const permisos = normalizarPermisos(c.permisos)
  const r = resumir({
    esDuenoDelEvento: false,
    rolCuenta: null,
    permisos,
    features,
  })
  const abierto = editandoPermisos === c.id
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-2 py-0.5 text-[11px] font-semibold text-[#666]">
          {r.etiqueta}
        </span>
        <span className="text-[11px] text-[#999]">
          {r.entra === 0
            ? 'No entra a esta boda'
            : `${r.entra} ${r.entra === 1 ? 'herramienta' : 'herramientas'}`}
        </span>
        <button
          type="button"
          onClick={() => {
            setBorrador(permisos)
            setEditandoPermisos(abierto ? null : c.id)
          }}
          className="text-[12px] font-semibold text-[#2f9e8a]"
        >
          {abierto ? 'Cancelar' : 'Editar accesos'}
        </button>
      </div>

      {abierto && (
        <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
          <PermisosEditor permisos={borrador} features={features} onChange={setBorrador} />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={guardando}
              onClick={() => guardarPermisos(c.id)}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-[#08312a] disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar accesos'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})()}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — sin errores
Run: `npm test` — PASS

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/configuracion/page.tsx"
git commit -m "feat(accesos): repartir accesos por herramienta desde Equipo"
```

- [ ] **Step 6: Pasarle el preview a Diego**

Empujar la rama, esperar a que Vercel termine, y darle **la URL del preview** con esto a revisar, en lenguaje de producto:

> En Configuración › Equipo, cada colaborador trae ahora una etiqueta de qué puede y un botón "Editar accesos". Ábrelo, quítale una herramienta a alguien, guarda, y refresca: el cambio tiene que seguir ahí. Todavía **no** cambia lo que esa persona ve — eso llega con la Tarea 5.

---

## Task 5: El Timeline gateado en la interfaz

**Files:**
- Modify: `app/events/[id]/timeline/page.tsx`
- Modify: `app/events/[id]/timeline/TaskModal.tsx`
- Modify: `app/events/[id]/timeline/ItineraryToolbar.tsx`
- Modify: `app/events/[id]/timeline/MomentCard.tsx`

**Interfaces:**
- Consumes: `<Puede>` de `@/lib/permisos/Puede`; `usePermiso` de `@/lib/event-access-context`

- [ ] **Step 1: Envolver los controles de alta y edición**

En los cuatro archivos, envolver **cada control que muta** con el componente. Los que agregan o modifican van con `accion="editar"`; los que borran, con `accion="borrar"`.

El patrón es siempre el mismo:

```tsx
import { Puede } from '@/lib/permisos/Puede'

<Puede modulo="timeline" accion="editar">
  <button onClick={abrirModalNuevaTarea}>
    <Plus size={13} />Agregar tarea este día
  </button>
</Puede>
```

Los controles a envolver, uno por uno:

- `page.tsx` — el botón "Agregar tarea este día" y el "Agregar" de la barra: `accion="editar"`.
- `page.tsx` — la casilla que marca una tarea como completada (el `update` de `is_completed`) y el alta de tareas sugeridas: `accion="editar"`.
- `TaskModal.tsx` — el botón de guardar: `accion="editar"`. El botón de eliminar: `accion="borrar"`.
- `ItineraryToolbar.tsx` — los controles que agregan momento o arman el día: `accion="editar"`.
- `MomentCard.tsx` — editar y el interruptor de visible para invitados: `accion="editar"`. Eliminar: `accion="borrar"`.

- [ ] **Step 2: Cerrar las funciones, no solo los botones**

Esconder el botón no basta: quien conozca la pantalla puede llegar a la función por otro camino. En `TaskModal.tsx`, al inicio del componente:

```tsx
  const permiso = usePermiso('timeline')
```

Y en las dos funciones que mutan, la primera línea:

```tsx
  const guardar = async () => {
    if (!permiso.editar) return
    // …lo que ya hacía
  }

  const eliminar = async () => {
    if (!permiso.borrar) return
    // …lo que ya hacía
  }
```

Lo mismo en `useItinerary.ts`: traer `usePermiso('timeline')` y poner el corte al inicio de cada función que escribe (`agregarMomento`, `editarMomento`, `borrarMomento`, `alternarVisible`, y las dos de armar el día). Las de borrar cortan con `!permiso.borrar`; las demás con `!permiso.editar`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — sin errores
Run: `npm test` — PASS

- [ ] **Step 4: Commit**

```bash
git add "app/events/[id]/timeline/"
git commit -m "feat(accesos): el Timeline dibuja solo lo que puedes hacer"
```

- [ ] **Step 5: Pasarle el preview a Diego**

> En Configuración › Equipo, ponle a alguien el Timeline en **Ver**. Entra con esa cuenta al Timeline: tiene que ver las tareas y el itinerario completos, y **ningún** botón de agregar, editar ni borrar. Súbelo a **Editar**: aparecen agregar y editar, pero **no** el bote de basura. Súbelo a **Total**: aparece todo.

---

## Task 6: El SQL de cimiento del Timeline

Aditivo y correctivo, sin tocar ninguna policy todavía.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-05-accesos-timeline-cimiento.sql`

- [ ] **Step 1: Escribir el archivo**

```sql
-- Cimiento del Tramo 2: lo que hay que dejar sano antes de mover una policy.
--
-- QUE HACE: (1) impide que una persona tenga dos accesos vivos a la misma boda,
-- (2) le agrega pg_temp al search_path de los cuatro helpers que ya existian.
-- No toca ninguna policy: eso es el archivo -policies.
--
-- CORRERLO ENTERO DE UN JALON. Va todo en una transaccion.

BEGIN;

-- ============================================================
-- 1. Un solo acceso vivo por persona y por boda
-- ============================================================
-- Verificado en produccion el 4-sep: hay tres pares con filas repetidas, pero
-- en los tres solo una esta 'active' y el resto 'revoked'. Por eso el indice va
-- PARCIAL: conserva el historial de invitaciones revocadas —que dice quien fue
-- que cosa y cuando— y garantiza lo unico que importa, que no haya dos accesos
-- vivos. Un indice total obligaria a borrar ese historial sin ganar nada.
--
-- Importa porque nivel_en() resuelve con LIMIT 1: con dos filas activas el
-- permiso de esa persona dependeria de cual le toque a la base.
CREATE UNIQUE INDEX IF NOT EXISTS event_collaborators_un_activo
  ON public.event_collaborators (event_id, user_id)
  WHERE user_id IS NOT NULL AND status = 'active';

-- ============================================================
-- 2. pg_temp en los cuatro helpers que ya existian
-- ============================================================
-- Sin pg_temp en el search_path, Postgres lo busca primero para nombres de
-- relacion: es el secuestro clasico de search_path sobre SECURITY DEFINER, y lo
-- marca el linter de Supabase. Los cuerpos NO cambian, se copian tal cual del
-- estado actual leido el 4-sep; lo unico que se agrega es pg_temp.
CREATE OR REPLACE FUNCTION public.is_event_owner(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.is_event_member(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid() AND status = 'active');
$function$;

CREATE OR REPLACE FUNCTION public.is_event_editor(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role IN ('admin','editor'));
$function$;

CREATE OR REPLACE FUNCTION public.is_event_admin(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role = 'admin');
$function$;

COMMIT;

-- Verificacion. Debe dar cero: nadie con dos accesos vivos a la misma boda.
SELECT count(*) AS pares_con_dos_activos FROM (
  SELECT event_id, user_id FROM event_collaborators
   WHERE user_id IS NOT NULL AND status = 'active'
   GROUP BY event_id, user_id HAVING count(*) > 1
) t;
```

- [ ] **Step 2: Revisar el archivo**

Confirmar tres cosas leyéndolo: que el índice es **parcial** (lleva su `WHERE`), que los cuatro cuerpos de función son **idénticos** a los que se leyeron de producción salvo por `pg_temp`, y que **no hay ni un `CREATE POLICY`, `DROP POLICY` ni `ALTER TABLE`** — este archivo no toca policies.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-05-accesos-timeline-cimiento.sql
git commit -m "feat(accesos): un acceso vivo por persona y pg_temp en los helpers"
```

---

## Task 7: Las policies del Timeline

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-05-accesos-timeline-policies.sql`

- [ ] **Step 1: Escribir el archivo**

```sql
-- Tramo 2: el Timeline pasa a gobernarse por permisos por herramienta.
--
-- ESTE ES EL PRIMER ARCHIVO QUE CAMBIA POLICIES QUE YA EXISTEN. Hasta hoy todo
-- el trabajo de accesos fue aditivo; a partir de aqui no.
--
-- REQUISITOS, en este orden:
--   1. -migracion-aplicar.sql ya corrio (todos los colaboradores tienen permisos)
--   2. El codigo del Tramo 2 esta en produccion, incluida la Tarea 2: la
--      invitacion escribe permisos. Sin eso, cada persona invitada despues de la
--      migracion tendria permisos vacios y esta policy la dejaria fuera.
--   3. -accesos-timeline-cimiento.sql ya corrio
--
-- QUE ARREGLA: event_timeline_tasks tenia la escritura amarrada a
-- events.user_id — solo el dueno — y una lectura que si incluia colaboradores.
-- Ese es el "se ve normal y no guarda" del §1 del spec. event_itinerary_moments
-- ya usaba is_event_editor/is_event_member, que funciona pero es por evento
-- completo; pasa al mismo modelo por herramienta que las tareas.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- ============================================================
-- 1. Tareas del timeline
-- ============================================================
DROP POLICY IF EXISTS "Planners can manage their own timeline tasks" ON public.event_timeline_tasks;
DROP POLICY IF EXISTS "collaborators can read timeline_tasks"        ON public.event_timeline_tasks;

DROP POLICY IF EXISTS timeline_ver    ON public.event_timeline_tasks;
DROP POLICY IF EXISTS timeline_crear  ON public.event_timeline_tasks;
DROP POLICY IF EXISTS timeline_editar ON public.event_timeline_tasks;
DROP POLICY IF EXISTS timeline_borrar ON public.event_timeline_tasks;

CREATE POLICY timeline_ver ON public.event_timeline_tasks FOR SELECT
  USING ( public.puede_ver(event_id, 'timeline') );

CREATE POLICY timeline_crear ON public.event_timeline_tasks FOR INSERT
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY timeline_editar ON public.event_timeline_tasks FOR UPDATE
  USING      ( public.puede_editar(event_id, 'timeline') )
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY timeline_borrar ON public.event_timeline_tasks FOR DELETE
  USING ( public.puede_borrar(event_id, 'timeline') );

-- ============================================================
-- 2. Momentos del itinerario — mismo modulo, mismas reglas
-- ============================================================
DROP POLICY IF EXISTS itinerary_editor_write  ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerary_member_select ON public.event_itinerary_moments;

DROP POLICY IF EXISTS itinerario_ver    ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerario_crear  ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerario_editar ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerario_borrar ON public.event_itinerary_moments;

CREATE POLICY itinerario_ver ON public.event_itinerary_moments FOR SELECT
  USING ( public.puede_ver(event_id, 'timeline') );

CREATE POLICY itinerario_crear ON public.event_itinerary_moments FOR INSERT
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY itinerario_editar ON public.event_itinerary_moments FOR UPDATE
  USING      ( public.puede_editar(event_id, 'timeline') )
  WITH CHECK ( public.puede_editar(event_id, 'timeline') );

CREATE POLICY itinerario_borrar ON public.event_itinerary_moments FOR DELETE
  USING ( public.puede_borrar(event_id, 'timeline') );

-- ============================================================
-- 3. La bitacora de borrados, colgada de estas dos tablas
-- ============================================================
-- Verificado el 4-sep: event_audit_log.user_id y user_name aceptan NULL, no hay
-- ningun CHECK sobre action ni entity_type, y user_email lo cubre el COALESCE de
-- la funcion. Nada de esto puede tumbar un borrado.
--
-- OJO, y es la razon de que estos disparadores NO vayan sobre events: la llave
-- event_audit_log.event_id -> events(id) es ON DELETE CASCADE. Al borrar una
-- boda, su bitacora se va con ella. Para el borrado de una tarea o un momento
-- funciona perfecto; guardar el borrado de la boda entera exige cambiar esa
-- llave, y eso se decide en el tramo de Actividad.
DROP TRIGGER IF EXISTS log_borrado_timeline ON public.event_timeline_tasks;
CREATE TRIGGER log_borrado_timeline
  AFTER DELETE ON public.event_timeline_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('timeline', 'timeline_task', 'title');

DROP TRIGGER IF EXISTS log_borrado_itinerario ON public.event_itinerary_moments;
CREATE TRIGGER log_borrado_itinerario
  AFTER DELETE ON public.event_itinerary_moments
  FOR EACH ROW EXECUTE FUNCTION public.log_borrado('timeline', 'itinerary_moment', 'title');

COMMIT;

-- Verificacion. La primera debe dar 8 (cuatro policies por tabla) y la segunda 2.
SELECT count(*) AS policies_del_timeline FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('event_timeline_tasks', 'event_itinerary_moments');

SELECT count(*) AS disparadores_de_bitacora FROM pg_trigger
 WHERE tgname IN ('log_borrado_timeline', 'log_borrado_itinerario');
```

- [ ] **Step 2: Revisar el archivo**

Confirmar cuatro cosas: que las dos policies viejas de cada tabla se borran **por su nombre exacto** tal como se leyó de producción; que las nuevas están separadas por operación —`SELECT`, `INSERT`, `UPDATE`, `DELETE`— y no una sola `ALL`, porque es lo único que permite que `editar` no implique `borrar`; que `UPDATE` lleva **las dos** cláusulas, `USING` y `WITH CHECK`, para que nadie edite una fila hacia un evento donde no puede; y que **la columna de etiqueta que recibe cada disparador existe** en su tabla (`title` en las dos).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-05-accesos-timeline-policies.sql
git commit -m "feat(accesos): el Timeline se gobierna por permisos por herramienta"
```

- [ ] **Step 4: Entregarle el orden a Diego, no correrlo**

Ningún paso lo ejecuta el agente. El orden es:

1. Mergear y desplegar el código del Tramo 2.
2. Correr `2026-09-05-accesos-timeline-cimiento.sql`. La verificación del final debe dar cero.
3. Correr `2026-09-05-accesos-timeline-policies.sql`. Las verificaciones deben dar **8** y **2**.
4. **La prueba que importa**, con una cuenta de colaborador de verdad: entrar al Timeline, crear una tarea, refrescar y ver que **sigue ahí**. Eso es el hueco del §1 del spec cerrado.
5. Bajarle a esa cuenta el Timeline a **Ver** y confirmar que ya no puede crear nada — ni desde la pantalla, ni si intenta guardar de otra forma.

---

## Cierre del Tramo 2

Al terminar, esto es cierto:

- El menú de cada persona muestra **solo sus herramientas**.
- Entrar por URL a algo que no te toca te manda a una pantalla que lo dice y te da salida.
- La pantalla de Equipo reparte accesos por herramienta, y lo que guarda se ve reflejado.
- **El Timeline guarda de verdad para un colaborador**, y `editar` no alcanza para borrar — en la pantalla y en la base.
- Cada borrado de una tarea o un momento queda firmado con quién, cuándo y la fila completa.

**Aquí se para.** Se usa una semana con una sesión de colaborador de verdad antes de repetir el patrón en los once módulos restantes. Si el modelo se siente bien, el Tramo 3 es trabajo mecánico. Si algo no cuadra, se descubrió con un módulo hecho y no con doce.

**Lo que sigue anotado, y no se toca aquí:** `hasAccess` debe derivarse de `resumir()` (Tramo 3); el secuestro de `user_id` por un admin de evento vía `guard_event_config` sigue abierto y su premio creció con este tramo; `permisosDesdeRolLegado()` ya no tiene razón de ser una vez que la invitación escribe permisos y debe borrarse en el Tramo 3; y el correo guardado en `event_collaborators` puede no ser el de la cuenta que aceptó, lo cual importa en el Tramo 5, donde el correo es la identidad.
