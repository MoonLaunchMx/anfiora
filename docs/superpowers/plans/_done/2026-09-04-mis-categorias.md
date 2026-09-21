# Mis categorías — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un planner pueda ver todas sus categorías juntas y limpiarlas: cambiar nombre, juntar dos que son la misma, ocultar las que ya no usa, y eliminar las que no usa nadie.

**Architecture:** Una pantalla nueva en `/rolodex/categorias`, alimentada por lógica pura y probada en `lib/rolodex/`. El vocabulario activo sigue viviendo en `users.categories`; las ocultas se mudan a `users.categories_archived`, así que nada de lo ya construido cambia de forma. Cada acción que arrastra datos —renombrar y juntar— se calcula primero como un plan explícito que la pantalla le enseña al planner **antes** de ejecutarlo.

**Tech Stack:** Next.js 16 App Router · TypeScript · Supabase · Vitest · Tailwind v4

**Diseño aprobado:** https://claude.ai/code/artifact/77179d23-63f1-4cc5-83af-39cfd37db5f6
**Contexto:** continúa `docs/superpowers/plans/2026-09-04-rolodex-cimiento-datos.md`, que construyó el vocabulario.

## Global Constraints

- **Nunca tocar Supabase desde el código.** El script SQL lo corre Diego.
- **Sin comentarios** salvo cuando el *por qué* no es obvio.
- **Solo Tailwind.** Íconos de **Lucide React**, nunca SVG a mano. Botón principal en teal `#48C9B0`; negro `#1D1E20` solo en dropdowns de filtro.
- **UI en español CON acentos.** Commits **sin acentos y sin ñ**, terminando con:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011vu4WefwRrd9zBMXD7QTZb
```

- **Las palabras que ve el planner son estas, y no se cambian:** «Cambiar nombre», «Juntar con otra…», «Ya no la uso», «Eliminar». Nunca aparecen «archivar» ni «fusionar» en pantalla.
- **Nunca `git add -A`.** Otro agente trabaja en este repo.
- **No correr `npm run lint`** — ~158 mil problemas pre-existentes. Los guardianes son `npx tsc --noEmit` y `npm test`.
- Confirmaciones con el primitivo `useConfirm` de `@/app/components/ui/ConfirmModal` y modales con `Modal` de `@/app/components/ui/Modal` — nunca `confirm()` del navegador.

## Fuera de alcance

- La lista de proveedores del Rolodex. Esta pantalla nace sola; el Rolodex le colgará un enlace después.
- Permisos: hoy cada quien administra su propio vocabulario. El epic de accesos decidirá lo demás.
- Colores o íconos por categoría.

---

### Task 1: Dónde se guardan las ocultas

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-categorias-ocultas.sql`

- [ ] **Step 1: Escribir el script**

```sql
-- Mis categorias: donde se guardan las ocultas.
--
-- users.categories es el vocabulario ACTIVO. Ocultar una categoria la mueve a
-- users.categories_archived: deja de ofrecerse al capturar, pero los proveedores
-- y las partidas que ya la tienen la conservan intacta.
--
-- Se eligio una segunda lista en vez de volver la primera una lista de objetos
-- porque asi resolverVocabulario() y todo lo que ya lee users.categories siguen
-- funcionando sin cambiar de forma.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS categories_archived JSONB DEFAULT '[]'::jsonb;

COMMIT;

-- ============ Marcha atras ============
-- Esto borra que categorias estaban ocultas. Las categorias en si no se pierden:
-- viven en los proveedores y las partidas que las usan.
-- BEGIN;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS categories_archived;
-- COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-categorias-ocultas.sql
git commit -m "chore(sql): columna para las categorias ocultas"
```

- [ ] **Step 3: Diego lo corre y verifica**

```sql
select column_name from information_schema.columns
where table_name = 'users' and column_name = 'categories_archived';
```

---

### Task 2: La lógica, pura y probada

