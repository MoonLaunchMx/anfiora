# Rolodex — Cimiento de datos: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el esquema en condiciones de sostener un Rolodex: categorías que crecen con el planner en vez de un techo de catorce, una sola columna por relación, y las piezas que le faltan a `suppliers` para ser un directorio (etiquetas, archivado, bitácora).

**Architecture:** Nada se parcha. Cada cosa que hoy se dice en dos lugares pasa a decirse en uno, y el lugar viejo se borra en la misma tanda. Las categorías suben del evento al usuario: nace un vocabulario por planner (`users.categories`) que sirve al Rolodex y a todos sus presupuestos, mientras cada evento sigue eligiendo cuáles muestra. La lógica pura vive en `lib/rolodex/` con pruebas; las pantallas solo consumen.

**Tech Stack:** Next.js 16 App Router · TypeScript · Supabase (Postgres + RLS) · Vitest · Tailwind v4

**Spec:** `docs/superpowers/specs/2026-09-04-rolodex-cimiento-datos-design.md`

## Global Constraints

- **Nunca tocar Supabase desde el código.** Los cinco scripts SQL los corre Diego a mano. Ningún paso de este plan modifica la base.
- **Sin comentarios** salvo cuando el *por qué* no es obvio.
- **Solo Tailwind** para estilos. Íconos de Lucide React.
- **UI en español con acentos.** Commits **sin acentos y sin ñ** (`feat:`, `fix:`, `refactor:`), terminando con:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011vu4WefwRrd9zBMXD7QTZb
```

- **Nunca `git add -A`.** Otro agente está trabajando en el mismo repo (ver abajo). Siempre `git add` archivo por archivo.
- **No correr `npm run lint`** — ~158 mil problemas pre-existentes y más de 5 minutos. Los guardianes son `npx tsc --noEmit` y `npm test`.
- La UI se verifica a mano en `localhost:3000`. Ninguna pantalla se declara lista sin que Diego la haya visto.

## Coordinación con el agente de accesos

Diego va a implementar el sistema de accesos con otro agente **en paralelo, en este mismo repo**. Tres lugares donde se pueden pisar, y qué hacer en cada uno:

1. **`event_audit_log` y sus políticas.** La tarea 8 vuelve `event_id` nullable y **agrega una política nueva** para las filas globales. El agente de accesos probablemente reescriba políticas de esa tabla. **Antes de correr el SQL de la tarea 8, confirmar con Diego que no hay una migración de accesos pendiente sobre esa tabla.** Las dos migraciones no pueden ir a ciegas.

2. **Políticas de `suppliers`, `event_suppliers` y `event_budgets`.** El agente de accesos va a abrirlas a colaboradores. Este plan **no toca ni una política de esas tres tablas** — solo columnas. Son cambios independientes salvo por una cosa: **si una política nueva menciona `event_budgets.event_supplier_id`, el `DROP COLUMN` de la tarea 7 falla.** Si eso pasa, el error es claro y la solución es reescribir esa política primero, no cancelar el drop.

3. **`lib/types.ts`.** La tarea 5 cambia `Supplier.category` de `BudgetCategory` a `string`. El agente de accesos probablemente toque los tipos de roles, en otra región del mismo archivo. Conflicto de merge probable, resolución trivial: son cambios en líneas distintas.

**Y un aviso sobre trabajo parado:** existe la rama `feat/rolodex-cimiento` (8 commits, sin mergear) con candados de nav y guardias de página que **codifican lo contrario del modelo de accesos de Diego** — esconden Finanzas a los colaboradores. No construir encima. Lo único aprovechable de ahí es `lib/rolodex/permisos.ts` como forma del seam.

## Fuera de alcance

- **Permisos y RBAC.** Epic aparte, otro agente.
- **La UI del Rolodex** (directorio y expediente). Es el plan siguiente; este solo deja la base capaz de sostenerlo.
- **Leer las conversaciones del proveedor.** `conversations.contact_supplier_id` ya existe y nadie la usa; se nombra en el spec para que el expediente le reserve lugar.

---

## Fase A — lo que no se nota

### Task 1: El script que arregla lo roto y agrega lo que falta

Cinco cambios que el código actual no nota: puede correr con lo que hay desplegado hoy.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-rolodex-A-esquema.sql`

**Interfaces:**
- Consumes: nada.
- Produces: las columnas `suppliers.tags`, `suppliers.archived_at`; la restricción `event_suppliers_evento_proveedor_unico`; el índice `suppliers_user_nombre_idx`.

- [ ] **Step 1: Escribir el script**

