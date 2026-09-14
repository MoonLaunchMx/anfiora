# Categorías por ID — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que una categoría sea una fila con identidad, no un texto copiado dentro de cada proveedor y cada partida. Renombrar pasa de cuatro escrituras que pueden fallar a la mitad, a una sola que no puede.

**Architecture:** Nace la tabla `categories`, una por planner. `suppliers` y `event_budgets` la apuntan por `category_id`. El texto viejo se conserva durante toda la migración y solo se borra al final, cuando ya nada lo lee — así cada paso se puede verificar en producción sin apagar nada.

**Tech Stack:** Next.js 16 · TypeScript · Supabase · Vitest · Tailwind v4

**Por qué una tabla nueva, contra la regla de CLAUDE.md:** la regla existe para frenar tablas que no ganan nada. Ésta gana lo único que el modelo de texto no puede dar: identidad. Sin ella, renombrar es una cascada de cuatro peticiones separadas que se puede quedar a medias y dejar proveedores diciendo un nombre y partidas diciendo otro.

## Global Constraints

- **Nunca tocar Supabase desde el código.** Los scripts los corre Diego, uno por paso.
- **Un paso a la vez.** No se empieza el siguiente hasta que Diego verificó el anterior.
- **Sin comentarios** salvo cuando el *por qué* no es obvio. Los comentarios en SQL sí son obligatorios, **sin acentos ni ñ**.
- **UI en español CON acentos.** Commits **sin acentos y sin ñ**, terminando con:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011vu4WefwRrd9zBMXD7QTZb
```

- **Nunca `git add -A`.** Otro agente trabaja en este repo.
- **No correr `npm run lint`.** Los guardianes son `npx tsc --noEmit` y `npm test`.

---

### Task 1: La tabla de categorías

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-categorias-tabla.sql`

**Qué hace:** crea `categories` y la siembra con todo lo que hoy existe disperso — el vocabulario del planner, las categorías que sus proveedores ya usan, y las que usan sus partidas. Nadie pierde nada y nada deja de funcionar: ninguna columna vieja se toca.

- [ ] **Step 1: Escribir el script**

```sql
-- Categorias por ID, paso 1: la tabla.
--
-- Hoy la categoria es un TEXTO copiado dentro de cada proveedor y cada partida.
-- Por eso renombrar exige cuatro escrituras separadas que pueden fallar a la
-- mitad y dejar proveedores diciendo un nombre y partidas diciendo otro.
--
-- Esta tabla le da identidad. Nada la usa todavia: este script no toca ninguna
-- columna existente, asi que la app sigue funcionando igual despues de correrlo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Dos categorias con el mismo nombre en el mismo planner no tienen sentido: es
-- justo el desorden que esto viene a arreglar. El indice compara sin distinguir
-- mayusculas, igual que mismaCategoria() en el cliente.
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_unico
  ON public.categories (user_id, lower(name));

CREATE INDEX IF NOT EXISTS categories_user_idx
  ON public.categories (user_id) WHERE archived_at IS NULL;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select_own ON public.categories;
CREATE POLICY categories_select_own ON public.categories
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS categories_insert_own ON public.categories;
CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS categories_update_own ON public.categories;
CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS categories_delete_own ON public.categories;
CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ Siembra ============
-- Tres fuentes, en una sola union: el vocabulario del planner, lo que sus
-- proveedores ya usan, y lo que usan las partidas de sus eventos. DISTINCT ON
-- con lower(name) se queda con una sola grafia cuando hay varias — la primera
-- por orden alfabetico, que es arbitrario pero estable. Las repetidas de verdad
-- las junta el planner despues, desde la pantalla.

-- El select va envuelto en una subconsulta porque ON CONFLICT no puede ir
-- despues del ORDER BY que exige DISTINCT ON. Sin esa envoltura, Postgres
-- rechaza el statement con un 42601 (verificado en produccion el 4-sep).

INSERT INTO public.categories (user_id, name)
SELECT user_id, nombre
FROM (
  SELECT DISTINCT ON (user_id, lower(nombre)) user_id, nombre
  FROM (
    SELECT u.id AS user_id, cat AS nombre
    FROM public.users u
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.categories, '[]'::jsonb)) AS cat

    UNION ALL

    SELECT s.user_id, s.category
    FROM public.suppliers s
    WHERE s.category IS NOT NULL AND s.category <> ''

    UNION ALL

    SELECT e.user_id, b.category
    FROM public.event_budgets b
    JOIN public.events e ON e.id = b.event_id
    WHERE b.category IS NOT NULL AND b.category <> ''
  ) fuentes
  WHERE nombre IS NOT NULL AND btrim(nombre) <> ''
  ORDER BY user_id, lower(nombre), nombre
) dedup
ON CONFLICT DO NOTHING;

COMMIT;

-- ============ Marcha atras ============
-- Segura: nada apunta a esta tabla todavia.
-- BEGIN;
-- DROP TABLE IF EXISTS public.categories;
-- COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-categorias-tabla.sql
git commit -m "chore(sql): tabla de categorias por planner"
```

- [ ] **Step 3: Diego lo corre y verifica**

```sql
select u.email, count(c.id) as categorias
from users u left join categories c on c.user_id = u.id
group by u.email order by categorias desc limit 10;

select user_id, lower(name), count(*)
from categories group by 1,2 having count(*) > 1;
```

Esperado: cada planner con sus categorías; la segunda consulta **sin filas** — el índice único lo garantiza, y si devolviera algo sería un error del script.

---

### Task 2: Colgar proveedores y partidas de la tabla

**Estado del paso 1:** corrido en producción el 4-sep. Sembró 15 categorías para Diego y entre 4 y 9 para sus otros planners; las cuentas sin eventos quedaron en 0, que es correcto.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-04-categorias-fk.sql`

**Qué hace:** agrega `category_id` a `suppliers` y a `event_budgets`, lo llena comparando por nombre sin distinguir mayúsculas ni acentos, y **deja el texto intacto**. Después de correrlo la app sigue leyendo el texto y funcionando igual — el ID queda listo pero todavía sin usar.

- [ ] **Step 1: Escribir el script**

```sql
-- Categorias por ID, paso 2: colgar proveedores y partidas de la tabla.
--
-- Agrega category_id y lo llena. NO borra ni modifica las columnas de texto:
-- despues de este script la app sigue leyendo el texto y se comporta igual.
-- El ID queda puesto pero todavia sin usar, que es lo que hace este paso seguro.
--
-- ON DELETE RESTRICT es a proposito: Postgres impide borrar una categoria que
-- algun proveedor o alguna partida este usando. Es la misma regla que la
-- pantalla va a mostrar ("Eliminar solo si nadie la usa"), pero puesta donde no
-- se puede saltar.