**Files:**
- Create: `lib/rolodex/vocabulario-admin.ts`
- Test: `lib/rolodex/vocabulario-admin.test.ts`

**Interfaces:**
- Consumes: `mismaCategoria` y `normalizarCategoria` de `lib/rolodex/categorias.ts`.
- Produces: `CategoriaConUso`, `parecidas(nombres)`, `planDeRenombre(...)`, `planDeJuntar(...)`, `puedeEliminarse(uso)`.

**Un cambio previo, en `lib/rolodex/categorias.ts`:** su `normalizar` es privada hoy. Este módulo necesita exactamente la misma normalización, y tener dos copias es garantía de que un día se separen. Renombrarla a `normalizarCategoria` y **exportarla**, dejando `mismaCategoria` usándola igual que ahora. Es un cambio de una línea y no altera comportamiento.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/rolodex/vocabulario-admin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parecidas, planDeRenombre, planDeJuntar, puedeEliminarse } from './vocabulario-admin'

describe('parecidas', () => {
  it('encuentra un dedazo de una letra', () => {
    expect(parecidas(['Decoracion', 'Decoraciones'])).toEqual([['Decoracion', 'Decoraciones']])
  })

  it('encuentra cuando una contiene a la otra', () => {
    expect(parecidas(['Audio', 'Audio y Video'])).toEqual([['Audio', 'Audio y Video']])
  })

  it('no inventa parecidos entre categorias distintas', () => {
    expect(parecidas(['Venue', 'Banquete', 'Pirotecnia'])).toEqual([])
  })

  it('no reporta el mismo par dos veces', () => {
    const r = parecidas(['Flores', 'Flor'])
    expect(r).toHaveLength(1)
  })
})

describe('planDeRenombre', () => {
  it('dice cuantos proveedores y partidas se van a tocar', () => {
    const p = planDeRenombre('Imagen', 'Fotografia', { proveedores: 5, partidas: 6 })
    expect(p).toEqual({ de: 'Imagen', a: 'Fotografia', proveedores: 5, partidas: 6, choca: false })
  })

  it('avisa cuando el nombre nuevo ya existe', () => {
    const p = planDeRenombre('Decoracion', 'Decoracion ', { proveedores: 1, partidas: 0 }, ['Decoracion'])
    expect(p.choca).toBe(true)
  })
})

describe('planDeJuntar', () => {
  it('mueve todo lo de la que sobra a la que se queda', () => {
    const p = planDeJuntar('Decoracion', 'Decoracion con acento', { proveedores: 1, partidas: 0 })
    expect(p).toEqual({ sobra: 'Decoracion', queda: 'Decoracion con acento', proveedores: 1, partidas: 0 })
  })

  it('no deja juntar una categoria consigo misma', () => {
    expect(() => planDeJuntar('Venue', 'venue', { proveedores: 0, partidas: 0 })).toThrow()
  })
})

