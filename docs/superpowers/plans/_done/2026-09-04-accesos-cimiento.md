# Cimiento de accesos por herramienta — plan de implementación (Tramo 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar puesto el cimiento de permisos por herramienta —catálogo, lógica pura probada, contexto, componente, tablas y funciones de Postgres— sin que ninguna pantalla cambie todavía de comportamiento.

**Architecture:** La regla del permiso vive en dos lugares y nada más: `lib/permisos/resolver.ts` del lado de la app y `public.nivel_en()` del lado de Postgres. Todo lo demás las llama. Este tramo es **puramente aditivo**: crea tablas, columnas y funciones nuevas, y no modifica ni una policy ni una función existente. Por eso no puede romper producción y no depende de la lectura de `pg_policies` (esa se necesita hasta el Tramo 2, cuando las policies del Timeline se muevan).

**Tech Stack:** Next 16 App Router, React 19, TypeScript, Supabase (Postgres + RLS), Vitest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-04-accesos-por-herramienta-design.md`

## Global Constraints

- **Idioma de la interfaz: español, con acentos.** Los mensajes de commit van **sin acentos ni ñ** (`feat:`, `fix:`, `refactor:`).
- **Sin emojis** en interfaz ni en código. Iconos de `lucide-react`.
- **Solo Tailwind** para estilos; nada de estilos en línea salvo excepción justificada.
- **Sin comentarios** en el código salvo cuando el *porqué* no es obvio.
- **Vitest solo para lógica pura.** La interfaz se verifica a mano en el flujo local → preview → main.
- **Nunca correr SQL en Supabase sin instrucción directa de Diego.** Los `.sql` de este plan se escriben, se commitean, y los corre él.
- **El código sale a producción antes que el SQL.** Todo lo que lea las tablas nuevas tiene que funcionar cuando todavía no existen.
- Alias de imports: `@/` apunta a la raíz del repo.
- Los cuatro niveles son exactamente `'ninguno' | 'ver' | 'editar' | 'total'`. Las tres acciones son exactamente `'ver' | 'editar' | 'borrar'`.
- Los doce módulos son exactamente: `invitados, invitacion, mensajes, mesas, timeline, regalos, album, playlist, vestimenta, presupuesto, proveedores, pagos`. **`comida` no es módulo** — está retirada del catálogo.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/permisos/catalogo.ts` | **Crear.** La lista de módulos y niveles, y el puente hacia `lib/features.ts`. Sin lógica |
| `lib/permisos/catalogo.test.ts` | **Crear.** Que el catálogo esté completo y cuadre con `FEATURES` |
| `lib/permisos/resolver.ts` | **Crear.** Toda la lógica del permiso. Puro, sin React, sin Supabase |
| `lib/permisos/resolver.test.ts` | **Crear.** La tabla de verdad completa |
| `lib/permisos/Puede.tsx` | **Crear.** El componente que envuelve. Sin lógica propia |
| `lib/event-access-context.tsx` | **Modificar.** Cargar permisos y membresía tolerando que las tablas no existan; exponer `usePermiso` |
| `docs/superpowers/plans/sql/2026-09-04-accesos-cimiento.sql` | **Crear.** Tablas, columnas y funciones. Aditivo |
| `docs/superpowers/plans/sql/2026-09-04-accesos-bitacora.sql` | **Crear.** La función genérica del disparador de borrado |
| `docs/superpowers/plans/sql/2026-09-04-accesos-migracion-previo.sql` | **Crear.** Solo lectura: enseña quién amanece con qué |
| `docs/superpowers/plans/sql/2026-09-04-accesos-migracion-aplicar.sql` | **Crear.** Escribe la migración |

**Nota de desvío del spec:** el spec pide una "pantalla de previo" para la migración. Es una migración que corre **una sola vez**; construirle una pantalla es trabajo tirado. El previo es una consulta de solo lectura cuya salida Diego lee en el editor de Supabase antes de correr el `aplicar`. Cumple el propósito —nada se aplica sin que él vea el resultado— sin código desechable.

**`<Puede>` no lleva prueba de Vitest** y es a propósito: no tiene lógica. Toda la decisión vive en `puede()`, que sí está probada. Probar el componente sería probar React.

**Segundo desvío del spec, deliberado.** El §11 del spec metía en este tramo la reimplementación de `is_event_member` e `is_event_editor` encima de `nivel_en()`. **Se mueve al Tramo 2.** Reimplementarlas aquí significaría modificar dos funciones de las que cuelgan seis tablas en producción, y eso convertiría un tramo que hoy no puede romper nada en uno que sí. Además obligaría a leer `pg_policies` antes de empezar, cuando esa lectura no hace falta hasta que se mueva la primera policy. Se hace en el Tramo 2, con la lectura en la mano y con el Timeline como red de prueba.

---

## Task 1: El catálogo de módulos

**Files:**
- Create: `lib/permisos/catalogo.ts`
- Test: `lib/permisos/catalogo.test.ts`

**Interfaces:**
- Consumes: `FeatureKey` y `FEATURES` de `@/lib/features`
- Produces: `MODULOS`, `Modulo`, `NIVELES`, `Nivel`, `Accion`, `PermisosEvento`, `MODULOS_CONFIG`, `ModuloConfig`, `moduloDeRuta()`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/permisos/catalogo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MODULOS, MODULOS_CONFIG, NIVELES, moduloDeRuta } from './catalogo'
import { FEATURES } from '@/lib/features'

describe('MODULOS', () => {
  it('son exactamente los doce del spec', () => {
    expect(MODULOS).toEqual([
      'invitados', 'invitacion', 'mensajes', 'mesas', 'timeline',
      'regalos', 'album', 'playlist', 'vestimenta',
      'presupuesto', 'proveedores', 'pagos',
    ])
  })

  it('comida no es modulo: esta retirada del catalogo', () => {
    expect(MODULOS).not.toContain('comida')
  })

  it('los niveles son cuatro y van de menos a mas', () => {
    expect(NIVELES).toEqual(['ninguno', 'ver', 'editar', 'total'])
  })
})