BEGIN;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE public.event_budgets
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

-- ============ Relleno ============
-- El emparejamiento normaliza acentos igual que normalizarCategoria() en el
-- cliente, para que "Decoracion" y "Decoracion-con-acento" caigan en la misma
-- fila. Sin esa normalizacion, una partida con acento se quedaria sin ID.

UPDATE public.suppliers s
SET category_id = c.id
FROM public.categories c
WHERE c.user_id = s.user_id
  AND unaccent_lower(c.name) = unaccent_lower(s.category)
  AND s.category_id IS NULL
  AND s.category IS NOT NULL;

UPDATE public.event_budgets b
SET category_id = c.id
FROM public.events e, public.categories c
WHERE e.id = b.event_id
  AND c.user_id = e.user_id
  AND unaccent_lower(c.name) = unaccent_lower(b.category)
  AND b.category_id IS NULL
  AND b.category IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_category_id_idx ON public.suppliers (category_id);
CREATE INDEX IF NOT EXISTS event_budgets_category_id_idx ON public.event_budgets (category_id);

COMMIT;

-- ============ Marcha atras ============
-- Segura: nada lee category_id todavia.
-- BEGIN;
-- ALTER TABLE public.suppliers DROP COLUMN IF EXISTS category_id;
-- ALTER TABLE public.event_budgets DROP COLUMN IF EXISTS category_id;
-- COMMIT;
```

**Falta una pieza:** `unaccent_lower` no existe. Antes del `BEGIN;` hay que crearla, porque la extensión `unaccent` de Postgres puede no estar disponible en el proyecto:

```sql
-- Normaliza igual que normalizarCategoria() en el cliente: quita acentos,
-- recorta y baja a minusculas. Se escribe a mano en vez de usar la extension
-- unaccent porque no siempre esta instalada y esto solo corre una vez.
CREATE OR REPLACE FUNCTION public.unaccent_lower(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(translate(
    t,
    'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
    'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'
  )));
$$;
```

Esa función se crea **antes** del `BEGIN;` del bloque principal y se queda: el paso 4 la va a necesitar para juntar categorías.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-04-categorias-fk.sql
git commit -m "chore(sql): colgar proveedores y partidas de la tabla de categorias"
```

- [ ] **Step 3: Diego lo corre y verifica**

```sql
select 'proveedores sin id' as que, count(*) as filas
from suppliers where category is not null and btrim(category) <> '' and category_id is null
union all
select 'partidas sin id', count(*)
from event_budgets where category is not null and btrim(category) <> '' and category_id is null;
```

Esperado: **cero en las dos**. Si alguna trae filas, son categorías que no encontraron su fila y hay que verlas antes de seguir — no se avanza al paso 3.

---

### Task 3: El módulo compartido y Proveedores conectado

**Estado:** los pasos 1 y 2 corrieron en producción el 4-sep. Cada proveedor y cada partida ya tiene su `category_id`; ninguno se quedó sin emparejar.

**Meta de este paso:** que Proveedores lea las categorías de la tabla y escriba el ID. **La pantalla no debe cambiar de aspecto.** Si algo se ve distinto, algo se rompió.

**Files:**
- Create: `lib/rolodex/categorias-store.ts`
- Test: `lib/rolodex/categorias-store.test.ts`
- Modify: `app/events/[id]/proveedores/page.tsx`
- Modify: `app/events/[id]/proveedores/SupplierModal.tsx`
- Modify: `app/events/[id]/proveedores/SupplierDetailModal.tsx`
- Modify: `lib/types.ts` — agregar `category_id` a `Supplier`

**Interfaces:**
- Consumes: `mismaCategoria` de `lib/rolodex/categorias.ts`.
- Produces: `Categoria`, `activas(cats)`, `buscarPorNombre(cats, nombre)`, `nombrePorId(cats, id)`, y la carga `cargarCategorias(userId)`.

**Doble escritura, a propósito.** Al guardar un proveedor se escribe `category_id` **y** el texto `category` como hasta ahora. Así el código se puede revertir sin dejar datos inservibles, y el paso que borra el texto queda independiente de éste.

- [ ] **Step 1: La prueba que falla**

Crear `lib/rolodex/categorias-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { activas, buscarPorNombre, nombrePorId, type Categoria } from './categorias-store'

const cats: Categoria[] = [
  { id: 'a', name: 'Venue', archived_at: null },
  { id: 'b', name: 'Decoración', archived_at: null },
  { id: 'c', name: 'Pirotecnia', archived_at: '2026-09-01T00:00:00Z' },
]

describe('activas', () => {
  it('deja fuera las ocultas', () => {
    expect(activas(cats).map(c => c.id)).toEqual(['a', 'b'])
  })
})

describe('buscarPorNombre', () => {
  it('encuentra sin distinguir caja ni acentos', () => {
    expect(buscarPorNombre(cats, 'decoracion')?.id).toBe('b')
    expect(buscarPorNombre(cats, '  VENUE ')?.id).toBe('a')
  })

  it('devuelve null cuando no existe', () => {
    expect(buscarPorNombre(cats, 'Mariachi')).toBeNull()
  })

  it('tambien encuentra una oculta: existe aunque no se ofrezca', () => {
    expect(buscarPorNombre(cats, 'Pirotecnia')?.id).toBe('c')
  })
})

describe('nombrePorId', () => {
  it('devuelve el nombre de la categoria', () => {
    expect(nombrePorId(cats, 'b')).toBe('Decoración')
  })

  it('devuelve cadena vacia si no hay id o no se encuentra', () => {
    expect(nombrePorId(cats, null)).toBe('')
    expect(nombrePorId(cats, 'zzz')).toBe('')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- categorias-store`

- [ ] **Step 3: El módulo**

Crear `lib/rolodex/categorias-store.ts`:

```ts
import { supabase } from '@/lib/supabase'
import { mismaCategoria } from './categorias'

export type Categoria = {
  id: string
  name: string
  archived_at: string | null
}

export function activas(cats: Categoria[]): Categoria[] {
  return cats.filter(c => c.archived_at === null)
}

// Busca entre TODAS, incluidas las ocultas: una categoria oculta sigue
// existiendo, solo deja de ofrecerse. Buscarla y no encontrarla llevaria a
// crear una duplicada.
export function buscarPorNombre(cats: Categoria[], nombre: string): Categoria | null {
  return cats.find(c => mismaCategoria(c.name, nombre)) ?? null
}

export function nombrePorId(cats: Categoria[], id: string | null | undefined): string {
  if (!id) return ''
  return cats.find(c => c.id === id)?.name ?? ''
}

export async function cargarCategorias(userId: string): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, archived_at')
    .eq('user_id', userId)
    .order('name')
  if (error) {
    console.error('Error cargando categorias:', error.message)
    return []
  }
  return (data ?? []) as Categoria[]
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- categorias-store` → 6 pruebas.