describe('puedeEliminarse', () => {
  it('solo cuando nadie la usa', () => {
    expect(puedeEliminarse({ proveedores: 0, partidas: 0 })).toBe(true)
    expect(puedeEliminarse({ proveedores: 1, partidas: 0 })).toBe(false)
    expect(puedeEliminarse({ proveedores: 0, partidas: 3 })).toBe(false)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- vocabulario-admin`
Expected: FAIL, módulo no encontrado.

- [ ] **Step 3: Escribir el módulo**

Crear `lib/rolodex/vocabulario-admin.ts`:

```ts
import { mismaCategoria, normalizarCategoria } from './categorias'

export type Uso = { proveedores: number; partidas: number }

export type CategoriaConUso = {
  nombre: string
  uso: Uso
  oculta: boolean
}

// Distancia de edicion acotada a 3: mas alla no nos interesa y salir temprano
// evita comparar cien categorias entre si sin necesidad.
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = prev[j]
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      anterior = guardado
    }
  }
  return prev[b.length]
}

// El arreglo de acentos ya impide CREAR una categoria casi igual, asi que esto
// sirve para las que ya existian y para lo que la normalizacion no atrapa:
// plurales, una letra de mas, o una que es prefijo de otra.
export function parecidas(nombres: string[]): [string, string][] {
  const pares: [string, string][] = []
  for (let i = 0; i < nombres.length; i++) {
    for (let j = i + 1; j < nombres.length; j++) {
      const a = normalizarCategoria(nombres[i])
      const b = normalizarCategoria(nombres[j])
      if (!a || !b) continue
      const contiene = a.startsWith(b) || b.startsWith(a)
      if (contiene || distancia(a, b) <= 2) pares.push([nombres[i], nombres[j]])
    }
  }
  return pares
}

export function planDeRenombre(
  de: string,
  a: string,
  uso: Uso,
  vocabulario: string[] = [],
): { de: string; a: string; proveedores: number; partidas: number; choca: boolean } {
  const choca = vocabulario.some(c => !mismaCategoria(c, de) && mismaCategoria(c, a))
  return { de, a: a.trim(), proveedores: uso.proveedores, partidas: uso.partidas, choca }
}

export function planDeJuntar(
  sobra: string,
  queda: string,
  uso: Uso,
): { sobra: string; queda: string; proveedores: number; partidas: number } {
  if (mismaCategoria(sobra, queda)) throw new Error('No se puede juntar una categoria consigo misma')
  return { sobra, queda, proveedores: uso.proveedores, partidas: uso.partidas }
}

export function puedeEliminarse(uso: Uso): boolean {
  return uso.proveedores === 0 && uso.partidas === 0
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- vocabulario-admin`
Expected: PASS, 9 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/rolodex/vocabulario-admin.ts lib/rolodex/vocabulario-admin.test.ts
git commit -m "feat(rolodex): logica para administrar el vocabulario"
```

---

### Task 3: La pantalla, en solo lectura

Primero se ve, después se toca. Esta tarea deja la lista con sus cuentas y el aviso de parecidas, sin ninguna acción.

**Files:**
- Create: `app/rolodex/categorias/page.tsx`
- Create: `app/rolodex/layout.tsx` (cáscara mínima: fondo, ancho, y un encabezado con el nombre de la sección)

**Interfaces:**
- Consumes: `resolverVocabulario` de `lib/rolodex/categorias.ts`; `parecidas`, `CategoriaConUso` de la tarea 2.

- [ ] **Step 1: Cargar el vocabulario y las cuentas**

La página es `'use client'` y hace, con `supabase` del navegador:

1. `supabase.auth.getUser()` — sin sesión, manda a la landing.
2. `users.categories` y `users.categories_archived` de esa fila.
3. `suppliers` del usuario: `select('category').eq('user_id', user.id)` — se cuentan en el cliente por categoría, comparando con `mismaCategoria`.
4. Los eventos del usuario (`events.select('id').eq('user_id', user.id)`) y luego `event_budgets.select('category').in('event_id', ids)` — se cuentan igual.

Con eso arma `CategoriaConUso[]`: el vocabulario resuelto, más las ocultas marcadas, cada una con sus dos cuentas.

**Las ocultas no se pierden de vista:** se listan al final, en gris, con una etiqueta «Oculta».

- [ ] **Step 2: Dibujar la lista**

Sigue el patrón de las páginas de `events/[id]/` que ya existen: contenedor con `flex-1 overflow-y-auto` propio, encabezado fijo con el título y el conteo, y filas separadas por `border-b`.

Cada fila: nombre a la izquierda; a la derecha, en `text-[#928E87]`, «7 proveedores · 9 partidas», o «Nadie la usa» cuando las dos cuentas son cero. Un botón de menú (`MoreHorizontal` de Lucide) al final, que en esta tarea no hace nada todavía.

- [ ] **Step 3: El aviso de parecidas**

Arriba de la lista, si `parecidas()` devuelve algo: una tarjeta ámbar con el par, el texto «Puede que sean la misma escrita distinto» y un botón «Revisar» inerte por ahora. Si no devuelve nada, la tarjeta no se renderiza.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → sin errores nuevos.
Run: `npm test` → sin cambios.

A mano en `localhost:3001/rolodex/categorias`: se ve la lista con cuentas que cuadran con lo que hay en tus bodas.

- [ ] **Step 5: Commit**

```bash
git add app/rolodex/layout.tsx app/rolodex/categorias/page.tsx
git commit -m "feat(rolodex): pantalla de categorias, solo lectura"
```

---

### Task 4: Las acciones que arrastran

**Files:**
- Create: `app/rolodex/categorias/AccionesCategoria.tsx` — el menú y sus tres modales
- Create: `lib/rolodex/aplicar-cambios.ts` — las escrituras, en un solo lugar
- Modify: `app/rolodex/categorias/page.tsx` — conectar el menú

**Interfaces:**
- Consumes: los planes de la tarea 2.
- Produces: `aplicarRenombre(...)`, `aplicarJuntar(...)`, `aplicarOcultar(...)`, `aplicarEliminar(...)`.

- [ ] **Step 1: Escribir las escrituras en un solo módulo**

`lib/rolodex/aplicar-cambios.ts` concentra todo lo que toca la base, para que la pantalla no tenga ni un `supabase.from(...)`. Cada función recibe el cliente y devuelve `{ ok: boolean; error?: string }`.

**Renombrar** hace cuatro escrituras, en este orden:
1. `suppliers` del usuario con esa categoría → nombre nuevo.
2. `event_budgets` de los eventos del usuario con esa categoría → nombre nuevo.
3. Las listas `event_settings.budget_categories` de esos eventos que contengan el nombre viejo → reemplazado.
4. `users.categories` → reemplazado.

**Juntar** es lo mismo, con el nombre nuevo ya existente, y al final quita el nombre que sobra de `users.categories` en vez de reemplazarlo.

**Ocultar** mueve el nombre de `users.categories` a `users.categories_archived`. **Reactivar** hace lo contrario. Ninguna de las dos toca proveedores ni partidas.

**Eliminar** solo quita el nombre de `users.categories`. La pantalla nunca la ofrece si `puedeEliminarse` es falso, pero la función lo vuelve a verificar antes de escribir.

**Por qué importa el orden:** si algo falla a media escritura, es mejor que los datos ya estén con el nombre nuevo y la lista todavía con el viejo (se vuelve a intentar y termina) que al revés (la lista dice un nombre que ningún proveedor tiene). Cada función corta y devuelve el error en cuanto una escritura falla.

- [ ] **Step 2: El menú y los tres modales**

`AccionesCategoria.tsx` usa `Modal` de `@/app/components/ui/Modal`. Los textos son exactamente los del diseño aprobado:

- **Cambiar nombre** — un campo con el nombre actual y, debajo, la consecuencia: «Se va a actualizar en N proveedores y N partidas de presupuesto, en todas tus bodas». Si `plan.choca`, el botón se deshabilita y aparece «Ya tienes una categoría que se llama así. Júntalas en vez de renombrar».
- **Juntar con otra…** — se abre desde la que sobra. Un select con las demás categorías, la consecuencia «N proveedores pasan de X a Y. La categoría X desaparece de tus menús», y en rojo «Esto no se puede deshacer».
- **Ya no la uso** — «Deja de aparecer cuando captures proveedores o partidas. Tus N proveedores que ya la tienen no cambian, y su historial se conserva.»
- **Eliminar** — solo habilitado con cero uso. Si el planner lo intenta con uso, no se muestra un error: el menú lo deja apagado y la fila ofrece juntar u ocultar.

Botón principal en teal `#48C9B0`; el de eliminar en rojo.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` y `npm test`.

- [ ] **Step 4: Commit**

```bash
git add lib/rolodex/aplicar-cambios.ts app/rolodex/categorias/AccionesCategoria.tsx app/rolodex/categorias/page.tsx
git commit -m "feat(rolodex): cambiar nombre, juntar, ocultar y eliminar categorias"
```

- [ ] **Step 5: La prueba de Diego**

En `localhost:3001/rolodex/categorias`, con una boda de demo:
1. Cambiar el nombre de una categoría que sí se usa → verificar en el Presupuesto de esa boda y en Proveedores que quedó el nombre nuevo en los dos lados.
2. Juntar dos → el proveedor de la que sobraba quedó en la que se quedó, y la que sobraba ya no aparece en los menús.
3. Ocultar una → deja de salir al capturar un proveedor, pero el proveedor que ya la tenía la sigue mostrando.
4. Eliminar una que nadie usa → desaparece. Intentar eliminar una usada → el menú no lo permite.

---

### Task 5: Las ocultas dejan de ofrecerse

Ocultar no sirve de nada si la categoría sigue apareciendo al capturar.

**Files:**
- Modify: `lib/rolodex/categorias.ts` — `resolverVocabulario` acepta las ocultas
- Modify: `lib/rolodex/categorias.test.ts`
- Modify: `app/events/[id]/proveedores/page.tsx` y `app/events/[id]/presupuesto/page.tsx` — leer también `categories_archived`

- [ ] **Step 1: La prueba que falla**

En `lib/rolodex/categorias.test.ts`, dentro de `describe('resolverVocabulario', ...)`:

```ts
  it('no ofrece las categorias ocultas', () => {
    const v = resolverVocabulario(['Pirotecnia'], ['Pirotecnia'])
    expect(v).not.toContain('Pirotecnia')
  })

  it('tambien puede ocultar una categoria base', () => {
    const v = resolverVocabulario(null, ['Bebidas'])
    expect(v).not.toContain('Bebidas')
    expect(v).toContain('Venue')
  })
```

- [ ] **Step 2: Ensanchar la firma**

```ts
export function resolverVocabulario(
  guardado: string[] | null | undefined,
  ocultas: string[] | null | undefined = [],
): string[] {
  const base = guardado && guardado.length > 0 ? [...guardado] : []
  for (const c of CATEGORIAS_BASE) {
    if (!base.some(x => mismaCategoria(x, c))) base.push(c)
  }
  const fuera = ocultas ?? []
  return base.filter(c => !fuera.some(o => mismaCategoria(o, c)))
}
```

El segundo parámetro tiene default, así que las llamadas existentes siguen compilando sin tocarse.

- [ ] **Step 3: Que las dos pantallas lean las ocultas**

En `proveedores/page.tsx` y `presupuesto/page.tsx`, donde hoy se lee `select('categories')`, pasa a `select('categories, categories_archived')`, y la llamada pasa a `resolverVocabulario(perfil?.categories, perfil?.categories_archived)`.

- [ ] **Step 4: Verificar**

Run: `npm test` → las 2 nuevas pasan.
Run: `npx tsc --noEmit`.

A mano: ocultar una categoría y confirmar que ya no aparece al dar de alta un proveedor, en las dos pantallas.

- [ ] **Step 5: Commit**

```bash
git add lib/rolodex/categorias.ts lib/rolodex/categorias.test.ts "app/events/[id]/proveedores/page.tsx" "app/events/[id]/presupuesto/page.tsx"
git commit -m "feat(rolodex): las categorias ocultas dejan de ofrecerse"
```

---

## Cómo se sabe que quedó bien

1. `npm test` pasa, con las 11 pruebas nuevas.
2. Cambiar el nombre de una categoría lo cambia **en los proveedores y en las partidas**, en todas las bodas. Si solo cambiara en un lado, habríamos creado el desorden que la pantalla existe para limpiar.
3. Juntar dos deja una, y ningún proveedor se queda sin categoría.
4. Ocultar una la saca de los menús sin tocar a quien ya la tenía.
5. Eliminar nunca está disponible sobre una categoría que alguien usa.