describe('MODULOS_CONFIG', () => {
  it('tiene una entrada por modulo, sin repetidos', () => {
    expect(MODULOS_CONFIG).toHaveLength(MODULOS.length)
    expect(MODULOS_CONFIG.map(m => m.key).sort()).toEqual([...MODULOS].sort())
  })

  it('toda entrada trae al menos una ruta y una etiqueta', () => {
    for (const m of MODULOS_CONFIG) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.rutas.length).toBeGreaterThan(0)
    }
  })

  it('cada feature que se prende por boda tiene su modulo', () => {
    const conFeature = MODULOS_CONFIG.filter(m => m.feature !== null).map(m => m.feature)
    for (const f of FEATURES) {
      expect(conFeature).toContain(f.key)
    }
  })

  it('los modulos siempre presentes no cuelgan de ninguna feature', () => {
    const siempre = ['invitados', 'mensajes', 'timeline', 'presupuesto', 'proveedores', 'pagos']
    for (const key of siempre) {
      expect(MODULOS_CONFIG.find(m => m.key === key)!.feature).toBeNull()
    }
  })
})

describe('moduloDeRuta', () => {
  it('reconoce la raiz del evento como invitados', () => {
    expect(moduloDeRuta('/events/abc-123')).toBe('invitados')
    expect(moduloDeRuta('/events/abc-123/')).toBe('invitados')
  })

  it('reconoce una subruta y sus hijos', () => {
    expect(moduloDeRuta('/events/abc-123/presupuesto')).toBe('presupuesto')
    expect(moduloDeRuta('/events/abc-123/mesa-regalos')).toBe('regalos')
    expect(moduloDeRuta('/events/abc-123/timeline/algo/mas')).toBe('timeline')
  })

  it('regresa null para lo que no es modulo', () => {
    expect(moduloDeRuta('/events/abc-123/configuracion')).toBeNull()
    expect(moduloDeRuta('/events/abc-123/comida')).toBeNull()
    expect(moduloDeRuta('/dashboard')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/permisos/catalogo.test.ts`
Expected: FAIL — `Failed to resolve import "./catalogo"`

- [ ] **Step 3: Escribir el catálogo**

Crear `lib/permisos/catalogo.ts`:

```ts
import type { FeatureKey } from '@/lib/features'

export const MODULOS = [
  'invitados', 'invitacion', 'mensajes', 'mesas', 'timeline',
  'regalos', 'album', 'playlist', 'vestimenta',
  'presupuesto', 'proveedores', 'pagos',
] as const

export type Modulo = typeof MODULOS[number]

export const NIVELES = ['ninguno', 'ver', 'editar', 'total'] as const
export type Nivel = typeof NIVELES[number]

export type Accion = 'ver' | 'editar' | 'borrar'

export type PermisosEvento = Partial<Record<Modulo, Nivel>>

export type GrupoModulo = 'boda' | 'herramientas' | 'finanzas'

export interface ModuloConfig {
  key: Modulo
  label: string
  grupo: GrupoModulo
  // null = no se prende ni apaga por boda; siempre forma parte del evento
  feature: FeatureKey | null
  // sufijos bajo /events/[id]; '' es la raiz (lista de invitados)
  rutas: string[]
}

export const MODULOS_CONFIG: ModuloConfig[] = [
  { key: 'invitados',   label: 'Invitados',        grupo: 'boda',         feature: null,         rutas: [''] },
  { key: 'invitacion',  label: 'Invitación',       grupo: 'herramientas', feature: 'invitacion', rutas: ['/invitacion'] },
  { key: 'mensajes',    label: 'Mensajes',         grupo: 'boda',         feature: null,         rutas: ['/mensajes'] },
  { key: 'mesas',       label: 'Mesas y check-in', grupo: 'herramientas', feature: 'mesas',      rutas: ['/mesas'] },
  { key: 'timeline',    label: 'Timeline',         grupo: 'boda',         feature: null,         rutas: ['/timeline'] },
  { key: 'regalos',     label: 'Mesa de regalos',  grupo: 'herramientas', feature: 'regalos',    rutas: ['/mesa-regalos'] },
  { key: 'album',       label: 'Álbum de fotos',   grupo: 'herramientas', feature: 'album',      rutas: ['/album'] },
  { key: 'playlist',    label: 'Playlist',         grupo: 'herramientas', feature: 'playlist',   rutas: ['/playlist'] },
  { key: 'vestimenta',  label: 'Dress code',       grupo: 'herramientas', feature: 'vestimenta', rutas: ['/vestimenta'] },
  { key: 'presupuesto', label: 'Presupuesto',      grupo: 'finanzas',     feature: null,         rutas: ['/presupuesto'] },
  { key: 'proveedores', label: 'Proveedores',      grupo: 'finanzas',     feature: null,         rutas: ['/proveedores'] },
  { key: 'pagos',       label: 'Pagos',            grupo: 'finanzas',     feature: null,         rutas: ['/pagos'] },
]

const RE_EVENTO = /^\/events\/[^/]+(\/.*)?$/

// De una ruta del navegador al modulo que la gobierna. La ruta mas larga gana,
// para que '/mesa-regalos' no se lo coma un modulo con sufijo mas corto.
export function moduloDeRuta(pathname: string): Modulo | null {
  const m = pathname.match(RE_EVENTO)
  if (!m) return null

  const resto = (m[1] ?? '').replace(/\/+$/, '')
  let ganador: ModuloConfig | null = null

  for (const mod of MODULOS_CONFIG) {
    for (const ruta of mod.rutas) {
      const calza = ruta === '' ? resto === '' : (resto === ruta || resto.startsWith(ruta + '/'))
      if (calza && (ganador === null || ruta.length > Math.max(...ganador.rutas.map(r => r.length)))) {
        ganador = mod
      }
    }
  }

  return ganador?.key ?? null
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/permisos/catalogo.test.ts`
Expected: PASS, 8 pruebas

- [ ] **Step 5: Commit**

```bash
git add lib/permisos/catalogo.ts lib/permisos/catalogo.test.ts
git commit -m "feat(accesos): catalogo de los doce modulos y sus niveles"
```

---

## Task 2: El resolver

Es el corazón del diseño: la única función que decide un permiso del lado de la app.

**Files:**
- Create: `lib/permisos/resolver.ts`
- Test: `lib/permisos/resolver.test.ts`

**Interfaces:**
- Consumes: `Modulo`, `Nivel`, `Accion`, `PermisosEvento`, `MODULOS`, `MODULOS_CONFIG` de `./catalogo`; `FeatureKey` de `@/lib/features`
- Produces:
  - `type RolCuenta = 'dueno' | 'admin' | 'colaborador' | null`
  - `normalizarPermisos(raw: unknown): PermisosEvento`
  - `nivelDe(permisos, modulo): Nivel`
  - `puede(nivel: Nivel, accion: Accion): boolean`
  - `nivelEfectivo(args: ContextoPermiso, modulo: Modulo): Nivel`
  - `type ContextoPermiso = { esDuenoDelEvento: boolean; rolCuenta: RolCuenta; permisos: PermisosEvento | null; features: Record<FeatureKey, boolean> | null }`
  - `resumir(ctx: ContextoPermiso): { entra: number; ve: number; edita: number; borra: number; etiqueta: string }`
  - `aplicarKit(kit: PermisosEvento | null, features: Record<FeatureKey, boolean> | null): PermisosEvento`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/permisos/resolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  normalizarPermisos, nivelDe, puede, nivelEfectivo, resumir, aplicarKit,
  type ContextoPermiso,
} from './resolver'
import { MODULOS, NIVELES, type Nivel } from './catalogo'
import { LEGACY_FEATURES } from '@/lib/features'

const TODO_PRENDIDO = { ...LEGACY_FEATURES }

function ctx(over: Partial<ContextoPermiso> = {}): ContextoPermiso {
  return {
    esDuenoDelEvento: false,
    rolCuenta: 'colaborador',
    permisos: {},
    features: TODO_PRENDIDO,
    ...over,
  }
}

describe('normalizarPermisos', () => {
  it('deja pasar lo valido', () => {
    expect(normalizarPermisos({ mesas: 'editar', pagos: 'ver' }))
      .toEqual({ mesas: 'editar', pagos: 'ver' })
  })

  it('tira modulos que no existen y niveles que no existen', () => {
    expect(normalizarPermisos({ mesas: 'editar', inventado: 'total', pagos: 'jefe' }))
      .toEqual({ mesas: 'editar' })
  })

  it('convierte basura en objeto vacio, sin reventar', () => {
    for (const basura of [null, undefined, 'texto', 42, [], true]) {
      expect(normalizarPermisos(basura)).toEqual({})
    }
  })
})

describe('puede — la escalera', () => {
  const tabla: Array<[Nivel, boolean, boolean, boolean]> = [
    // nivel      ver    editar borrar
    ['ninguno',   false, false, false],
    ['ver',       true,  false, false],
    ['editar',    true,  true,  false],
    ['total',     true,  true,  true ],
  ]

  for (const [nivel, ver, editar, borrar] of tabla) {
    it(`${nivel}: ver=${ver} editar=${editar} borrar=${borrar}`, () => {
      expect(puede(nivel, 'ver')).toBe(ver)
      expect(puede(nivel, 'editar')).toBe(editar)
      expect(puede(nivel, 'borrar')).toBe(borrar)
    })
  }

  it('editar nunca implica borrar', () => {
    expect(puede('editar', 'borrar')).toBe(false)
  })
})

describe('nivelDe', () => {
  it('una clave ausente es sin acceso; nunca se infiere nada', () => {
    expect(nivelDe({}, 'pagos')).toBe('ninguno')
    expect(nivelDe(null, 'pagos')).toBe('ninguno')
    expect(nivelDe({ mesas: 'total' }, 'pagos')).toBe('ninguno')
  })

  it('lee el nivel guardado', () => {
    expect(nivelDe({ pagos: 'editar' }, 'pagos')).toBe('editar')
  })
})

describe('nivelEfectivo', () => {
  it('el dueno del evento tiene total en todo', () => {
    for (const m of MODULOS) {
      expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, permisos: {} }), m)).toBe('total')
    }
  })

  it('el dueno y el admin del despacho tienen total en todo', () => {
    for (const rol of ['dueno', 'admin'] as const) {
      for (const m of MODULOS) {
        expect(nivelEfectivo(ctx({ rolCuenta: rol, permisos: {} }), m)).toBe('total')
      }
    }
  })

  it('el colaborador solo tiene lo que le dieron', () => {
    const c = ctx({ permisos: { mesas: 'editar' } })
    expect(nivelEfectivo(c, 'mesas')).toBe('editar')
    expect(nivelEfectivo(c, 'pagos')).toBe('ninguno')
  })

  it('el ajeno no tiene nada', () => {
    const c = ctx({ rolCuenta: null, permisos: null })
    for (const m of MODULOS) expect(nivelEfectivo(c, m)).toBe('ninguno')
  })

  it('una herramienta apagada en la boda no existe para NADIE, ni el dueno', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: apagada }), 'playlist')).toBe('ninguno')
    expect(nivelEfectivo(ctx({ rolCuenta: 'admin', features: apagada }), 'playlist')).toBe('ninguno')
    expect(nivelEfectivo(ctx({ permisos: { playlist: 'total' }, features: apagada }), 'playlist')).toBe('ninguno')
  })

  it('apagar una herramienta no toca a las demas', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: apagada }), 'mesas')).toBe('total')
  })

  it('mientras las features no cargan, nadie ve nada de lo que se prende por boda', () => {
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: null }), 'playlist')).toBe('ninguno')
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: null }), 'invitados')).toBe('total')
  })

  it('un nivel guardado que no existe se lee como sin acceso', () => {
    const c = ctx({ permisos: normalizarPermisos({ mesas: 'jefe' }) })
    expect(nivelEfectivo(c, 'mesas')).toBe('ninguno')
  })
})

describe('resumir', () => {
  it('sin nada, esta fuera de la boda', () => {
    expect(resumir(ctx({ permisos: {} }))).toMatchObject({ entra: 0, etiqueta: 'Fuera de esta boda' })
  })

  it('todo en ver es solo lectura', () => {
    const permisos = Object.fromEntries(MODULOS.map(m => [m, 'ver']))
    expect(resumir(ctx({ permisos }))).toMatchObject({ entra: 12, borra: 0, etiqueta: 'Solo lectura' })
  })

  it('con algo en editar y nada en total, edita pero no borra', () => {
    expect(resumir(ctx({ permisos: { mesas: 'editar', pagos: 'ver' } })))
      .toMatchObject({ entra: 2, edita: 1, ve: 1, borra: 0, etiqueta: 'Edita, no borra' })
  })

  it('con un solo total, puede borrar', () => {
    expect(resumir(ctx({ permisos: { mesas: 'total', pagos: 'ver' } })))
      .toMatchObject({ borra: 1, etiqueta: 'Puede borrar' })
  })

  it('no cuenta las herramientas apagadas en la boda', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(resumir(ctx({ permisos: { playlist: 'total', mesas: 'ver' }, features: apagada })))
      .toMatchObject({ entra: 1, borra: 0 })
  })
})

describe('aplicarKit', () => {
  it('respeta el kit y descarta lo que la boda tiene apagado', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(aplicarKit({ mesas: 'editar', playlist: 'total', pagos: 'ver' }, apagada))
      .toEqual({ mesas: 'editar', pagos: 'ver' })
  })

  it('sin kit, no otorga nada', () => {
    expect(aplicarKit(null, TODO_PRENDIDO)).toEqual({})
  })
})

describe('cobertura', () => {
  it('la tabla de verdad cubre los cuatro niveles', () => {
    expect(NIVELES).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npx vitest run lib/permisos/resolver.test.ts`
Expected: FAIL — `Failed to resolve import "./resolver"`

- [ ] **Step 3: Escribir el resolver**

Crear `lib/permisos/resolver.ts`:

```ts
import type { FeatureKey } from '@/lib/features'
import {
  MODULOS, MODULOS_CONFIG, NIVELES,
  type Modulo, type Nivel, type Accion, type PermisosEvento,
} from './catalogo'

export type RolCuenta = 'dueno' | 'admin' | 'colaborador' | null

export interface ContextoPermiso {
  esDuenoDelEvento: boolean
  rolCuenta: RolCuenta
  permisos: PermisosEvento | null
  // null mientras cargan: se trata como "nada prendido", nunca como "todo prendido"
  features: Record<FeatureKey, boolean> | null
}

const ES_MODULO = new Set<string>(MODULOS)
const ES_NIVEL = new Set<string>(NIVELES)

const FEATURE_DE: Record<Modulo, FeatureKey | null> = Object.fromEntries(
  MODULOS_CONFIG.map(m => [m.key, m.feature]),
) as Record<Modulo, FeatureKey | null>

// Lo que viene del JSONB es dato ajeno: se limpia antes de creerle.
export function normalizarPermisos(raw: unknown): PermisosEvento {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: PermisosEvento = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (ES_MODULO.has(k) && typeof v === 'string' && ES_NIVEL.has(v)) {
      out[k as Modulo] = v as Nivel
    }
  }
  return out
}

export function nivelDe(permisos: PermisosEvento | null | undefined, modulo: Modulo): Nivel {
  return permisos?.[modulo] ?? 'ninguno'
}

export function puede(nivel: Nivel, accion: Accion): boolean {
  if (accion === 'ver')    return nivel !== 'ninguno'
  if (accion === 'editar') return nivel === 'editar' || nivel === 'total'
  return nivel === 'total'
}

function estaPrendida(modulo: Modulo, features: Record<FeatureKey, boolean> | null): boolean {
  const feature = FEATURE_DE[modulo]
  if (feature === null) return true
  return features?.[feature] === true
}

export function nivelEfectivo(ctx: ContextoPermiso, modulo: Modulo): Nivel {
  if (!estaPrendida(modulo, ctx.features)) return 'ninguno'
  if (ctx.esDuenoDelEvento) return 'total'
  if (ctx.rolCuenta === 'dueno' || ctx.rolCuenta === 'admin') return 'total'
  return nivelDe(ctx.permisos, modulo)
}

export function resumir(ctx: ContextoPermiso) {
  let ve = 0, edita = 0, borra = 0
  for (const m of MODULOS) {
    const nivel = nivelEfectivo(ctx, m)
    if (nivel === 'ver')    ve++
    if (nivel === 'editar') edita++
    if (nivel === 'total')  borra++
  }
  const entra = ve + edita + borra
  const etiqueta =
    entra === 0 ? 'Fuera de esta boda' :
    borra > 0   ? 'Puede borrar' :
    edita > 0   ? 'Edita, no borra' :
                  'Solo lectura'
  return { entra, ve, edita, borra, etiqueta }
}

export function aplicarKit(
  kit: PermisosEvento | null,
  features: Record<FeatureKey, boolean> | null,
): PermisosEvento {
  if (!kit) return {}
  const out: PermisosEvento = {}
  for (const m of MODULOS) {
    const nivel = kit[m]
    if (nivel && nivel !== 'ninguno' && estaPrendida(m, features)) out[m] = nivel
  }
  return out
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npx vitest run lib/permisos/resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Correr la suite entera para no haber roto nada**

Run: `npm test`
Expected: PASS, sin regresiones

- [ ] **Step 6: Commit**

```bash
git add lib/permisos/resolver.ts lib/permisos/resolver.test.ts
git commit -m "feat(accesos): resolver de permisos con su tabla de verdad"
```

---

## Task 3: El contexto, tolerante a que la base no exista todavía

**Files:**
- Modify: `lib/event-access-context.tsx`

**Interfaces:**
- Consumes: `normalizarPermisos`, `nivelEfectivo`, `puede`, `type RolCuenta`, `type ContextoPermiso` de `@/lib/permisos/resolver`; `type Modulo`, `type Nivel`, `type Accion`, `type PermisosEvento` de `@/lib/permisos/catalogo`
- Produces: el context agrega `rolCuenta: RolCuenta`, `permisos: PermisosEvento | null`, y la función `nivelDeModulo(modulo: Modulo): Nivel`. Nuevo hook exportado:
  `usePermiso(modulo: Modulo): { nivel: Nivel; ver: boolean; editar: boolean; borrar: boolean }`

**El punto crítico de esta tarea.** Las columnas `permisos` y `tipo` y las tablas `workspace_members` **todavía no existen** cuando este código llegue a producción. Si se agregan a la consulta que ya trae `role, status`, esa consulta falla completa y **un colaborador se queda sin rol**, o sea sin acceso. Por eso van en consultas **aparte**, y si fallan se cae a un equivalente del comportamiento de hoy.

- [ ] **Step 1: Agregar el respaldo legado y sus pruebas**

Crear el respaldo dentro de `lib/permisos/resolver.ts` (al final del archivo):

```ts
// Puente para el periodo en que el codigo ya esta arriba y el SQL no ha corrido.
// Reproduce EXACTAMENTE lo que la app hace hoy, para que nada cambie antes de
// tiempo: hoy admin y editor pueden borrar. La migracion es la que baja al
// editor a 'editar'.
export function permisosDesdeRolLegado(role: string | null | undefined): PermisosEvento {
  const nivel: Nivel | null =
    role === 'admin' || role === 'editor' ? 'total' :
    role === 'viewer' ? 'ver' :
    null
  if (nivel === null) return {}
  return Object.fromEntries(MODULOS.map(m => [m, nivel])) as PermisosEvento
}
```

Agregar a `lib/permisos/resolver.test.ts`:

```ts
describe('permisosDesdeRolLegado', () => {
  it('admin y editor conservan lo que hoy pueden hacer, borrar incluido', () => {
    for (const role of ['admin', 'editor']) {
      const p = permisosDesdeRolLegado(role)
      expect(Object.keys(p)).toHaveLength(12)
      expect(p.pagos).toBe('total')
    }
  })

  it('viewer solo mira', () => {
    expect(permisosDesdeRolLegado('viewer').mesas).toBe('ver')
  })

  it('un rol desconocido no otorga nada', () => {
    expect(permisosDesdeRolLegado(null)).toEqual({})
    expect(permisosDesdeRolLegado('inventado')).toEqual({})
  })
})
```

Recordar agregar `permisosDesdeRolLegado` al `import` de arriba del archivo de pruebas.

- [ ] **Step 2: Correr y verificar que pasa**

Run: `npx vitest run lib/permisos/resolver.test.ts`
Expected: PASS

- [ ] **Step 3: Cargar la membresía y los permisos en el provider**

En `lib/event-access-context.tsx`, dentro de `checkAccess()`, **después** del bloque que ya existe y que resuelve `role`, agregar:

```tsx
        const [{ data: fila }, { data: miembro }] = await Promise.all([
          supabase
            .from('event_collaborators')
            .select('permisos')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle(),
          supabase
            .from('workspace_members')
            .select('rol, workspaces!inner(id)')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle(),
        ])

        setRolCuenta((miembro?.rol as RolCuenta) ?? null)
        setPermisos(
          fila?.permisos != null
            ? normalizarPermisos(fila.permisos)
            : permisosDesdeRolLegado(collaborator?.role),
        )
```

Las dos consultas fallan sin ruido mientras las tablas no existan: `data` llega `null` y el `??` se encarga. Es el mismo patrón con el que hoy se lee `enabled_features`.

Declarar los dos estados nuevos junto a los que ya hay:

```tsx
  const [rolCuenta, setRolCuenta] = useState<RolCuenta>(null)
  const [permisos, setPermisos]   = useState<PermisosEvento | null>(null)
```

Y para el dueño del evento, que hoy hace `return` temprano, poner los permisos antes de salir:

```tsx
        if (event?.user_id === user.id) {
          setRole('owner')
          setRolCuenta('dueno')
          return
        }
```

- [ ] **Step 4: Exponer `nivelDeModulo` y `usePermiso`**

Agregar al valor del provider:

```tsx
  const ctxPermiso: ContextoPermiso = {
    esDuenoDelEvento: isOwner,
    rolCuenta,
    permisos,
    features,
  }

  const nivelDeModulo = (modulo: Modulo): Nivel => nivelEfectivo(ctxPermiso, modulo)
```

Meter `rolCuenta`, `permisos` y `nivelDeModulo` al objeto que va en `EventAccessContext.Provider`, y a `EventAccessContextType`. En el `createContext` de respaldo, `nivelDeModulo: () => 'ninguno'`.

Al final del archivo:

```tsx
export function usePermiso(modulo: Modulo) {
  const { nivelDeModulo } = useEventAccess()
  const nivel = nivelDeModulo(modulo)
  return {
    nivel,
    ver:    puede(nivel, 'ver'),
    editar: puede(nivel, 'editar'),
    borrar: puede(nivel, 'borrar'),
  }
}
```

- [ ] **Step 5: Verificar que compila y que nada se rompió**

Run: `npx tsc --noEmit`
Expected: sin errores

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Verificar a mano que producción sigue igual**

Con `npm run dev`, entrar a un evento como dueño y recorrer el nav completo. **Nada debe verse distinto** — este tramo no cambia comportamiento. En la consola del navegador no debe aparecer ningún error nuevo por las tablas que faltan.

- [ ] **Step 7: Commit**

```bash
git add lib/event-access-context.tsx lib/permisos/resolver.ts lib/permisos/resolver.test.ts
git commit -m "feat(accesos): cargar permisos y membresia sin romper si la base no los tiene"
```

---

## Task 4: El componente `<Puede>`

**Files:**
- Create: `lib/permisos/Puede.tsx`

**Interfaces:**
- Consumes: `usePermiso` de `@/lib/event-access-context`; `type Modulo`, `type Accion` de `./catalogo`
- Produces: `<Puede modulo accion siNo>{children}</Puede>`

- [ ] **Step 1: Escribir el componente**

Crear `lib/permisos/Puede.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { usePermiso } from '@/lib/event-access-context'
import type { Modulo, Accion } from './catalogo'

interface PuedeProps {
  modulo: Modulo
  accion: Accion
  children: ReactNode
  // Que dibujar cuando no puede. Por omision, nada: la regla es que un control
  // que no se puede usar no se dibuja, ni siquiera deshabilitado.
  siNo?: ReactNode
}

export function Puede({ modulo, accion, children, siNo = null }: PuedeProps) {
  const permiso = usePermiso(modulo)
  const autorizado =
    accion === 'ver'    ? permiso.ver :
    accion === 'editar' ? permiso.editar :
                          permiso.borrar

  return <>{autorizado ? children : siNo}</>
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add lib/permisos/Puede.tsx
git commit -m "feat(accesos): componente Puede para envolver controles"
```

---

## Task 5: El SQL del cimiento — tablas, columnas y funciones

Aditivo puro: crea cosas nuevas y **no toca ni una policy ni una función que ya exista**. Por eso no depende de leer `pg_policies` (eso se necesita hasta el Tramo 2) y no puede romper producción.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-accesos-cimiento.sql`

**Interfaces:**
- Produces (para el Tramo 2): `public.nivel_en(uuid, text) → text`, `public.puede_ver(uuid, text) → boolean`, `public.puede_editar(uuid, text) → boolean`, `public.puede_borrar(uuid, text) → boolean`

- [ ] **Step 1: Escribir el archivo**

> El bloque de abajo es el original del plan. La fuente de verdad es `docs/superpowers/plans/sql/2026-09-04-accesos-cimiento.sql`, que la revisión final dejó por delante: `pg_temp` en el `search_path`, los `REVOKE`/`GRANT`, `permisos_validos()` con su `CHECK` y los comentarios nuevos. Leer el archivo, no este bloque.

```sql
-- Cimiento de accesos por herramienta — Tramo 1.
--
-- Spec: docs/superpowers/specs/2026-09-04-accesos-por-herramienta-design.md
--
-- Es ADITIVO: crea dos tablas, cuatro columnas y cuatro funciones. No modifica
-- ninguna policy ni ninguna funcion existente, asi que no cambia el
-- comportamiento de nada que hoy este corriendo. Las policies se mueven modulo
-- por modulo a partir del Tramo 2.
--
-- Modelo (ver §2 del spec):
--   Arriba, el despacho: dueno / admin / colaborador.
--   Abajo, cada boda: por modulo, ninguno / ver / editar / total.
--   'total' es el unico que borra.
--
-- Correr DESPUES de que el codigo del Tramo 1 este en produccion.

BEGIN;

-- ============================================================
-- 1. El despacho
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  primary_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- El plan, los datos fiscales y los asientos aterrizan aqui cuando llegue el
-- chat de precios. Este script NO los agrega a proposito.

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES public.users(id) ON DELETE CASCADE,
  email              text NOT NULL,
  rol                text NOT NULL CHECK (rol IN ('dueno', 'admin', 'colaborador')),
  es_dueno_principal boolean NOT NULL DEFAULT false,
  kit_habitual       jsonb,
  permisos_cuenta    jsonb,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'active', 'revoked')),
  invite_token       text UNIQUE,
  invited_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at         timestamptz NOT NULL DEFAULT now(),
  accepted_at        timestamptz,
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx
  ON public.workspace_members (user_id) WHERE status = 'active';

-- Exactamente un dueno principal por despacho.
CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_un_principal
  ON public.workspace_members (workspace_id) WHERE es_dueno_principal;

-- ============================================================
-- 2. Las columnas nuevas
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

CREATE INDEX IF NOT EXISTS events_workspace_idx ON public.events (workspace_id);

ALTER TABLE public.event_collaborators
  ADD COLUMN IF NOT EXISTS permisos jsonb,
  ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('equipo', 'cliente'));

-- La bitacora necesita saber de que modulo fue el movimiento, y poder agrupar
-- un borrado en cascada para regresarlo completo.
ALTER TABLE public.event_audit_log
  ADD COLUMN IF NOT EXISTS modulo   text,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- ============================================================
-- 3. La unica funcion que decide un permiso
-- ============================================================

CREATE OR REPLACE FUNCTION public.nivel_en(evento uuid, modulo text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = evento AND e.user_id = auth.uid()
    ) THEN 'total'

    WHEN EXISTS (
      SELECT 1
      FROM events e
      JOIN workspace_members m ON m.workspace_id = e.workspace_id
      WHERE e.id = evento
        AND m.user_id = auth.uid()
        AND m.status  = 'active'
        AND m.rol IN ('dueno', 'admin')
    ) THEN 'total'

    ELSE COALESCE(
      (SELECT c.permisos ->> modulo
         FROM event_collaborators c
        WHERE c.event_id = evento
          AND c.user_id  = auth.uid()
          AND c.status   = 'active'
        LIMIT 1),
      'ninguno'
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.puede_ver(evento uuid, modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.nivel_en(evento, modulo) <> 'ninguno' $$;

CREATE OR REPLACE FUNCTION public.puede_editar(evento uuid, modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.nivel_en(evento, modulo) IN ('editar', 'total') $$;

CREATE OR REPLACE FUNCTION public.puede_borrar(evento uuid, modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.nivel_en(evento, modulo) = 'total' $$;

-- ============================================================
-- 4. RLS de las tablas nuevas
-- ============================================================

ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver mi despacho" ON public.workspaces FOR SELECT
  USING (
    primary_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = workspaces.id
        AND m.user_id = auth.uid()
        AND m.status  = 'active'
    )
  );

CREATE POLICY "ver a mis companeros" ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members yo
      WHERE yo.workspace_id = workspace_members.workspace_id
        AND yo.user_id = auth.uid()
        AND yo.status  = 'active'
    )
  );

-- La escritura de miembros llega en el Tramo 5, con la pantalla del despacho.
-- Mientras tanto solo escribe el service role, que se salta RLS.

COMMIT;
```

- [ ] **Step 2: Verificar que el archivo es SQL válido sin correrlo**

Leerlo completo de arriba a abajo y confirmar tres cosas: que todo va dentro de `BEGIN;`/`COMMIT;`, que cada `CREATE` de tabla, índice y columna es `IF NOT EXISTS`, y que **no hay un solo `DROP`, `ALTER POLICY` ni `CREATE OR REPLACE` de una función que ya exista**. Si aparece alguno, es un error del plan: este tramo es aditivo.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-accesos-cimiento.sql
git commit -m "feat(accesos): SQL aditivo del cimiento, tablas y funciones"
```

- [ ] **Step 4: Entregarlo a Diego, no correrlo**

Decirle: *"El SQL del cimiento está en `docs/superpowers/plans/sql/2026-09-04-accesos-cimiento.sql`. Córrelo cuando el código del Tramo 1 ya esté en `main` y desplegado. Es aditivo: no toca nada de lo que hoy funciona."*

**No correrlo por él, ni pedirle credenciales.**

---

## Task 6: El disparador de bitácora

Solo la función genérica. **Colgarla de cada tabla pasa en el tramo de su módulo**, para que ninguna tabla quede registrando antes de que su módulo esté gateado.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-accesos-bitacora.sql`

**Interfaces:**
- Produces: `public.log_borrado()` — función de disparador que se cuelga con `AFTER DELETE ... FOR EACH ROW EXECUTE FUNCTION public.log_borrado('<modulo>', '<entity_type>', '<columna_label>')`

- [ ] **Step 1: Escribir el archivo**

> El bloque de abajo es el original del plan. La fuente de verdad es `docs/superpowers/plans/sql/2026-09-04-accesos-bitacora.sql`, que la revisión final dejó por delante: `pg_temp` en el `search_path` y el aviso ampliado del encabezado.

```sql
-- Bitacora de borrados — la funcion generica.
--
-- Spec §5.4. El registro de borrados NO se llama desde la interfaz: hoy
-- logAction() vive en el codigo de pantalla y esta escrito para fallar en
-- silencio, lo cual esta bien para "cambio un nombre" y es inaceptable para
-- "desaparecio la lista". Con disparador, si la fila se fue, la bitacora lo
-- supo, venga de donde venga el borrado.
--
-- Guarda la fila COMPLETA en old_value: restaurar es volver a insertarla.
-- Los borrados en cascada comparten batch_id y se regresan juntos, padre primero.
--
-- Este script solo crea la funcion. Colgarla de cada tabla pasa en el tramo de
-- su modulo.

BEGIN;

CREATE OR REPLACE FUNCTION public.log_borrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modulo   text := TG_ARGV[0];
  v_entidad  text := TG_ARGV[1];
  v_col      text := TG_ARGV[2];
  v_fila     jsonb := to_jsonb(OLD);
  v_evento   uuid;
  v_email    text;
  v_nombre   text;
BEGIN
  -- El evento sale de la fila cuando la trae; si no, el disparador no se cuelga
  -- de esa tabla (se resuelve en el tramo de su modulo).
  v_evento := NULLIF(v_fila ->> 'event_id', '')::uuid;
  IF v_evento IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT u.email, u.full_name INTO v_email, v_nombre
  FROM users u WHERE u.id = auth.uid();

  INSERT INTO event_audit_log (
    event_id, user_id, user_email, user_name,
    action, entity_type, entity_id, entity_label,
    old_value, new_value, modulo, batch_id
  ) VALUES (
    v_evento,
    auth.uid(),
    COALESCE(v_email, ''),
    v_nombre,
    v_entidad || '.deleted',
    v_entidad,
    NULLIF(v_fila ->> 'id', '')::uuid,
    v_fila ->> v_col,
    v_fila,
    NULL,
    v_modulo,
    -- Un mismo statement (y por lo tanto una cascada completa) comparte
    -- transaccion; el id de transaccion agrupa el borrado entero.
    (('00000000-0000-4000-8000-' || lpad(to_hex(txid_current()), 12, '0'))::uuid)
  );

  RETURN OLD;
END;
$$;

COMMIT;
```

- [ ] **Step 2: Revisar el archivo**

Confirmar que la función **solo inserta** en `event_audit_log`, que devuelve `OLD` en todos los caminos, y que si algo no cuadra (`event_id` ausente) **no revienta el borrado** — sale por `RETURN OLD`. Una bitácora que tumba la operación principal es peor que no tenerla.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-accesos-bitacora.sql
git commit -m "feat(accesos): funcion de bitacora de borrados por disparador"
```

---

## Task 7: La migración, con su previo

Dos archivos: uno que **solo lee** y enseña quién amanece con qué, y otro que escribe. Nunca se corre el segundo sin haber leído la salida del primero.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-accesos-migracion-previo.sql`
- Create: `docs/superpowers/plans/sql/2026-09-04-accesos-migracion-aplicar.sql`

- [ ] **Step 1: Escribir el previo (solo lectura)**

```sql
-- PREVIO de la migracion de accesos. NO ESCRIBE NADA.
--
-- Ensena exactamente como va a quedar cada persona. Se corre en el editor de
-- Supabase, se lee la salida, y solo entonces se corre el archivo -aplicar.
--
-- Reglas (spec §8):
--   dueno del evento -> se le crea su despacho, el es dueno principal
--   role 'admin'     -> colaborador con 'total' en los doce modulos, SOLO en esa boda
--                       (NO sube a admin del despacho: amaneceria con acceso a
--                        bodas donde nunca lo invitaron)
--   role 'editor'    -> 'editar' en los doce. Pierde borrar hasta que se lo den
--   role 'viewer'    -> 'ver' en los doce

-- 1. Los despachos que se van a crear, uno por dueno
SELECT
  u.id                        AS dueno_id,
  u.email                     AS dueno_email,
  COALESCE(u.full_name, u.email) AS nombre_del_despacho,
  count(e.id)                 AS bodas_que_se_le_asignan
FROM users u
JOIN events e ON e.user_id = u.id
GROUP BY u.id, u.email, u.full_name
ORDER BY count(e.id) DESC;

-- 2. Persona por persona, boda por boda: donde amanece
SELECT
  e.name                                   AS boda,
  c.email                                  AS persona,
  c.role                                   AS hoy,
  CASE c.role
    WHEN 'admin'  THEN 'total  (borra)'
    WHEN 'editor' THEN 'editar (ya NO borra)'
    WHEN 'viewer' THEN 'ver'
    ELSE '?? REVISAR A MANO'
  END                                      AS manana_en_los_12_modulos,
  CASE WHEN c.role = 'editor' THEN 'SI' ELSE 'no' END AS pierde_borrar,
  c.status
FROM event_collaborators c
JOIN events e ON e.id = c.event_id
WHERE c.status <> 'revoked'
ORDER BY e.name, c.email;

-- 3. El semaforo: si esto no da cero, hay filas que la migracion no sabe mapear
SELECT count(*) AS filas_sin_mapeo
FROM event_collaborators
WHERE status <> 'revoked'
  AND (role IS NULL OR role NOT IN ('admin', 'editor', 'viewer'));

-- 4. Eventos sin dueno valido: tienen que ser cero
SELECT count(*) AS eventos_sin_dueno
FROM events e
LEFT JOIN users u ON u.id = e.user_id
WHERE u.id IS NULL;
```

- [ ] **Step 2: Escribir el aplicar**

```sql
-- APLICAR la migracion de accesos.
--
-- Requisitos, en este orden:
--   1. 2026-09-04-accesos-cimiento.sql ya corrio
--   2. El codigo del Tramo 1 ya esta en produccion
--   3. La salida de -previo.sql ya la reviso y aprobo Diego
--
-- Es idempotente: se puede correr dos veces sin duplicar nada.
-- Es reversible: no borra ni modifica event_collaborators.role, solo agrega.

BEGIN;

-- Se aborta si el previo no daba cero.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM event_collaborators
   WHERE status <> 'revoked'
     AND (role IS NULL OR role NOT IN ('admin', 'editor', 'viewer'));
  IF n > 0 THEN
    RAISE EXCEPTION 'Hay % colaboradores con un rol que la migracion no sabe mapear. Correr el previo.', n;
  END IF;
END $$;

-- 1. Un despacho por cada dueno de eventos
INSERT INTO workspaces (name, primary_owner_id)
SELECT COALESCE(u.full_name, u.email), u.id
FROM users u
WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.primary_owner_id = u.id);

-- 2. El dueno principal como miembro de su propio despacho
INSERT INTO workspace_members (workspace_id, user_id, email, rol, es_dueno_principal, status, accepted_at)
SELECT w.id, u.id, u.email, 'dueno', true, 'active', now()
FROM workspaces w
JOIN users u ON u.id = w.primary_owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members m
   WHERE m.workspace_id = w.id AND m.user_id = u.id
);

-- 3. Cada boda apunta a su despacho
UPDATE events e
   SET workspace_id = w.id
  FROM workspaces w
 WHERE w.primary_owner_id = e.user_id
   AND e.workspace_id IS DISTINCT FROM w.id;

-- 4. Los permisos de cada colaborador, derivados de su rol de hoy
UPDATE event_collaborators c
   SET permisos = (
         SELECT jsonb_object_agg(m, CASE c.role
                                      WHEN 'admin'  THEN 'total'
                                      WHEN 'editor' THEN 'editar'
                                      ELSE 'ver'
                                    END)
         FROM unnest(ARRAY[
           'invitados','invitacion','mensajes','mesas','timeline',
           'regalos','album','playlist','vestimenta',
           'presupuesto','proveedores','pagos'
         ]) AS m
       ),
       tipo = COALESCE(c.tipo, 'equipo')
 WHERE c.status <> 'revoked'
   AND c.permisos IS NULL;

COMMIT;

-- Verificacion posterior: las tres deben dar cero.
SELECT count(*) AS eventos_sin_despacho     FROM events WHERE workspace_id IS NULL;
SELECT count(*) AS colaboradores_sin_permisos
  FROM event_collaborators WHERE status <> 'revoked' AND permisos IS NULL;
SELECT count(*) AS despachos_sin_dueno
  FROM workspaces w WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = w.id AND m.es_dueno_principal);
```

- [ ] **Step 3: Revisar los dos archivos**

Confirmar que el previo **no tiene un solo `INSERT`, `UPDATE`, `DELETE` ni `ALTER`**, y que el aplicar no toca `event_collaborators.role` — solo agrega en `permisos` y `tipo`. Si `role` aparece del lado izquierdo de un `SET`, es un error del plan.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-accesos-migracion-previo.sql \
        docs/superpowers/plans/sql/2026-09-04-accesos-migracion-aplicar.sql
git commit -m "feat(accesos): migracion de colaboradores con su previo de solo lectura"
```

- [ ] **Step 5: Entregar el orden completo a Diego, por escrito**

1. Mergear y desplegar el código del Tramo 1 a `main`.
2. Correr `2026-09-04-accesos-cimiento.sql`.
3. Correr `2026-09-04-accesos-bitacora.sql`.
4. Correr `2026-09-04-accesos-migracion-previo.sql` y **leer la salida**. Las consultas 3 y 4 deben dar cero. La consulta 2 es la lista que aprueba.
5. Solo si la aprueba: correr `2026-09-04-accesos-migracion-aplicar.sql` y verificar que las tres consultas del final dan cero.

**Ninguno de estos pasos lo ejecuta el agente.**

---

## Cierre del Tramo 1

Al terminar, esto es cierto:

- Existe una sola función en la app y una sola en Postgres que deciden un permiso, y la de la app tiene su tabla de verdad probada.
- Existe el componente que envuelve controles.
- Existen el despacho, sus miembros y los permisos por módulo, con todos los datos de hoy ya migrados.
- **Ninguna pantalla cambió de comportamiento.** Los tres huecos del §1 del spec siguen abiertos: se cierran en los Tramos 2 y 3.

**Lo que desbloquea el Tramo 2:** antes de mover la primera policy hay que leer las que existen. Pedirle a Diego `select * from pg_policies where schemaname = 'public'` y un `pg_dump --schema-only`. Sin eso no se escribe SQL que modifique nada.

### Bloqueantes del Tramo 2

Cinco cosas que el Tramo 1 deja abiertas a propósito y que el Tramo 2 **no puede** empezar sin cerrar. No son mejoras: son las que reintroducen el defecto que todo esto existe para matar.

**1. El flujo de invitación tiene que escribir `permisos`.**
Hoy `app/events/[id]/configuracion/page.tsx` inserta el colaborador sin esa columna. Después de correr la migración, eso deja de ser inofensivo: cada persona nueva nace con `permisos = NULL`, cae en el respaldo legado, y el respaldo le da **`total` en los doce módulos** si su rol es admin o editor — incluido borrar, que es justo lo que la migración le quita al editor. Del otro lado, `nivel_en()` le responde `'ninguno'` porque en la base no hay nada que leer. Resultado: la persona ve los doce módulos con todos los controles encendidos y la base le niega cada acción. Es el defecto del §1 del spec, reintroducido por la puerta de atrás en cada invitación nueva. Se cierra escribiendo `permisos` (y `tipo`) en el insert, antes de la primera policy.

**2. `permisosDesdeRolLegado()` se borra o se acota.**
Es un puente para la ventana entre desplegar el código y correr la migración, no un respaldo permanente. Hoy no distingue "la columna todavía no existe" de "esta fila no tiene permisos", y esos dos casos dejan de significar lo mismo en cuanto la migración corra: después de migrar, una fila sin permisos es una fila mal escrita, no una base vieja. O se borra la función, o se acota a que solo aplique cuando la consulta falló de verdad.

**3. `hasAccess` tiene que derivarse de los permisos.**
Hoy es `role !== null`, y el §6 del spec dice que el acceso a la boda es la suma de las herramientas: quien no tenga ni un módulo en `ver` no tiene acceso. `resumir()` ya existe en `lib/permisos/resolver.ts` para exactamente eso y hoy no lo usa nadie.

**4. El secuestro de `user_id` deja de ser un pendiente heredado.**
Un colaborador con rol admin de evento puede apropiarse de la boda cambiando el dueño. La raíz es preexistente, pero desde el Tramo 2 el premio crece: la primera rama de `nivel_en()` le responde `'total'` en los doce módulos por ser dueño del evento, y ahí ya no hay UI que lo module. Es bloqueante nombrado del Tramo 2, no algo que "se cierra solo" cuando lleguen las policies.

**5. Las lecturas de schema que hay que pedirle a Diego antes de la primera policy.**
Ninguna se puede sustituir por inferencia:
- `select * from pg_policies where schemaname = 'public'` completo.
- Un `pg_dump --schema-only`.
- Si existe índice único en `event_collaborators(event_id, user_id)`. Sin él, `nivel_en()` con su `LIMIT 1` elige una fila arbitraria entre duplicados.
- Las tres comprobaciones de `event_audit_log` del encabezado de `2026-09-04-accesos-bitacora.sql`: la acción de la llave foránea `event_id -> events.id`, si `action` o `entity_type` tienen `CHECK`, y si `user_id` o `user_name` son `NOT NULL`.

### Nota para el Tramo 5

`set_event_workspace` elige el despacho por `primary_owner_id`, lo cual asume **una persona = un despacho**. Cuando el Tramo 5 permita que alguien sea miembro de varios despachos, ese trigger deja de tener una respuesta correcta y hay que rehacerlo: tendrá que elegir por membresía (y el alta de evento tendrá que decir a cuál despacho va), no por quién es dueño principal de qué.