```sql
-- Rolodex, cimiento A: arreglar lo roto y agregar lo que falta.
--
-- Los cinco cambios son invisibles para el codigo desplegado hoy: nadie lee tags
-- ni archived_at todavia, el default nuevo solo aplica a inserts que no mandan
-- status (hoy todos lo mandan), y las dos restricciones no tienen filas que
-- violar (verificado 4-sep: 0 duplicados de cualquier tipo).
--
-- Por eso este script puede correr ANTES de desplegar nada.

BEGIN;

-- ============ 1) El default que no pasaba su propio CHECK ============
-- Default 'contactado' contra un CHECK que solo acepta
-- nuevo|cotizado|contratado|descartado: cualquier insert sin status explicito
-- reventaba con 23514. Hoy no truena porque el codigo siempre lo manda.
ALTER TABLE public.event_suppliers
  ALTER COLUMN status SET DEFAULT 'nuevo';

-- ============ 2) Un proveedor no entra dos veces a la misma boda ============
-- Sin esto el conteo "6a vez" del expediente es mentira.
ALTER TABLE public.event_suppliers
  ADD CONSTRAINT event_suppliers_evento_proveedor_unico
  UNIQUE (event_id, supplier_id);

-- ============ 3) Buscar por nombre, sin bloquear ============
-- Indice NO unico a proposito: dos floristas reales pueden llamarse igual.
-- El aviso de posible duplicado vive en la pantalla, donde la persona decide.
CREATE INDEX IF NOT EXISTS suppliers_user_nombre_idx
  ON public.suppliers (user_id, lower(name));

-- ============ 4) Etiquetas ============
-- En un directorio de 200 proveedores se filtra por "economico" o "no contestan"
-- mas que por categoria. Es la unica tabla de la app sin etiquetas.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- ============ 5) Archivar sin perder la historia ============
-- Borrar un proveedor se lleva su historial, que es justo lo que el Rolodex vende.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMIT;

-- ============ Marcha atras ============
-- BEGIN;
-- ALTER TABLE public.event_suppliers ALTER COLUMN status SET DEFAULT 'contactado';
-- ALTER TABLE public.event_suppliers DROP CONSTRAINT IF EXISTS event_suppliers_evento_proveedor_unico;
-- DROP INDEX IF EXISTS public.suppliers_user_nombre_idx;
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS tags;
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS archived_at;
-- COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-rolodex-A-esquema.sql
git commit -m "chore(sql): cimiento A del rolodex, esquema base"
```

- [ ] **Step 3: Diego lo corre en Supabase**

Pegar completo en el SQL Editor. Va en una transacción.

- [ ] **Step 4: Verificar**

```sql
select column_default from information_schema.columns
where table_name = 'event_suppliers' and column_name = 'status';

select conname from pg_constraint
where conrelid = 'public.event_suppliers'::regclass and contype = 'u';

select column_name from information_schema.columns
where table_name = 'suppliers' and column_name in ('tags','archived_at');
```

Expected: default `'nuevo'::text`; la restricción `event_suppliers_evento_proveedor_unico`; las dos columnas nuevas.

---

## Fase B — las categorías suben al usuario

### Task 2: El vocabulario de categorías, como lógica pura

**Files:**
- Create: `lib/rolodex/categorias.ts`
- Test: `lib/rolodex/categorias.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_CATEGORIES_BY_TYPE` y `resolveTypeKey` de `app/events/[id]/presupuesto/lib/categories.ts`.
- Produces: `CATEGORIAS_BASE`, `resolverVocabulario(guardado)`, `agregarAlVocabulario(vocabulario, nombre)`, `mismaCategoria(a, b)`. Las tareas 4 y 5 consumen estos nombres.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/rolodex/categorias.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  CATEGORIAS_BASE, resolverVocabulario, agregarAlVocabulario, mismaCategoria,
} from './categorias'

describe('resolverVocabulario', () => {
  it('un planner sin vocabulario guardado arranca con las base', () => {
    expect(resolverVocabulario(null)).toEqual(CATEGORIAS_BASE)
    expect(resolverVocabulario([])).toEqual(CATEGORIAS_BASE)
  })

  it('lo que el planner invento se conserva junto a las base', () => {
    const v = resolverVocabulario(['Ambulancia y paramedicos'])
    expect(v).toContain('Ambulancia y paramedicos')
    expect(v).toContain('Venue')
  })

  it('no repite una base que ya venia guardada', () => {
    const v = resolverVocabulario(['Venue', 'Ambulancia y paramedicos'])
    expect(v.filter(c => c === 'Venue')).toHaveLength(1)
  })
})