- [ ] **Step 5: El tipo**

En `lib/types.ts`, dentro de `export type Supplier = {`, agregar junto a `category`:

```ts
  category_id: string | null
```

`category` se queda: durante esta migración se escriben las dos.

- [ ] **Step 6: Conectar Proveedores**

En `app/events/[id]/proveedores/page.tsx`:

1. Estado `const [categorias, setCategorias] = useState<Categoria[]>([])`.
2. En `loadAll`, después de resolver el usuario, `setCategorias(await cargarCategorias(user.id))`. **Quitar** la lectura de `users.categories` y `resolverVocabulario` que se agregó antes — la tabla la reemplaza.
3. El `<select>` del filtro y los dos modales pasan a listar `activas(categorias)`, con `value={c.id}` y el nombre como texto.
4. El filtro compara contra `item.supplier.category_id` en vez del texto.
5. Al guardar, se escriben **las dos**: `category_id: elegido.id` y `category: elegido.name`.

**Dos casos que no se pueden romper:**

- **Un proveedor con una categoría oculta** debe seguir mostrándola y conservarla al guardar. El `<select>` lista `activas`, así que hay que inyectar la del proveedor si falta — la misma guarda que ya existe hoy, ahora comparando por id.
- **El filtro debe incluir las categorías que los proveedores traen** aunque estén ocultas, o esos proveedores quedan inalcanzables.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit` y `npm test`.

A mano, en `localhost:3001`, la prueba de este paso es que **nada cambie**: Proveedores se ve igual, el filtro filtra igual, y al editar un proveedor su categoría sale seleccionada. Además, en Supabase:

```sql
select name, category, category_id from suppliers order by created_at desc limit 5;
```

Un proveedor guardado hoy debe traer **las dos columnas llenas y coherentes**.

- [ ] **Step 8: Commit**

```bash
git add lib/rolodex/categorias-store.ts lib/rolodex/categorias-store.test.ts lib/types.ts "app/events/[id]/proveedores/page.tsx" "app/events/[id]/proveedores/SupplierModal.tsx" "app/events/[id]/proveedores/SupplierDetailModal.tsx"
git commit -m "feat(proveedores): las categorias se leen de la tabla, por id"
```

---

### Task 4: Presupuesto conectado

**Estado:** pasos 1, 2 y 3 corridos y verificados en producción. Proveedores ya lee de la tabla y Diego confirmó que la pantalla no cambió de aspecto.

**Meta:** que Presupuesto lea las categorías de la tabla y escriba `category_id` en cada partida. **La pantalla no debe cambiar de aspecto.**

**Files:**
- Modify: `app/events/[id]/presupuesto/page.tsx`
- Modify: `app/events/[id]/presupuesto/BudgetCategoryRow.tsx`
- Modify: `app/events/[id]/presupuesto/BudgetItemModal.tsx`
- Modify: `app/events/[id]/proveedores/SupplierDetailModal.tsx` — **borrar la guarda de forma de UUID**
- Modify: `lib/types.ts` — agregar `category_id` a `EventBudget`

**Lo que NO cambia en este paso:**

- `event_settings.budget_categories` sigue siendo una lista de **nombres**. Se resuelve contra la tabla al cargar. Convertirla a ids es del paso 6.
- **El renombrar de categorías del Presupuesto se queda como está**, por evento y sobre el texto. Cambiarlo a global ahora dejaría a Presupuesto y Proveedores mostrando nombres distintos hasta que exista la pantalla de Ajustes. El paso 5 le da ese trabajo a Ajustes y se lo quita a Presupuesto.
- La doble escritura sigue: cada partida guarda `category_id` **y** el texto `category`.

- [ ] **Step 1: La guarda de UUID muere aquí**

`SupplierDetailModal.tsx` trae una comprobación que mira si una cadena *parece* un UUID para decidir si la escribe en `category_id`. Existía solo porque Presupuesto le pasaba nombres en vez de ids. En cuanto Presupuesto pase ids de verdad, **la guarda se borra** — no se deja "por si acaso". Funcionaba por accidente: las categorías de Presupuesto no parecían UUID, y eso es incidental, no una garantía.

Borrarla y confirmar que `tsc` sigue limpio.

- [ ] **Step 2: Cargar las categorías en Presupuesto**

En `presupuesto/page.tsx`:

1. Estado `const [categorias, setCategorias] = useState<Categoria[]>([])`.
2. En `loadAll`, `setCategorias(await cargarCategorias(user.id))`.
3. **Quitar** la lectura de `users.categories` y `resolverVocabulario` de esta pantalla — la tabla la reemplaza. `persistCategories` deja de escribir en `users.categories`.
4. `<SupplierDetailModal>` pasa a recibir `activas(categorias)`, igual que en Proveedores.

- [ ] **Step 3: Las partidas guardan el id**

`BudgetItemModal` y el alta rápida escriben `category_id` además del texto. La agrupación de filas por categoría pasa a agrupar por `category_id`, cayendo al texto solo para partidas viejas que no lo tuvieran — no debería haber ninguna, pero la caída evita que una partida desaparezca de la pantalla si la hubiera.

`getEventCategories` sigue devolviendo nombres para decidir **qué categorías muestra este evento**; lo que cambia es que cada nombre se resuelve a su fila para obtener el id al guardar.

- [ ] **Step 4: Crear una categoría desde el Presupuesto**

`addCategory` hoy solo agrega el nombre a la lista del evento. Ahora, además, **crea la fila en `categories`** si no existe, para que la categoría nueva exista de verdad y Proveedores la ofrezca.

Se hace con `buscarPorNombre` sobre las cargadas y, si no está, un insert. Si el insert falla por el índice único —dos pestañas creando la misma a la vez— se vuelve a leer y se usa la que ganó, sin mostrar error.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` y `npm test` — **616, sin cambios.**

A mano, en `localhost:3001`, otra vez la prueba es que **nada cambie**: el Presupuesto se ve igual, las partidas siguen agrupadas igual, se puede crear una partida y agregar una categoría. Y en Supabase:

```sql
select subcategory, category, category_id from event_budgets order by created_at desc limit 5;
```

Una partida creada hoy debe traer las dos columnas llenas y coherentes.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts "app/events/[id]/presupuesto/page.tsx" "app/events/[id]/presupuesto/BudgetCategoryRow.tsx" "app/events/[id]/presupuesto/BudgetItemModal.tsx" "app/events/[id]/proveedores/SupplierDetailModal.tsx"
git commit -m "feat(presupuesto): las categorias se leen de la tabla, por id"
```

---

### Task 5: La pantalla de categorías, en solo lectura

**Estado:** pasos 1 a 4 corridos y verificados. Proveedores y Presupuesto ya leen de la tabla y ninguna de las dos cambió de aspecto.

**Meta:** que el planner vea sus categorías juntas, con cuánto pesa cada una, y que la app le señale las que se parecen. **Sin ninguna acción todavía** — primero se ve, después se toca.

**Diseño aprobado:** https://claude.ai/code/artifact/77179d23-63f1-4cc5-83af-39cfd37db5f6

**Dónde vive:** `/ajustes/categorias`, con un enlace desde `/perfil`. No va dentro de una boda: las categorías son de la cuenta, no del evento.

**Files:**
- Create: `lib/rolodex/vocabulario-admin.ts`
- Test: `lib/rolodex/vocabulario-admin.test.ts`
- Create: `app/ajustes/layout.tsx` — cáscara mínima
- Create: `app/ajustes/categorias/page.tsx`
- Modify: `app/perfil/page.tsx` — un enlace

**Interfaces:**
- Consumes: `mismaCategoria` y `normalizarCategoria` de `lib/rolodex/categorias.ts`; `Categoria`, `activas`, `cargarCategorias` de `lib/rolodex/categorias-store.ts`.
- Produces: `Uso`, `CategoriaConUso`, `parecidas(nombres)`, `puedeEliminarse(uso)`.

**Un cambio previo de una línea:** `normalizar` en `lib/rolodex/categorias.ts` es privada. Este módulo necesita exactamente la misma normalización y tener dos copias garantiza que un día se separen. Renombrarla a `normalizarCategoria` y exportarla, dejando `mismaCategoria` usándola igual.

- [ ] **Step 1: La prueba que falla**

Crear `lib/rolodex/vocabulario-admin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parecidas, puedeEliminarse } from './vocabulario-admin'