describe('agregarAlVocabulario', () => {
  it('agrega una categoria nueva al final', () => {
    expect(agregarAlVocabulario(['Venue'], 'Pirotecnia')).toEqual(['Venue', 'Pirotecnia'])
  })

  it('no duplica aunque cambie la caja o sobren espacios', () => {
    expect(agregarAlVocabulario(['Venue'], '  venue ')).toEqual(['Venue'])
  })

  it('ignora un nombre vacio', () => {
    expect(agregarAlVocabulario(['Venue'], '   ')).toEqual(['Venue'])
  })
})

describe('mismaCategoria', () => {
  it('compara sin distinguir caja ni espacios', () => {
    expect(mismaCategoria('Venue', ' venue ')).toBe(true)
    expect(mismaCategoria('Venue', 'Banquete')).toBe(false)
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npm test -- categorias`
Expected: FAIL — `Failed to resolve import "./categorias"`.

- [ ] **Step 3: Escribir el módulo**

Crear `lib/rolodex/categorias.ts`:

```ts
import { DEFAULT_CATEGORIES_BY_TYPE } from '@/app/events/[id]/presupuesto/lib/categories'

// El vocabulario de categorias es del PLANNER, no de la boda. Sirve al Rolodex y
// a todos sus presupuestos: lo que teclea en una boda le queda para siempre.
// Cada evento sigue eligiendo cuales muestra — un corporativo y una boda no
// tienen los mismos cajones — pero el idioma es uno solo.

export const CATEGORIAS_BASE: string[] = [...DEFAULT_CATEGORIES_BY_TYPE.boda]

export function mismaCategoria(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function resolverVocabulario(guardado: string[] | null | undefined): string[] {
  const base = guardado && guardado.length > 0 ? [...guardado] : []
  for (const c of CATEGORIAS_BASE) {
    if (!base.some(x => mismaCategoria(x, c))) base.push(c)
  }
  return base
}

export function agregarAlVocabulario(vocabulario: string[], nombre: string): string[] {
  const limpio = nombre.trim()
  if (!limpio) return vocabulario
  if (vocabulario.some(c => mismaCategoria(c, limpio))) return vocabulario
  return [...vocabulario, limpio]
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npm test -- categorias`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/rolodex/categorias.ts lib/rolodex/categorias.test.ts
git commit -m "feat(rolodex): el vocabulario de categorias del planner"
```

---

### Task 3: El script que crea el vocabulario y lo siembra

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-rolodex-B1-vocabulario.sql`

**Interfaces:**
- Produces: la columna `users.categories JSONB`, sembrada.
- **No quita el `CHECK` todavía.** Eso es la tarea 5, después de desplegar el código.

- [ ] **Step 1: Confirmar que el planner puede escribir su propia fila**

Antes de escribir nada, Diego corre:

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies where tablename = 'users';
```

Expected: al menos una política de `UPDATE` que deje al usuario escribir su fila (`/perfil` ya edita nombre y teléfono, así que debería existir). **Si no existe, parar**: el vocabulario se guardaría y nadie podría leerlo — el mismo fallo mudo de siempre. En ese caso el script tiene que agregar la política y hay que decírselo a Diego antes.

- [ ] **Step 2: Escribir el script**

```sql
-- Rolodex, cimiento B1: el vocabulario de categorias sube al planner.
--
-- Hoy las categorias personalizadas viven en event_settings.budget_categories,
-- que es POR EVENTO. El Rolodex es global del usuario. Los dos ejes no se cruzan:
-- una categoria inventada en una boda no existe en el Rolodex ni en la siguiente
-- boda. Este script crea el eje que faltaba y lo siembra sin perder nada.
--
-- NO quita el CHECK de suppliers.category. Ese es el script B2, y va DESPUES de
-- desplegar el codigo que lee el vocabulario — si se quita antes, el codigo viejo
-- puede escribir una categoria que la base acepta y el tipo de TypeScript rechaza.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb;

-- Siembra: la union de las categorias que cada planner ya usa en sus eventos.
-- Nadie pierde una categoria que ya habia creado. Las base no se siembran aqui:
-- resolverVocabulario() las agrega en el cliente, asi que sembrarlas duplicaria
-- el mantenimiento el dia que cambien.
UPDATE public.users u
SET categories = COALESCE(sub.cats, '[]'::jsonb)
FROM (
  SELECT e.user_id,
         jsonb_agg(DISTINCT cat) AS cats
  FROM public.events e
  JOIN public.event_settings s ON s.event_id = e.id
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(s.budget_categories, '[]'::jsonb)
  ) AS cat
  GROUP BY e.user_id
) sub
WHERE sub.user_id = u.id;

COMMIT;

-- ============ Marcha atras ============
-- BEGIN;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS categories;
-- COMMIT;
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-rolodex-B1-vocabulario.sql
git commit -m "chore(sql): cimiento B1 del rolodex, vocabulario de categorias"
```

- [ ] **Step 4: Diego lo corre y verifica**

```sql
select email, jsonb_array_length(categories) as categorias
from users order by categorias desc nulls last limit 10;
```

Expected: los planners con eventos traen sus categorías; los que nunca tocaron un presupuesto traen `0`, que es correcto — las base se las pone el cliente.

---

### Task 4: El código lee y escribe el vocabulario

**Files:**
- Create: `lib/rolodex/vocabulario-store.ts`
- Test: `lib/rolodex/vocabulario-store.test.ts`
- Modify: `app/events/[id]/presupuesto/page.tsx` — `persistCategories` (~línea 386)

**Interfaces:**
- Consumes: `agregarAlVocabulario` y `resolverVocabulario` de la tarea 2.
- Produces: `categoriasParaGuardar(vocabularioActual, categoriasDelEvento)` — decide qué mandar a `users.categories` cuando un evento guarda su lista.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/rolodex/vocabulario-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { categoriasParaGuardar } from './vocabulario-store'

describe('categoriasParaGuardar', () => {
  it('mete al vocabulario lo que el evento invento', () => {
    const r = categoriasParaGuardar(['Venue'], ['Venue', 'Ambulancia y paramedicos'])
    expect(r).toEqual(['Venue', 'Ambulancia y paramedicos'])
  })

  it('devuelve null cuando el evento no aporta nada nuevo', () => {
    expect(categoriasParaGuardar(['Venue', 'Banquete'], ['Venue'])).toBeNull()
  })

  it('no duplica por caja distinta', () => {
    expect(categoriasParaGuardar(['Venue'], ['venue'])).toBeNull()
  })

  it('nunca quita del vocabulario lo que el evento ya no usa', () => {
    const r = categoriasParaGuardar(['Venue', 'Pirotecnia'], ['Venue', 'Banquete'])
    expect(r).toEqual(['Venue', 'Pirotecnia', 'Banquete'])
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npm test -- vocabulario-store`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Escribir el módulo**

Crear `lib/rolodex/vocabulario-store.ts`:

```ts
import { agregarAlVocabulario } from './categorias'

// Devuelve el vocabulario nuevo, o null si no hay nada que guardar. El null
// existe para no mandar un UPDATE por cada vez que alguien abre el presupuesto.
//
// El vocabulario solo CRECE: que un evento deje de usar una categoria no
// significa que el planner la quiera perder de su Rolodex.
export function categoriasParaGuardar(
  vocabularioActual: string[],
  categoriasDelEvento: string[],
): string[] | null {
  let siguiente = vocabularioActual
  for (const c of categoriasDelEvento) {
    siguiente = agregarAlVocabulario(siguiente, c)
  }
  return siguiente === vocabularioActual ? null : siguiente
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npm test -- vocabulario-store`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Conectar el guardado del presupuesto**

En `app/events/[id]/presupuesto/page.tsx`, `persistCategories` hoy es:

```tsx
  const persistCategories = async (next: string[]) => {
    setStoredCategories(next)
    await supabase.from('event_settings').update({ budget_categories: next }).eq('event_id', eventId)
  }
```

Pasa a escribir también el vocabulario del planner:

```tsx
  const persistCategories = async (next: string[]) => {
    setStoredCategories(next)
    await supabase.from('event_settings').update({ budget_categories: next }).eq('event_id', eventId)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: perfil } = await supabase
      .from('users').select('categories').eq('id', user.id).single()
    const vocabulario = categoriasParaGuardar((perfil?.categories as string[]) ?? [], next)
    if (vocabulario) {
      await supabase.from('users').update({ categories: vocabulario }).eq('id', user.id)
    }
  }
```

y el import junto a los que ya existen:

```tsx
import { categoriasParaGuardar } from '@/lib/rolodex/vocabulario-store'
```

**El vocabulario se guarda en la cuenta de quien teclea.** Es lo correcto hasta que exista el sistema de accesos: cada planner construye el suyo.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit` → sin errores nuevos.
Run: `npm test` → todo verde.

A mano en `localhost:3000`: agregar una categoría en el presupuesto de un evento, y confirmar en Supabase que apareció en `users.categories` de esa cuenta:

```sql
select email, categories from users where email = 'TU_CORREO';
```

- [ ] **Step 7: Commit**

```bash
git add lib/rolodex/vocabulario-store.ts lib/rolodex/vocabulario-store.test.ts "app/events/[id]/presupuesto/page.tsx"
git commit -m "feat(presupuesto): las categorias nuevas entran al vocabulario del planner"
```

---

### Task 5: Se cae el techo

Con el vocabulario sembrado y el código desplegado, se quitan las dos mitades del techo que quedan: el `CHECK` y el tipo.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-rolodex-B2-sin-techo.sql`
- Modify: `lib/types.ts` — `Supplier.category` (línea 545)

**Interfaces:**
- Consumes: el vocabulario de la tarea 3, ya sembrado.
- Produces: `Supplier.category: string`.

- [ ] **Step 1: Escribir el script**

```sql
-- Rolodex, cimiento B2: se cae el techo de las categorias.
--
-- El CHECK de suppliers.category encierra al Rolodex en catorce cajones que
-- eligio Anfiora. Con el vocabulario del planner ya sembrado (script B1) y el
-- codigo desplegado, deja de tener sentido.
--
-- ORDEN: este script va DESPUES de desplegar el codigo de la tarea 4. Al reves,
-- el codigo viejo escribe una categoria que la base acepta y el tipo rechaza.
--
-- event_budgets.category no tiene CHECK que quitar: las partidas ya aceptan
-- categorias libres. Este script solo empareja a suppliers con esa realidad.

BEGIN;

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_category_check;

COMMIT;

-- Confirmar que se fue:
-- select conname from pg_constraint
-- where conrelid = 'public.suppliers'::regclass and contype = 'c';
```

**Nota para quien lo corra:** el nombre `suppliers_category_check` es el que Postgres pone por convención. Si el `select` de arriba muestra otro nombre, usar ese — el `DROP ... IF EXISTS` con el nombre equivocado no falla, simplemente no hace nada, y eso es peor que un error.

- [ ] **Step 2: Ensanchar el tipo**

En `lib/types.ts:545`, dentro de `export type Supplier = {`:

```ts
  category: BudgetCategory
```

pasa a:

```ts
  category: string
```

- [ ] **Step 3: Barrer la compatibilidad**

Run: `npx tsc --noEmit`
Expected: **sin errores.** `categoryLabel()` (en `presupuesto/lib/categories.ts`) ya cae al nombre crudo cuando no reconoce la categoría, así que las pantallas ya saben pintar una inventada.

Si `tsc` marca algo, es un lugar donde se asumía la unión cerrada. Arreglarlo ahí mismo — es exactamente el barrido que la regla de `lib/types.ts` exige antes de tocar un tipo compartido.

Run: `grep -rn "as BudgetCategory" --include=*.tsx app | grep -i supplier`
Cualquier resultado es un casteo que ya no hace falta; quitarlo.

- [ ] **Step 4: Verificar a mano**

En `localhost:3000`: crear una categoría nueva en un presupuesto, y dar de alta un proveedor con esa categoría. Debe guardarse y verse con su nombre en la tarjeta y en el modal de detalle.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-rolodex-B2-sin-techo.sql lib/types.ts
git commit -m "feat(rolodex): las categorias del catalogo dejan de tener techo"
```

- [ ] **Step 6: Diego corre el script**

Después de que el código de las tareas 4 y 5 esté desplegado. El orden importa.

---

---

## Fase B-bis — el vocabulario se asoma

### Task 9: Los menús de categoría muestran el vocabulario del planner

**Por qué existe esta tarea:** no estaba en el plan original y es el hueco que lo hacía inútil. Las tareas 2 a 5 le dan al planner su propio vocabulario y quitan el techo de la base — pero los tres `<select>` de categoría en Proveedores siguen listando las catorce fijas. El resultado es absurdo: la base ya acepta "Ambulancia y paramédicos", el planner ya la tiene en su lista, y al capturar el proveedor la opción no aparece. **Sin esta tarea, toda la fase B no se asoma en ninguna pantalla.**

**Files:**
- Modify: `app/events/[id]/proveedores/page.tsx` — la carga (`loadAll`) y el `<select>` del filtro (~línea 236)
- Modify: `app/events/[id]/proveedores/SupplierModal.tsx` (~línea 115)
- Modify: `app/events/[id]/proveedores/SupplierDetailModal.tsx` (~línea 346)

**Interfaces:**
- Consumes: `resolverVocabulario` de `lib/rolodex/categorias.ts` (tarea 2); `budgetCategoryLabel` de `lib/types.ts`, que ya cae al nombre crudo cuando no reconoce la categoría.
- Produces: un prop `categorias: string[]` que la página pasa a los dos modales.

**De quién es el vocabulario que se lee.** Del usuario de la sesión (`auth.uid()`), no del dueño del evento. Es lo único que la base permite hoy — `users_select_own` es `auth.uid() = id`, así que nadie puede leer la fila de otro — y es coherente con lo que la tarea 4 ya hace al escribir. El día del epic de accesos esto se revisa junto con todo lo demás.

- [ ] **Step 1: Cargar el vocabulario en la página**

En `app/events/[id]/proveedores/page.tsx`, junto a los otros estados:

```tsx
  const [vocabulario, setVocabulario] = useState<string[]>([])
```

y dentro de `loadAll`, después de las cargas que ya existen:

```tsx
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from('users').select('categories').eq('id', user.id).single()
        setVocabulario(resolverVocabulario(perfil?.categories as string[] | null))
      } else {
        setVocabulario(resolverVocabulario(null))
      }
```

con el import:

```tsx
import { resolverVocabulario } from '@/lib/rolodex/categorias'
```

`resolverVocabulario(null)` devuelve las catorce base, así que si la lectura falla la pantalla se comporta exactamente como hoy. Nunca se queda sin opciones.

- [ ] **Step 2: Que el filtro incluya lo que los proveedores ya usan**

Una categoría puede estar guardada en un proveedor sin estar en el vocabulario — por ejemplo una que se sembró antes. Si el filtro no la lista, ese proveedor queda inalcanzable. Junto a los otros derivados de la página:

```tsx
  const categoriasDelFiltro = (() => {
    const lista = [...vocabulario]
    const vistas = new Set(lista.map(c => c.toLowerCase()))
    items.forEach(it => {
      const c = it.supplier?.category
      if (c && !vistas.has(c.toLowerCase())) { lista.push(c); vistas.add(c.toLowerCase()) }
    })
    return lista
  })()
```

y el `<select>` del filtro (~línea 236) pasa de `BUDGET_CATEGORIES` a esa lista:

```tsx
            {categoriasDelFiltro.map(c => <option key={c} value={c}>{budgetCategoryLabel(c)}</option>)}
```

- [ ] **Step 3: Pasar el vocabulario a los dos modales**

`SupplierModal` y `SupplierDetailModal` reciben un prop nuevo:

```tsx
  categorias: string[]
```

y su `<select>` de categoría cambia igual:

```tsx
              {categorias.map(cat => (
                <option key={cat} value={cat}>{budgetCategoryLabel(cat)}</option>
              ))}
```

Desde la página se pasan como `categorias={vocabulario}` en los dos casos.

**En el modal de detalle hay un caso extra:** si el proveedor ya tiene una categoría que no está en el vocabulario, el `<select>` la mostraría vacía y al guardar se la cambiaría sin querer. Antes de pintar las opciones, meterla si falta:

```tsx
  const opciones = categorias.some(c => c.toLowerCase() === (item.supplier.category ?? '').toLowerCase())
    ? categorias
    : [...categorias, item.supplier.category].filter(Boolean) as string[]
```

y usar `opciones` en el `map`.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → sin errores nuevos.
Run: `npm test` → 607, sin cambios (esta tarea no agrega pruebas: es cableado de UI, que en este repo se verifica a mano).

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/proveedores/page.tsx" "app/events/[id]/proveedores/SupplierModal.tsx" "app/events/[id]/proveedores/SupplierDetailModal.tsx"
git commit -m "feat(proveedores): los menus de categoria usan el vocabulario del planner"
```

- [ ] **Step 6: La prueba de punta a punta, que hace Diego**

Con el script B2 ya corrido: inventar una categoría en el presupuesto de una boda, ir a Proveedores de **otra** boda, dar de alta un proveedor y **elegir esa categoría**. Debe guardarse y verse en la tarjeta. Ese es el momento en que toda la fase B sirve para algo.

---

## Fase C — una sola columna para el vínculo

### Task 6: El Presupuesto lee el vínculo desde el proveedor

Hoy la relación se escribe en dos columnas y **ya no coinciden en 6 filas**. `SupplierCard.tsx:40` ya lee la buena (`event_suppliers.event_budget_id`); el módulo del Presupuesto lee y escribe la otra.

**Files:**
- Modify: `app/events/[id]/presupuesto/page.tsx` — el cálculo de `contractedByItem`/`paidByItem` (~línea 150) y el guardado de la liga
- Modify: `app/events/[id]/presupuesto/BudgetCategoryRow.tsx` (~línea 90)
- Modify: `app/events/[id]/presupuesto/BudgetItemRow.tsx`
- Modify: `app/events/[id]/presupuesto/BudgetItemModal.tsx` (~línea 70)

**Interfaces:**
- Consumes: `eventSuppliers`, que la página ya carga con `event_budget_id` incluido.
- Produces: nada para otras tareas.

- [ ] **Step 1: Derivar el índice en la página**

En `app/events/[id]/presupuesto/page.tsx`, junto a los otros derivados, agregar el índice inverso — una partida sabe su proveedor porque el proveedor lo dice:

```tsx
  const eventSupplierByBudgetId: Record<string, EventSupplierWithName> = {}
  eventSuppliers.forEach(es => {
    if (es.event_budget_id) eventSupplierByBudgetId[es.event_budget_id] = es
  })
```

y el cálculo que hoy lee `b.event_supplier_id` pasa a leer ese índice:

```tsx
  const contractedByItem: Record<string, number> = {}
  const paidByItem: Record<string, number>       = {}
  budgets.forEach(b => {
    const supplier = eventSupplierByBudgetId[b.id]
    contractedByItem[b.id] = Number(supplier?.contract_amount || 0)
    paidByItem[b.id]       = supplier ? (paidByEventSupplier[supplier.id] || 0) : 0
  })
```

- [ ] **Step 2: Pasar el índice a las filas**

`BudgetCategoryRow.tsx` (~línea 90) hoy resuelve el proveedor con `item.event_supplier_id`. Pasa a recibir el proveedor ya resuelto desde la página, en vez de buscarlo:

```tsx
  const linked = eventSupplierByBudgetId[item.id] || null
```

Reemplazar el prop `eventSuppliersById` por `eventSupplierByBudgetId` en `BudgetCategoryRow` y en `BudgetItemRow`, y actualizar el punto donde la página los renderiza.

- [ ] **Step 3: Escribir del lado correcto**

Donde hoy se guarda la liga escribiendo `event_budgets.event_supplier_id` (`BudgetItemModal.tsx:70` y el `onUpdateItem` de las filas), la escritura pasa al proveedor:

```tsx
    await supabase.from('event_suppliers')
      .update({ event_budget_id: budgetId })
      .eq('id', eventSupplierId)
```

y desligar es la misma llamada con `event_budget_id: null`.

Quitar `event_supplier_id` de los tipos de `updates` en `BudgetCategoryRow.tsx:26` y `BudgetItemRow.tsx:22`, y del payload de `BudgetItemModal.tsx:26`.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → sin errores nuevos.
Run: `npm test` → todo verde.

A mano, y esto es lo que de verdad importa: en el Presupuesto de un evento, **ligar** una partida a un proveedor, ver que aparece el contratado y el pagado, **abrir Proveedores** y confirmar que la tarjeta muestra la misma partida. Luego **desligar** y confirmar que las dos pantallas se vacían juntas. Antes de este cambio, ese ida y vuelta se desincronizaba.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/presupuesto/page.tsx" "app/events/[id]/presupuesto/BudgetCategoryRow.tsx" "app/events/[id]/presupuesto/BudgetItemRow.tsx" "app/events/[id]/presupuesto/BudgetItemModal.tsx"
git commit -m "refactor(presupuesto): el vinculo con proveedores se lee de un solo lado"
```

---

### Task 7: Reparar las seis y borrar la columna

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-rolodex-C-vinculo.sql`

- [ ] **Step 1: Escribir el script**

```sql
-- Rolodex, cimiento C: una relacion, una columna.
--
-- La liga presupuesto <-> proveedor estaba escrita dos veces y nada obligaba a
-- que coincidieran. Al 4-sep habia 6 filas peleadas: 5 sin apuntador de regreso
-- y 1 conflicto real (boda demo Olivia & Pedro, la partida decia Daniela y la
-- tarjeta decia Avianta). Las seis son datos de demo — no hay planners reales en
-- el sistema — asi que la regla se aplica sin revisar fila por fila.
--
-- Gana event_suppliers.event_budget_id: el proveedor se asigna a una partida.
--
-- ORDEN: este script va DESPUES de desplegar la tarea 6. Antes, el Presupuesto
-- todavia lee la columna que se borra y se queda sin contratado ni pagado.

BEGIN;

-- Rescate: cualquier liga que SOLO existiera del lado de la partida se copia al
-- proveedor antes de borrar, para no perderla. Solo toca proveedores que hoy no
-- tienen partida asignada, asi que nunca pisa la verdad del lado ganador.
UPDATE public.event_suppliers es
SET event_budget_id = b.id
FROM public.event_budgets b
WHERE b.event_supplier_id = es.id
  AND es.event_budget_id IS NULL;

ALTER TABLE public.event_budgets
  DROP COLUMN event_supplier_id;

COMMIT;
```

**Si el `DROP COLUMN` falla** con un error de dependencia, es porque el agente de accesos escribió una política que menciona esa columna. No cancelar el borrado: reescribir esa política primero y volver a correr.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-rolodex-C-vinculo.sql
git commit -m "chore(sql): cimiento C del rolodex, una sola columna para el vinculo"
```

- [ ] **Step 3: Diego lo corre y verifica**

```sql
select count(*) as ligas_vivas from event_suppliers where event_budget_id is not null;

select column_name from information_schema.columns
where table_name = 'event_budgets' and column_name = 'event_supplier_id';
```

Expected: las ligas siguen ahí; la segunda consulta no devuelve nada.

Y a mano: abrir el Presupuesto de la boda de Olivia & Pedro y confirmar que la partida "Wedding planner" ahora dice **Avianta Wedding Agency**, que es el cambio esperado.

---

## Fase D — la bitácora de la ficha global

### Task 8: La ficha global puede registrarse

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-rolodex-D-bitacora.sql`
- Modify: `lib/audit.ts` — la firma de `logAction` (línea 41) y el insert (línea 69)

**Interfaces:**
- Produces: `logAction` acepta `eventId: string | null`.

- [ ] **Step 1: Confirmar con Diego que no hay migración de accesos pendiente sobre `event_audit_log`**

El otro agente puede estar reescribiendo las políticas de esta tabla. **Preguntar antes de correr.** Si hay una migración pendiente, esperar a que aterrice y releer las políticas.

- [ ] **Step 2: Escribir el script**

```sql
-- Rolodex, cimiento D: la ficha global tiene donde registrarse.
--
-- event_audit_log.event_id era NOT NULL, asi que editar la ficha de un proveedor
-- en el catalogo no tenia donde anotarse: las notas de actualizacion solo
-- funcionaban dentro de un evento.
--
-- CUIDADO: las policies de esta tabla filtran por evento. Una fila con event_id
-- nulo necesita su propia regla o se escribe y NADIE la puede leer nunca — el
-- fallo mudo que ya nos mordio dos veces. Por eso la regla va en la MISMA
-- transaccion que la columna.

BEGIN;

ALTER TABLE public.event_audit_log
  ALTER COLUMN event_id DROP NOT NULL;

-- Las filas sin evento son del catalogo del planner: las lee quien las escribio.
DROP POLICY IF EXISTS audit_log_global_select ON public.event_audit_log;
CREATE POLICY audit_log_global_select ON public.event_audit_log
  FOR SELECT TO authenticated
  USING (event_id IS NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS audit_log_global_insert ON public.event_audit_log;
CREATE POLICY audit_log_global_insert ON public.event_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (event_id IS NULL AND user_id = auth.uid());

COMMIT;
```

- [ ] **Step 3: Aflojar la firma en el código**

En `lib/audit.ts`, línea 41:

```ts
  eventId: string
```

pasa a:

```ts
  eventId: string | null
```

El insert de la línea 69 ya manda `event_id: params.eventId` y no necesita cambio.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores. Toda llamada existente sigue mandando un string, que sigue siendo válido.

Run: `npm test` → todo verde.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-rolodex-D-bitacora.sql lib/audit.ts
git commit -m "feat(rolodex): la bitacora acepta acciones sobre la ficha global"
```

- [ ] **Step 6: Diego lo corre**

---

## Cómo se sabe que el cimiento quedó bien

1. `npm test` pasa, con las 11 pruebas nuevas de `lib/rolodex/`.
2. Un planner puede teclear una categoría inventada en el presupuesto de una boda, y esa categoría le aparece al dar de alta un proveedor — en esa boda y en cualquier otra.
3. Ligar y desligar una partida a un proveedor deja las dos pantallas contando lo mismo, siempre. La columna que permitía la contradicción ya no existe.
4. `select * from information_schema.columns where table_name='event_budgets' and column_name='event_supplier_id'` no devuelve nada.
5. Ninguna pantalla cambió de aspecto salvo la partida "Wedding planner" de la boda demo, que ahora dice Avianta.