describe('parecidas', () => {
  it('encuentra un plural', () => {
    expect(parecidas(['Decoracion', 'Decoraciones'])).toEqual([['Decoracion', 'Decoraciones']])
  })

  it('encuentra cuando una empieza igual que la otra', () => {
    expect(parecidas(['Audio', 'Audio y Video'])).toEqual([['Audio', 'Audio y Video']])
  })

  it('no inventa parecidos entre categorias distintas', () => {
    expect(parecidas(['Venue', 'Banquete', 'Pirotecnia'])).toEqual([])
  })

  it('no reporta el mismo par dos veces', () => {
    expect(parecidas(['Flores', 'Flor'])).toHaveLength(1)
  })

  it('ignora acentos al comparar', () => {
    expect(parecidas(['Decoración', 'Decoracion'])).toHaveLength(1)
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

- [ ] **Step 3: El módulo**

Crear `lib/rolodex/vocabulario-admin.ts`:

```ts
import { normalizarCategoria } from './categorias'

export type Uso = { proveedores: number; partidas: number }

export type CategoriaConUso = {
  id: string
  nombre: string
  uso: Uso
  oculta: boolean
}

// Distancia de edicion acotada: pasando de 3 ya no nos interesa, y salir
// temprano evita comparar cien categorias entre si sin necesidad.
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = guardado
    }
  }
  return prev[b.length]
}

// La comparacion sin acentos ya impide CREAR una casi igual, asi que esto sirve
// para las que ya existian y para lo que esa comparacion no atrapa: plurales,
// una letra de mas, o una que empieza igual que otra.
export function parecidas(nombres: string[]): [string, string][] {
  const pares: [string, string][] = []
  for (let i = 0; i < nombres.length; i++) {
    for (let j = i + 1; j < nombres.length; j++) {
      const a = normalizarCategoria(nombres[i])
      const b = normalizarCategoria(nombres[j])
      if (!a || !b) continue
      if (a.startsWith(b) || b.startsWith(a) || distancia(a, b) <= 2) {
        pares.push([nombres[i], nombres[j]])
      }
    }
  }
  return pares
}

export function puedeEliminarse(uso: Uso): boolean {
  return uso.proveedores === 0 && uso.partidas === 0
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- vocabulario-admin` → 6 pruebas. Suite total: **622**.

- [ ] **Step 5: La cáscara y la pantalla**

`app/ajustes/layout.tsx`: cáscara mínima con fondo, ancho máximo y un encabezado. Copia el patrón de espaciado de `app/perfil/page.tsx` para que se sienta de la misma app.

`app/ajustes/categorias/page.tsx`, `'use client'`:

1. `supabase.auth.getUser()`; sin sesión, a la landing.
2. `cargarCategorias(user.id)`.
3. Cuentas: `suppliers.select('category_id').eq('user_id', user.id)` y, para partidas, los eventos del usuario y luego `event_budgets.select('category_id').in('event_id', ids)`. Se cuentan en el cliente por `category_id`.
4. Arma `CategoriaConUso[]`, activas primero y ocultas al final.

**La lista.** Cada fila: el nombre; a la derecha «7 proveedores · 9 partidas», o «Nadie la usa» cuando las dos cuentas son cero; y un botón de menú (`MoreHorizontal` de Lucide) que en esta tarea **no hace nada todavía**. Las ocultas van en gris con una etiqueta «Oculta».

**El aviso.** Arriba, si `parecidas()` sobre los nombres activos devuelve algo: una tarjeta ámbar con el par, el texto «Puede que sean la misma escrita distinto» y un botón «Revisar» inerte. Si no devuelve nada, la tarjeta no se renderiza.

Estilos con Tailwind y los tokens de `globals.css`. Nada de negro salvo texto.

- [ ] **Step 6: El enlace desde Perfil**

En `app/perfil/page.tsx`, una entrada que lleve a `/ajustes/categorias`, con el mismo aspecto que las secciones que ya tiene. Texto: «Mis categorías».

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit` y `npm test` → 622.

A mano: `localhost:3001/ajustes/categorias` muestra tus categorías con cuentas que cuadran con lo que hay en tus bodas.

- [ ] **Step 8: Commit**

```bash
git add lib/rolodex/vocabulario-admin.ts lib/rolodex/vocabulario-admin.test.ts lib/rolodex/categorias.ts app/ajustes/layout.tsx app/ajustes/categorias/page.tsx app/perfil/page.tsx
git commit -m "feat(ajustes): pantalla de categorias, solo lectura"
```

---

### Task 6: Cambiar nombre y ocultar

**Estado:** pasos 1 a 5 corridos y verificados. La pantalla `/ajustes/categorias` ya muestra la lista, las cuentas y el aviso de parecidas, con los botones inertes.

**Meta:** las dos acciones reversibles. Juntar y eliminar son el paso 7, con su propia revisión, porque no se pueden deshacer.

**Files:**
- Create: `lib/rolodex/aplicar-cambios.ts`
- Create: `app/ajustes/categorias/AccionesCategoria.tsx`
- Modify: `app/ajustes/categorias/page.tsx` — conectar el menú
- Modify: `app/events/[id]/presupuesto/page.tsx` — quitar el renombrar por evento

**Interfaces:**
- Consumes: `Categoria` y `mismaCategoria`; `CategoriaConUso` de `vocabulario-admin`.
- Produces: `renombrar(...)`, `ocultar(...)`, `reactivar(...)`, cada una devolviendo `{ ok: boolean; error?: string }`.

#### Renombrar todavía es una cascada, y hay que decirlo

Mientras el texto viejo siga vivo —hasta el paso 8— renombrar toca cuatro lugares:

1. `categories.name`
2. `suppliers.category` de ese planner, donde `category_id` sea esa categoría
3. `event_budgets.category` de los eventos de ese planner, igual
4. Las listas `event_settings.budget_categories` de esos eventos que contengan el nombre viejo

**El orden importa.** Primero los datos, al final `categories.name`. Si algo truena a la mitad, es mejor que los proveedores ya digan el nombre nuevo y la tabla todavía el viejo —se reintenta y termina— que al revés, con la tabla prometiendo un nombre que ningún dato tiene.

La promesa de "una sola escritura" llega en el paso 8, no antes.

#### El renombrar del Presupuesto se va

`presupuesto/page.tsx` tiene `renameCategory`, que renombra **por evento** sobre el texto. Con las categorías siendo de la cuenta eso ya no significa nada, y es lo que obligó al agrupado defensivo del paso 4.

Se quita del modal de categorías del presupuesto. En su lugar, una línea: «Para cambiar el nombre de una categoría, ve a Ajustes › Categorías». Agregar y reordenar categorías del evento **se quedan** — eso sí es del evento.

- [ ] **Step 1: El módulo de escrituras**

`lib/rolodex/aplicar-cambios.ts` concentra todo lo que toca la base, para que la pantalla no tenga ni un `supabase.from(...)`.

```ts
export type Resultado = { ok: boolean; error?: string }

export async function renombrar(userId: string, categoriaId: string, nombreViejo: string, nombreNuevo: string): Promise<Resultado>
export async function ocultar(categoriaId: string): Promise<Resultado>
export async function reactivar(categoriaId: string): Promise<Resultado>
```

`renombrar` hace las cuatro escrituras en el orden de arriba y corta devolviendo el error en cuanto una falla. Las listas de `event_settings` se leen, se reemplaza el nombre viejo por el nuevo comparando con `mismaCategoria`, y se vuelven a escribir solo las que cambiaron.

`ocultar` y `reactivar` escriben `archived_at` y nada más: ni proveedores ni partidas se tocan. Eso es lo que las hace reversibles.

- [ ] **Step 2: El menú y los dos modales**

`AccionesCategoria.tsx`, con `Modal` de `@/app/components/ui/Modal`. Las palabras son exactamente las del diseño aprobado:

- **Cambiar nombre** — un campo con el nombre actual y, debajo, la consecuencia: «Se va a actualizar en N proveedores y N partidas de presupuesto, en todas tus bodas». Si ya existe otra categoría con ese nombre —comparando con `mismaCategoria`— el botón se deshabilita y aparece «Ya tienes una categoría que se llama así. Júntalas en vez de renombrar». Si nadie la usa, la consecuencia dice «Nadie la usa todavía».
- **Ya no la uso** — «Deja de aparecer cuando captures proveedores o partidas. Tus N proveedores que ya la tienen no cambian, y su historial se conserva.» En una categoría ya oculta, la opción dice **«Volver a usarla»**.

En el menú, «Juntar con otra…» y «Eliminar» aparecen **deshabilitadas** con su texto de ayuda, para que el planner vea que existen y que llegan en el siguiente paso. No se ocultan: una opción que aparece y desaparece confunde más que una apagada.

Botón principal en teal `#48C9B0`.

- [ ] **Step 3: Refrescar sin recargar**

Tras una acción exitosa, la pantalla vuelve a cargar sus datos. No se manipula el arreglo en memoria: las cuentas dependen de tablas que acaban de cambiar y recalcularlas a mano es cómo se desincroniza una pantalla.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` y `npm test` — **622, sin cambios**; esta tarea no agrega pruebas, es cableado de UI y escrituras con I/O, que en este repo se verifican a mano.

- [ ] **Step 5: La prueba de Diego**

En `localhost:3001/ajustes/categorias`:
1. Cambiar el nombre de una categoría que sí se usa → abrir el Presupuesto de una boda y Proveedores, y confirmar que **las dos** dicen el nombre nuevo.
2. Intentar renombrar una con el nombre de otra que ya existe → el botón no deja, y explica por qué.
3. Ocultar una → deja de salir al capturar un proveedor, pero el proveedor que ya la tenía la sigue mostrando, y en la lista aparece en gris al final.
4. Volver a usarla → regresa a los menús.
5. En el Presupuesto, el modal de categorías ya **no** ofrece renombrar, y manda a Ajustes.

- [ ] **Step 6: Commit**

```bash
git add lib/rolodex/aplicar-cambios.ts app/ajustes/categorias/AccionesCategoria.tsx app/ajustes/categorias/page.tsx "app/events/[id]/presupuesto/page.tsx"
git commit -m "feat(ajustes): cambiar nombre y ocultar categorias"
```

---

### Task 7: Juntar y eliminar

**Estado:** pasos 1 a 6 hechos. La pantalla ya lista, cuenta, avisa de parecidas, renombra **en línea** y archiva.

**Meta:** las dos acciones que no se pueden deshacer. Por eso tienen su propio paso y su propia revisión.

**Files:**
- Modify: `lib/rolodex/aplicar-cambios.ts` — `juntar` y `eliminar`
- Modify: `app/ajustes/categorias/AccionesCategoria.tsx` — los dos modales, y quitar el «Disponible en el siguiente paso»
- Modify: `app/ajustes/categorias/page.tsx` — el botón «Revisar» del aviso de parecidas

#### Por qué éstas sí llevan modal

Renombrar se deshace renombrando de vuelta. **Juntar no.** Cuando los proveedores de la categoría que sobra pasan a la que se queda, no queda registro de dónde estaban: deshacerlo requeriría acordarse uno por uno. Eliminar tampoco. La ceremonia se gasta aquí, que es donde vale.

- [ ] **Step 1: `juntar` en el módulo de escrituras**

```ts
export async function juntar(userId: string, sobraId: string, quedaId: string, nombreQueda: string): Promise<Resultado>
```

Mismo principio que renombrar — **los datos primero, la tabla al final** — porque una falla a media escritura debe dejar los datos ya movidos y la categoría vieja todavía existiendo, nunca al revés:

1. `suppliers`: `category_id` de `sobraId` a `quedaId`, y `category` al nombre de la que se queda
2. `event_budgets` de los eventos del planner: lo mismo
3. Las listas `event_settings.budget_categories` de esos eventos: quitar el nombre de la que sobra; si la que se queda no está, ponerla en su lugar; si ya está, solo quitar la otra, **sin dejar duplicados**
4. `delete` de la fila `sobraId`

El borrado va al final y **puede fallar legítimamente**: `ON DELETE RESTRICT` lo impide si algo todavía la apunta. Si eso pasa, es que un paso anterior no movió todo, y el error tiene que decirlo con esas palabras, no con el mensaje crudo de Postgres.

**`juntar` rechaza juntar una categoría consigo misma** — compara con `mismaCategoria` y devuelve error antes de escribir nada.

- [ ] **Step 2: `eliminar` en el módulo**

```ts
export async function eliminar(categoriaId: string): Promise<Resultado>
```

Un `delete`. **Vuelve a verificar el uso antes de escribir** aunque la pantalla ya no ofrezca el botón cuando hay uso: entre que la pantalla cargó y el planner hizo clic, alguien pudo asignarle un proveedor desde otra pestaña. Si `ON DELETE RESTRICT` la rechaza, el mensaje explica que alguien la está usando y sugiere juntarla.

- [ ] **Step 3: El modal de juntar**

Se abre **desde la que sobra** — así el planner piensa «ésta sobra, mándala a aquélla», que es el orden natural. Textos del diseño aprobado:

- Título: «Juntar "Nombre" con otra»
- «¿Cuál se queda?» y un select con las demás categorías activas del planner, sin la actual
- La consecuencia con números reales: «N proveedores pasan de X a Y. La categoría X desaparece de tus menús.»
- En rojo: «Esto no se puede deshacer.»
- Botón principal «Juntar» en teal `#48C9B0`

Si la que sobra no tiene ni proveedores ni partidas, la consecuencia lo dice: «X no la usa nadie; solo desaparecerá de tus menús.»

- [ ] **Step 4: El modal de eliminar**

Solo se ofrece habilitado cuando `puedeEliminarse` es verdadero. Título «Eliminar "Nombre"», la línea «Nadie la usa: 0 proveedores, 0 partidas. Se puede quitar sin consecuencias.», botón **rojo**.

Cuando sí se usa, la opción del menú se queda **deshabilitada** con el texto «La están usando N proveedores» — no un error después del clic. El callejón sin salida se evita antes, no se explica después.

- [ ] **Step 5: El botón «Revisar» del aviso**

Hoy es inerte. Ahora abre el modal de juntar con ese par ya cargado: la segunda del par como la que sobra, la primera como la que se queda. Es el camino corto que hace útil al detector — si encontrar el duplicado no lleva a resolverlo en un clic, el aviso es solo un regaño.

- [ ] **Step 6: Quitar el texto provisional**

«Disponible en el siguiente paso» desaparece de las dos opciones. Es este paso.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit` y `npm test` — **622, sin cambios.**

- [ ] **Step 8: La prueba de Diego**

En `localhost:3001/ajustes/categorias`, con datos de demo:
1. **Juntar dos categorías** que ambas tengan proveedores → los de la que sobra aparecen ahora bajo la que se queda, en Proveedores y en Presupuesto, y la que sobraba ya no está en ningún menú.
2. **Usar el botón «Revisar»** del aviso de parecidas → abre el modal ya con el par.
3. **Eliminar una que nadie usa** → desaparece.
4. **Intentar eliminar una que sí se usa** → la opción está apagada y dice cuántos la usan.

- [ ] **Step 9: Commit**

```bash
git add lib/rolodex/aplicar-cambios.ts app/ajustes/categorias/AccionesCategoria.tsx app/ajustes/categorias/page.tsx
git commit -m "feat(ajustes): juntar y eliminar categorias"
```

---

### Task 8: Quitar el texto viejo

**Estado:** pasos 1 a 7 hechos y verificados por Diego en el navegador. La pantalla renombra, archiva, restaura, fusiona y elimina.

**Meta:** que la categoría deje de estar copiada como texto dentro de cada proveedor y cada partida. Es el paso que hace verdad todo lo anterior.

**Este es el único paso sin marcha atrás gratis.** Al borrar las columnas se pierde el texto que hoy sirve de red: mientras existiera, se podía revertir el código y la app seguía funcionando con los nombres. Después, no. Por eso va al final y solo después de que Diego probó las cuatro acciones.

**Files:**
- Modify: `app/events/[id]/proveedores/page.tsx`
- Modify: `app/events/[id]/proveedores/SupplierDetailModal.tsx`
- Modify: `app/events/[id]/presupuesto/page.tsx`
- Modify: `lib/types.ts`
- Create: `docs/superpowers/plans/sql/2026-09-04-categorias-quitar-texto.sql`

#### El orden se invierte

En todos los pasos anteriores el SQL podía ir primero. **Aquí no.** Si las columnas desaparecen mientras el código desplegado todavía las escribe, cada alta de proveedor y cada partida nueva truena con "column does not exist".

Primero se despliega el código que ya no las toca. Después se borran.

#### Lo que NO se borra

`event_settings.budget_categories` **se queda**. No es el dato: es *qué categorías muestra esta boda*, que sigue siendo una decisión por evento. Convertir esa lista de nombres a ids es un trabajo aparte, con su propio riesgo, y no hace falta para cerrar esto.

Consecuencia honesta: renombrar seguirá siendo **dos** escrituras —`categories.name` y esas listas— en vez de una. Bajó de cuatro a dos. La promesa de "una sola escritura" llega cuando esa lista también sea de ids.

- [ ] **Step 1: Dejar de escribir el texto**

Quitar `category: ...` de los tres lugares que todavía lo escriben:
- `proveedores/page.tsx`, en el insert de `handleCreateSupplier`
- `SupplierDetailModal.tsx`, en `buildUpdatedItem` y en el `update` de `suppliers`
- `presupuesto/page.tsx`, donde se crean o actualizan partidas

`category_id` se queda como el único. **`subcategory` no se toca** — es otra columna y otro concepto.

- [ ] **Step 2: Simplificar el agrupado del presupuesto**

El agrupado de partidas por categoría trae una caída al texto, puesta en el paso 4 porque el renombrar por evento dejaba el `category_id` apuntando al nombre viejo. **Ese renombrar ya no existe** — se fue en el paso 6 — y el texto está a punto de desaparecer, así que la caída ya no puede dispararse ni tendría de dónde leer.

Quitarla y agrupar solo por `category_id`. Si una partida no tuviera id, ahora simplemente no aparece — y eso está bien, porque la migración verificó que no existe ninguna así.

- [ ] **Step 3: Los tipos**

En `lib/types.ts`, quitar `category` de `Supplier` y de `EventBudget`. `category_id` se queda. `tsc` va a señalar cada lugar que todavía lo lea: ésos son el verdadero alcance de esta tarea, y hay que resolverlos, no castearlos.

- [ ] **Step 4: Verificar el código antes de tocar la base**

Run: `npx tsc --noEmit` → **sin errores.** Cualquiera que quede es un lector del texto que no vimos.
Run: `npm test` → 622.

A mano, con el código nuevo corriendo y **las columnas todavía en la base**: dar de alta un proveedor, crear una partida, renombrar una categoría, fusionar dos. Todo debe funcionar sin que nadie escriba el texto. Ésta es la última oportunidad de descubrir un lector escondido con la red todavía puesta.

- [ ] **Step 5: El script**

```sql
-- Categorias por ID, paso final: se quita el texto.
--
-- Hasta hoy cada proveedor y cada partida cargaban el NOMBRE de su categoria
-- copiado, ademas del id. Esa copia era la red de seguridad de la migracion:
-- mientras existiera se podia revertir el codigo y la app seguia funcionando.
--
-- ESTE SCRIPT QUITA ESA RED. No hay marcha atras util: volver a crear las
-- columnas es trivial, pero volver a llenarlas no — el nombre de cada fila se
-- deduciria de categories, que es justo lo que este paso vuelve la unica verdad.
--
-- ORDEN: va DESPUES de desplegar el codigo que ya no escribe el texto. Al reves,
-- cada alta de proveedor y cada partida nueva truenan con "column does not exist".
--
-- event_settings.budget_categories NO se toca: esa lista es que categorias
-- MUESTRA cada boda, no el dato. Convertirla a ids es otro trabajo.

BEGIN;

ALTER TABLE public.suppliers      DROP COLUMN IF EXISTS category;
ALTER TABLE public.event_budgets  DROP COLUMN IF EXISTS category;

-- El vocabulario viejo del planner. Ya no lo lee nadie: lo reemplazo la tabla
-- categories en el paso 1 (verificado, cero referencias en el codigo).
ALTER TABLE public.users          DROP COLUMN IF EXISTS categories;

COMMIT;

-- ============ Verificacion ============
-- select column_name from information_schema.columns
-- where (table_name = 'suppliers' and column_name = 'category')
--    or (table_name = 'event_budgets' and column_name = 'category')
--    or (table_name = 'users' and column_name = 'categories');
-- Esperado: cero filas.
```

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts "app/events/[id]/proveedores/page.tsx" "app/events/[id]/proveedores/SupplierDetailModal.tsx" "app/events/[id]/presupuesto/page.tsx" docs/superpowers/plans/sql/2026-09-04-categorias-quitar-texto.sql
git commit -m "feat(rolodex): la categoria deja de guardarse como texto"
```

- [ ] **Step 7: Diego despliega y luego corre el script**

En ese orden. Y después, la última prueba: dar de alta un proveedor y una partida, y confirmar que siguen apareciendo con su categoría — que ahora sale de un solo lugar.

---

---

### Task 9: Crear una categoría desde Ajustes

**Estado:** la migración a ID está completa y corrida en producción. La pantalla `/ajustes/categorias` lista, renombra en línea, archiva, restaura, fusiona y elimina — **pero no puede crear.** Hoy la única forma de crear una categoría es el modal del Presupuesto de una boda.

**Meta:** que la pantalla que se llama "Mis categorías" pueda crear una, y que la creación viva en un solo lugar del código.

**Files:**
- Modify: `lib/rolodex/categorias-store.ts` — recibe la creación
- Modify: `app/events/[id]/presupuesto/page.tsx` — deja de tener la suya
- Modify: `app/ajustes/categorias/page.tsx` — el alta

#### Primero: la creación se muda

`crearCategoriaSiNoExiste` vive hoy dentro de `presupuesto/page.tsx` (línea ~416), con su manejo de la carrera de dos pestañas. Es correcta, pero está en el lugar equivocado: la tarea 10 la va a necesitar desde Proveedores, y tres copias de "crear una categoría" es exactamente el desorden que este trabajo vino a quitar.

Se muda a `lib/rolodex/categorias-store.ts`:

```ts
export async function crearCategoria(
  userId: string,
  nombre: string,
  yaCargadas: Categoria[],
): Promise<{ categoria?: Categoria; error?: string }>
```

Comportamiento, igual al de hoy más un valor de regreso útil:

- Si ya existe una con ese nombre en `yaCargadas` —comparando con `mismaCategoria`, que ignora caja y acentos— **la devuelve** en vez de crear otra. No es un error: el planner pidió una categoría con ese nombre y ya la tiene.
- Si no existe, la inserta y devuelve la fila nueva.
- Si el insert falla con `23505` (el índice único; dos pestañas creando la misma a la vez), **vuelve a leer y devuelve la que ganó**, sin mostrar error. Ese es el caso que ya resolvía bien y no hay que perder.
- Cualquier otro error se devuelve como texto en español, para que la pantalla lo muestre.

El nombre se guarda **tal como lo tecleó el planner**, con sus acentos. La comparación normaliza; el guardado no.

`presupuesto/page.tsx` borra su copia y llama a ésta. Su `addCategory` sigue haciendo lo mismo que hoy: crear la categoría y agregarla a la lista del evento.

#### Después: el alta en Ajustes

En `app/ajustes/categorias/page.tsx`, un botón **«Nueva categoría»** en el encabezado, junto al conteo. Al darle, aparece un campo en la parte de arriba de la lista —no un modal: crear es reversible y ya decidimos que la ceremonia es solo para lo irreversible.

- `Enter` crea, `Escape` cancela, igual que el renombrar en línea que ya existe en esta pantalla. Copia esa interacción, no inventes una variante.
- Si el nombre ya existe, no crea: lo dice ahí mismo — «Ya tienes una categoría que se llama así» — y **resalta la fila existente** para que el planner la vea. Es el mismo aviso suave del spec: nunca bloquear a ciegas, siempre enseñar lo que ya hay.
- Nombre vacío: cancela en silencio.
- Al crear, la pantalla se recarga y la nueva aparece en su lugar alfabético.

- [ ] **Step 1: Mudar la creación**

Escribir `crearCategoria` en `lib/rolodex/categorias-store.ts` con el comportamiento de arriba, y hacer que `presupuesto/page.tsx` la use, borrando su copia local.

Verificar que el Presupuesto sigue creando categorías igual que antes — es la única pantalla que hoy lo hace y no puede perder esa función en la mudanza.

- [ ] **Step 2: El alta en Ajustes**

El botón, el campo y el aviso de nombre repetido.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` y `npm test` — **622, sin cambios.**

A mano, en `localhost:3001`:
1. En Ajustes, crear una categoría nueva → aparece en la lista, en orden alfabético.
2. Intentar crear una que ya existe → no crea, lo dice, y señala la que ya tienes.
3. En el Presupuesto de una boda, agregar una categoría → sigue funcionando igual que antes.
4. La categoría creada en Ajustes aparece al dar de alta un proveedor.

- [ ] **Step 4: Commit**

```bash
git add lib/rolodex/categorias-store.ts "app/events/[id]/presupuesto/page.tsx" app/ajustes/categorias/page.tsx
git commit -m "feat(ajustes): crear categorias desde la pantalla de categorias"
```

---

### Task 10: Buscar es crear, en el alta de proveedor

**Estado:** la migración a ID está completa. Ajustes ya crea categorías. Falta el lugar donde el planner de verdad las necesita: capturando un proveedor.

**El problema, en las palabras de Diego:** *«si no existe la categoría, ¿cómo agrego esa nueva?»* Hoy el campo es una lista cerrada. Si la categoría no está, hay que salirse a otra pantalla, crearla, y volver.

**La forma ya estaba decidida** en el §7 del spec del 1-sep: **el campo de crear ES el campo de buscar.** Escribes, ves lo que ya tienes que se parece, y la última opción siempre es *Crear «lo que escribiste»*. Así se resuelve el alta y el anti-duplicado con un solo control: nadie crea "Fotografia" teniendo "Fotografía", porque la ve mientras teclea.

**Files:**
- Create: `app/events/[id]/proveedores/CategoriaPicker.tsx`
- Modify: `app/events/[id]/proveedores/SupplierModal.tsx`
- Modify: `app/events/[id]/proveedores/SupplierDetailModal.tsx`
- Modify: `app/ajustes/categorias/page.tsx` — el tono del hover (ver abajo)

#### Un solo componente, usado por los dos modales

El mismo selector de categoría vive hoy en el modal de alta **y** en el de detalle. Construir el campo nuevo en uno solo dejaría dos formas de escoger categoría en la misma pantalla — el mismo error de tener dos vocabularios que ya cometimos hoy. Va como **un componente compartido**, `CategoriaPicker`, y los dos lo usan.

```tsx
type Props = {
  categorias: Categoria[]        // todas, para poder mostrar la propia aunque este archivada
  valorId: string | null
  onChange: (categoria: Categoria) => void
  userId: string
}
```

#### Comportamiento

- **Cerrado** se ve como el `<select>` de hoy: el nombre de la categoría elegida. No debe sentirse un control nuevo y raro en medio de un formulario que ya conoce.
- **Al abrirlo**, la lista de las activas. Al teclear, filtra por coincidencia usando `normalizarCategoria` — así "decoracion" encuentra "Decoración".
- **La última opción, siempre que lo tecleado no coincida exactamente con una existente:** «Crear "Ambulancia y paramédicos"». Al elegirla, llama a `crearCategoria` de `lib/rolodex/categorias-store.ts` y deja la nueva seleccionada.
- **Si lo tecleado coincide con una que existe**, esa aparece arriba y la opción de crear **no** se ofrece — no hay nada que crear.
- **La categoría propia del proveedor se muestra aunque esté archivada**, igual que hoy: si no, el campo saldría vacío y al guardar le cambiaría la categoría sin querer. Marcada como archivada, para que el planner sepa por qué no está en la lista general.
- **Teclado:** flechas para moverse, `Enter` para elegir lo resaltado, `Escape` para cerrar sin cambiar nada. Es un campo de formulario; navegarlo sin ratón no es un extra.
- Si `crearCategoria` falla, se muestra el error **dentro del control** y no se cambia la selección. Nunca se cierra en silencio dejando al planner sin saber si se guardó.

#### Lo que no cambia

El resto de los dos modales se queda igual: mismos campos, mismo orden, mismos botones. Solo cambia el control de categoría.

- [ ] **Step 1: El componente**

`CategoriaPicker.tsx` con el comportamiento de arriba. Tailwind y tokens de `globals.css`; el resaltado de la opción activa con el mismo gris que usa el resto de la app en listas, nunca negro — el negro está reservado para los filtros de tabla.

- [ ] **Step 2: Los dos modales lo usan**

Reemplazar el `<select>` de categoría en `SupplierModal` y en `SupplierDetailModal`. Cada uno ya tiene su `categorias` y su `userId` a la mano o los recibe; si alguno no tiene `userId`, pasárselo desde la página en vez de leerlo dentro del componente.

- [ ] **Step 3: El tono del hover**

En `app/ajustes/categorias/page.tsx`, el botón de nueva categoría usa `hover:bg-[#3db39c]`. Todo el resto de la app —incluido `AccionesCategoria.tsx`, en la misma carpeta— usa `hover:bg-[#3aa896]`. Emparejarlo.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` y `npm test` — **622, sin cambios.**

A mano, en `localhost:3001`:
1. Alta de proveedor → abrir categoría → teclear algo que no existe → **Crear** → se guarda con esa categoría nueva.
2. Teclear "decoracion" sin acento → aparece "Decoración" y **no** ofrece crear.
3. Abrir el detalle de un proveedor cuya categoría esté archivada → la muestra, marcada, y al guardar la conserva.
4. Moverse con flechas y elegir con Enter, sin tocar el ratón.
5. La categoría creada aquí aparece en Ajustes › Categorías.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/proveedores/CategoriaPicker.tsx" "app/events/[id]/proveedores/SupplierModal.tsx" "app/events/[id]/proveedores/SupplierDetailModal.tsx" app/ajustes/categorias/page.tsx
git commit -m "feat(proveedores): buscar es crear en el campo de categoria"
```
