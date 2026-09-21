# Rolodex — Cimiento (plan 1 de 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar una sola puerta de permiso para el Rolodex — una función en Postgres, un módulo en TS — y cerrar con ella los dos agujeros vivos: las pantallas de Proveedores y Pagos que hoy se ven vacías para un colaborador, y la ficha de proveedor que se guarda al que teclea en vez de al dueño del evento.

**Architecture:** No se abre acceso a nadie. Las políticas de RLS ya dicen "solo el dueño" y se quedan diciendo lo mismo — lo único que cambia es **dónde** lo dicen: pasan de repetir la condición inline a invocar una función. Del lado del cliente, la misma regla vive en `lib/rolodex/permisos.ts`, que es lógica pura y por lo tanto se prueba con Vitest. Las pantallas no deciden nada: preguntan.

**Tech Stack:** Next.js 16 App Router · TypeScript · Supabase (RLS + funciones SQL) · Vitest · Tailwind v4

**Spec:** `docs/superpowers/specs/2026-09-01-rolodex-proveedores-design.md` (§2 y §10, reescritos el 3-sep-2026)

## Global Constraints

- **Nunca tocar Supabase desde el código.** El SQL de la tarea 5 lo corre Diego a mano en el editor de Supabase. Ningún paso de este plan modifica la base.
- **Código completo, no fragmentos.** Reemplazo de archivo entero cuando el archivo es nuevo; ediciones puntuales y verificables cuando es existente.
- **Sin comentarios** salvo cuando el *por qué* no es obvio.
- **Solo Tailwind** para estilos. Nada de inline styles.
- **UI en español con acentos.** Los mensajes de commit van **sin acentos y sin ñ** (`feat:`, `fix:`, `refactor:`).
- **Botones CTA en teal `#48C9B0`.** Negro `#1D1E20` solo en dropdowns de filtro.
- **Íconos de Lucide React**, nunca SVG a mano.
- **Verificación:** `npm test` para la lógica pura. La UI se verifica a mano en `localhost:3000` — este plan no puede declarar "listo" una pantalla sin que Diego la haya visto.

## Fuera de alcance de este plan (nombrado a propósito)

- **Abrirle Finanzas a los colaboradores.** Al leer las políticas el 4-sep confirmamos que `event_budgets` también es del dueño, y que el hueco es de toda la app, no del Rolodex. Arreglarlo es el epic de accesos por feature.

  Sí entra aquí, por consistencia: **Presupuesto se cierra al dueño** como sus dos hermanas, para que el grupo Finanzas deje de mostrarle al colaborador una pantalla en blanco. Es una ruta más en `RUTAS_SOLO_DUENO` y la misma guardia de la tarea 3 — el nav no necesita ni un cambio, porque le pregunta al módulo.
- **El evento que sobreescribe el catálogo global** (`subcategory` que se pisa al ligar una partida, `proveedores/page.tsx:82` y `SupplierDetailModal.tsx:151`). Es un cambio de comportamiento visible y pertenece al plan del expediente, donde existirá el lugar correcto para editar la ficha.
- **El modelo de despacho** (asientos, admin de workspace, permisos por herramienta). Nota `workspace-dos-capas-asientos`, con sus tres preguntas abiertas.

---

### Task 1: El módulo de permiso (la puerta del lado del cliente)

**Files:**
- Create: `lib/rolodex/permisos.ts`
- Test: `lib/rolodex/permisos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `AccesoRolodex` (`{ esDuenoDelEvento: boolean }`), `RUTAS_SOLO_DUENO`, `puedeVerRolodex(acceso): boolean`, `puedeVerRuta(path, acceso): boolean`, `duenoDeLaFicha(evento): string | null`. Las tareas 2, 3 y 4 consumen exactamente estos nombres.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `lib/rolodex/permisos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  puedeVerRolodex, puedeVerRuta, duenoDeLaFicha, RUTAS_SOLO_DUENO,
} from './permisos'

describe('puedeVerRolodex', () => {
  it('el dueno del evento ve el Rolodex', () => {
    expect(puedeVerRolodex({ esDuenoDelEvento: true })).toBe(true)
  })

  it('nadie mas lo ve: hoy no hay despacho', () => {
    expect(puedeVerRolodex({ esDuenoDelEvento: false })).toBe(false)
  })
})

describe('puedeVerRuta', () => {
  it('proveedores y pagos son solo del dueno', () => {
    for (const ruta of RUTAS_SOLO_DUENO) {
      expect(puedeVerRuta(ruta, { esDuenoDelEvento: true })).toBe(true)
      expect(puedeVerRuta(ruta, { esDuenoDelEvento: false })).toBe(false)
    }
  })

  it('presupuesto queda fuera del candado a proposito', () => {
    expect(puedeVerRuta('/presupuesto', { esDuenoDelEvento: false })).toBe(true)
  })

  it('el resto del nav no lo toca este candado', () => {
    for (const ruta of ['', '/mesas', '/timeline', '/album', '/invitacion']) {
      expect(puedeVerRuta(ruta, { esDuenoDelEvento: false })).toBe(true)
    }
  })
})

describe('duenoDeLaFicha', () => {
  it('la ficha es del dueno del evento, no de quien teclea', () => {
    expect(duenoDeLaFicha({ user_id: 'dueno-abc' })).toBe('dueno-abc')
  })

  it('sin evento cargado no hay dueno: no se captura a ciegas', () => {
    expect(duenoDeLaFicha(null)).toBeNull()
    expect(duenoDeLaFicha(undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `npm test -- permisos`
Expected: FAIL — `Failed to resolve import "./permisos"`.

- [ ] **Step 3: Escribir el módulo**

Crear `lib/rolodex/permisos.ts`:

```ts
// La UNICA puerta del Rolodex del lado del cliente. Su gemela en Postgres es
// public.can_access_catalog / public.can_access_event_finance.
//
// Hoy las dos dicen lo mismo: el Rolodex es del dueno de la cuenta. El dia que
// exista el despacho (asientos, admin de workspace) se cambia AQUI y en esas dos
// funciones de Postgres — no en las pantallas.

export type AccesoRolodex = {
  esDuenoDelEvento: boolean
}

export const RUTAS_SOLO_DUENO: readonly string[] = ['/proveedores', '/pagos']

export function puedeVerRolodex(acceso: AccesoRolodex): boolean {
  return acceso.esDuenoDelEvento
}

export function puedeVerRuta(path: string, acceso: AccesoRolodex): boolean {
  if (!RUTAS_SOLO_DUENO.includes(path)) return true
  return puedeVerRolodex(acceso)
}

// El dueno de una ficha nueva es el dueno del EVENTO, no quien hace clic. null
// significa que el evento aun no carga: sin el, capturar arriesga dejar la ficha
// en el catalogo equivocado, asi que la pantalla debe esperar.
export function duenoDeLaFicha(
  evento: { user_id: string } | null | undefined,
): string | null {
  return evento?.user_id ?? null
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `npm test -- permisos`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/rolodex/permisos.ts lib/rolodex/permisos.test.ts
git commit -m "feat(rolodex): la regla de permiso vive en un solo modulo"
```

---

### Task 2: El candado en el nav

Hoy `adminOnly` solo se evalúa en entradas sueltas (`layout.tsx:319`) y `buildCollapsedItems` recibe `canAdmin` y **nunca lo usa** para los hijos de un grupo. Por eso Proveedores y Pagos aparecen para todos, en las tres presentaciones del nav: sidebar expandido, sidebar colapsado y bottom nav de móvil.

**Files:**
- Modify: `app/events/[id]/layout.tsx` — tipo `NavSubItem` (~línea 27), `buildCollapsedItems` (~línea 255), `visibleEntries` (~línea 317)

**Interfaces:**
- Consumes: `puedeVerRuta`, `AccesoRolodex` de la tarea 1; `isOwner` de `useEventAccess()` (ya existe en `lib/event-access-context.tsx`).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Importar el módulo**

En `app/events/[id]/layout.tsx`, junto al import de features:

```tsx
import { puedeVerRuta, type AccesoRolodex } from '@/lib/rolodex/permisos'
```

- [ ] **Step 2: Filtrar por permiso antes de filtrar por herramientas**

Reemplazar el bloque de `visibleEntries` (~línea 317). Nota que `isOwner` se saca del mismo hook que ya se usa:

```tsx
  const { canAdmin, isOwner, features } = useEventAccess()
```

```tsx
  const acceso = { esDuenoDelEvento: isOwner }

  const visibleEntries = filterNavByFeatures(
    NAV_ITEMS
      .filter(entry =>
        entry.type === 'item'
          ? (!entry.adminOnly || canAdmin) && puedeVerRuta(entry.path, acceso)
          : true,
      )
      .map(entry => {
        if (entry.type === 'item') return entry
        const children = entry.children.filter(child => puedeVerRuta(child.path, acceso))
        if (children.length === 0) return null
        return {
          ...entry,
          children,
          defaultPath: children.some(c => c.path === entry.defaultPath)
            ? entry.defaultPath
            : children[0].path,
        }
      })
      .filter((entry): entry is NavEntry => entry !== null),
    features,
  )
```

- [ ] **Step 3: Arreglar el sidebar colapsado**

`buildCollapsedItems` aplana los grupos en íconos sueltos y hoy deja pasar todos los hijos. Cambiar la firma y el ciclo (~línea 255):

```tsx
function buildCollapsedItems(
  entries: NavEntry[],
  canAdmin: boolean,
  acceso: AccesoRolodex,
) {
```

y dentro, las dos ramas:

```tsx
    if (entry.type === 'item') {
      if (entry.adminOnly && !canAdmin) continue
      if (!puedeVerRuta(entry.path, acceso)) continue
      result.push({
        key: entry.path || '__invitados',
        label: entry.label,
        path: entry.path,
        iconOutline: entry.iconOutline,
        iconFilled: entry.iconFilled,
      })
    } else {
      for (const child of entry.children) {
        if (!puedeVerRuta(child.path, acceso)) continue
        result.push({
          key: child.path,
          label: child.label,
          path: child.path,
          iconOutline: child.iconOutline,
          iconFilled: child.iconFilled,
        })
      }
    }
```

- [ ] **Step 4: Pasar `acceso` en cada llamada a `buildCollapsedItems`**

Buscar todas las llamadas y agregar el tercer argumento:

Run: `grep -n "buildCollapsedItems(" app/events/\[id\]/layout.tsx`

Cada llamada pasa de `buildCollapsedItems(visibleEntries, canAdmin)` a `buildCollapsedItems(visibleEntries, canAdmin, acceso)`.

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/events/[id]/layout.tsx`.

- [ ] **Step 6: Verificar a mano en localhost:3000**

Con la sesión del dueño: Finanzas muestra Presupuesto, Proveedores y Pagos — en sidebar expandido, colapsado y bottom nav de móvil.

Este paso **no puede cerrarse sin la prueba del colaborador**. Si no hay una cuenta colaboradora a la mano, Diego la crea invitando un correo suyo como `editor` desde Configuración. Con esa sesión: Finanzas muestra **solo Presupuesto**, en las tres presentaciones, y el grupo sigue apareciendo (no desaparece, porque Presupuesto se queda).

- [ ] **Step 7: Commit**

```bash
git add app/events/\[id\]/layout.tsx
git commit -m "fix(nav): proveedores y pagos solo los ve el dueno de la cuenta"
```

---

### Task 3: La guardia en las páginas

El nav esconde, pero la URL directa sigue entrando — y hoy entra a una pantalla vacía que miente. Esta tarea pone el aviso honesto.

**Files:**
- Create: `app/components/ui/AccesoRestringido.tsx`
- Modify: `app/events/[id]/proveedores/page.tsx` (bloque de render, después del `loading`)
- Modify: `app/events/[id]/pagos/page.tsx` (mismo lugar)

**Interfaces:**
- Consumes: `useEventAccess()` (`isOwner`, `isLoading`).
- Produces: `<AccesoRestringido titulo={...} />` — un default export usado por las dos páginas.

- [ ] **Step 1: Crear el componente**

Crear `app/components/ui/AccesoRestringido.tsx`:

```tsx
'use client'

import { Lock } from 'lucide-react'

export default function AccesoRestringido({ titulo }: { titulo: string }) {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center overflow-y-auto px-6 py-16">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-alt)]">
          <Lock width={20} height={20} strokeWidth={1.5} className="text-[var(--text-muted)]" />
        </div>
        <h2 className="mb-2 text-base font-medium text-[var(--text)]">{titulo}</h2>
        <p className="text-sm leading-relaxed text-[var(--text-sec)]">
          Esta sección es del dueño de la cuenta. Si necesitas entrar, pídeselo a
          quien creó el evento.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Guardar la página de Proveedores**

En `app/events/[id]/proveedores/page.tsx`, agregar los imports:

```tsx
import { useEventAccess } from '@/lib/event-access-context'
import AccesoRestringido from '@/app/components/ui/AccesoRestringido'
import { puedeVerRolodex } from '@/lib/rolodex/permisos'
```

dentro del componente, junto a los otros hooks:

```tsx
  const { isOwner, isLoading: accesoCargando } = useEventAccess()
```

y en el render, **antes** del `if (loading)` que ya existe:

```tsx
  if (!accesoCargando && !puedeVerRolodex({ esDuenoDelEvento: isOwner })) {
    return <AccesoRestringido titulo="Proveedores" />
  }
```

La guardia **le pregunta al módulo**, no vuelve a decir la regla. Escribir `!isOwner` aquí funcionaría hoy y rompería el día del despacho: el nav abriría la sección al usuario con asiento y la página seguiría cerrándole la puerta.

- [ ] **Step 3: Guardar la página de Pagos**

Mismos tres cambios en `app/events/[id]/pagos/page.tsx`, con el título `"Pagos"`.

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Verificar a mano**

Con la sesión colaboradora, escribir a mano `…/events/<id>/proveedores` y `…/events/<id>/pagos` en la barra del navegador. Debe aparecer el aviso, **no** una tabla vacía. Con la sesión del dueño, las dos páginas funcionan igual que antes.

Revisar que el aviso se vea centrado en móvil: el layout del evento es `overflow-hidden` y no scrollea, por eso el componente trae `flex-1`.

- [ ] **Step 6: Commit**

```bash
git add app/components/ui/AccesoRestringido.tsx app/events/\[id\]/proveedores/page.tsx app/events/\[id\]/pagos/page.tsx
git commit -m "fix(proveedores): decir que la seccion es del dueno en vez de mostrarla vacia"
```

---

### Task 4: La ficha se guarda al dueño del evento

**Files:**
- Modify: `app/events/[id]/proveedores/page.tsx` — `handleCreateSupplier` (~líneas 62-107)

**Interfaces:**
- Consumes: `duenoDeLaFicha` de la tarea 1; el estado `event` que la página ya carga en `loadAll()`.
- Produces: nada.

- [ ] **Step 1: Importar la función**

```tsx
import { duenoDeLaFicha } from '@/lib/rolodex/permisos'
```

- [ ] **Step 2: Cambiar de quién es la ficha**

En `handleCreateSupplier`, reemplazar el bloque que hoy pide el usuario de la sesión:

```tsx
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Sesión expirada'); return }
```

por:

```tsx
    const dueno = duenoDeLaFicha(event)
    if (!dueno) { alert('El evento aún no carga, intenta de nuevo'); return }
```

y en el insert de `suppliers`, la primera línea:

```tsx
        user_id:            dueno,
```

- [ ] **Step 3: Verificar que no quedó `user` huérfano**

Run: `grep -n "user\." app/events/\[id\]/proveedores/page.tsx`
Expected: ninguna referencia a la variable `user` dentro de `handleCreateSupplier`. Si el linter marca un import o variable sin usar, quitarlo.

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificar a mano**

Con la sesión del dueño, dar de alta un proveedor. Debe guardarse y aparecer en la lista igual que antes — hoy el dueño del evento y el de la sesión son la misma persona, así que **el comportamiento visible no cambia**. Lo que cambia es que deja de depender de que coincidan.

- [ ] **Step 5: Commit**

```bash
git add app/events/\[id\]/proveedores/page.tsx
git commit -m "fix(proveedores): la ficha pertenece al dueno del evento, no a quien la teclea"
```

---

### Task 5: La puerta en Postgres

Las políticas actuales dicen la condición inline, doce veces. Esta tarea las hace invocar una función.

**Once de las doce quedan idénticas** — las funciones devuelven exactamente lo que devolvía la condición que reemplazan. La doceava, `event_suppliers_update_own`, gana a propósito una cláusula `WITH CHECK` que hoy no existe: sin ella, el dueño de una ficha puede cambiarle el evento y meter su proveedor en una boda ajena. Es segura de correr porque ningún camino del código reescribe `event_suppliers.event_id` — solo se escribe al dar de alta (`proveedores/page.tsx:103`), y los dos UPDATE que existen tocan el estatus y los montos (`proveedores/page.tsx:130`, `SupplierDetailModal.tsx:167-172`).

El script lo dice en su encabezado, no en letra chica. Y el bloque de marcha atrás sí restaura la política como está hoy, sin la cláusula: revertir significa dejar producción como estaba.

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-03-rolodex-cimiento.sql`

**Interfaces:**
- Consumes: nada del código.
- Produces: `public.can_access_catalog(uuid)` y `public.can_access_event_finance(uuid)` — las gemelas de `lib/rolodex/permisos.ts`.

- [ ] **Step 1: Escribir el script**

Crear `docs/superpowers/plans/sql/2026-09-03-rolodex-cimiento.sql`:

```sql
-- Rolodex, cimiento: una sola puerta para el permiso del catalogo.
--
-- Que cambia: once de las doce policies son identicas a hoy, solo movidas a
-- funciones. UNA excepcion deliberada: event_suppliers_update_own gana un WITH
-- CHECK que hoy no tiene. Sin el, el dueno de una fila puede cambiarle el
-- event_id e inyectar su proveedor en un evento ajeno. Es seguro correr: ningun
-- camino del codigo reescribe event_suppliers.event_id (solo al insertar en
-- proveedores/page.tsx:103; los dos UPDATE tocan status y montos en
-- proveedores/page.tsx:130 y SupplierDetailModal.tsx:167-172). Nota: la misma
-- brecha existe en supplier_payments_update_own y se deja igual a proposito —
-- cerrarla esta fuera del alcance de este plan.
--
-- Por que: el dia que exista el despacho (asientos, admin de workspace) el
-- Rolodex se abre cambiando estas dos funciones, no doce policies.
--
-- Gemelo en el cliente: lib/rolodex/permisos.ts
--
-- Sigue el patron de public.is_event_editor (2026-07-13-rls-holes.sql):
-- SECURITY DEFINER STABLE con search_path fijo.

BEGIN;

-- ============ 1) Las dos puertas ============

-- El catalogo global. Hoy: es mio si soy yo.
CREATE OR REPLACE FUNCTION public.can_access_catalog(p_owner uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT p_owner = auth.uid();
$$;

-- Las finanzas de un evento (proveedores y pagos). Hoy: solo el dueno del evento.
CREATE OR REPLACE FUNCTION public.can_access_event_finance(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid());
$$;

-- ============ 2) suppliers ============

DROP POLICY IF EXISTS suppliers_select_own ON public.suppliers;
CREATE POLICY suppliers_select_own ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.can_access_catalog(user_id));

DROP POLICY IF EXISTS suppliers_insert_own ON public.suppliers;
CREATE POLICY suppliers_insert_own ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_catalog(user_id));

DROP POLICY IF EXISTS suppliers_update_own ON public.suppliers;
CREATE POLICY suppliers_update_own ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.can_access_catalog(user_id))
  WITH CHECK (public.can_access_catalog(user_id));

DROP POLICY IF EXISTS suppliers_delete_own ON public.suppliers;
CREATE POLICY suppliers_delete_own ON public.suppliers
  FOR DELETE TO authenticated
  USING (public.can_access_catalog(user_id));

-- ============ 3) event_suppliers ============

DROP POLICY IF EXISTS event_suppliers_select_own ON public.event_suppliers;
CREATE POLICY event_suppliers_select_own ON public.event_suppliers
  FOR SELECT TO authenticated
  USING (public.can_access_event_finance(event_id));

DROP POLICY IF EXISTS event_suppliers_insert_own ON public.event_suppliers;
CREATE POLICY event_suppliers_insert_own ON public.event_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_event_finance(event_id));

DROP POLICY IF EXISTS event_suppliers_update_own ON public.event_suppliers;
CREATE POLICY event_suppliers_update_own ON public.event_suppliers
  FOR UPDATE TO authenticated
  USING (public.can_access_event_finance(event_id))
  WITH CHECK (public.can_access_event_finance(event_id));

DROP POLICY IF EXISTS event_suppliers_delete_own ON public.event_suppliers;
CREATE POLICY event_suppliers_delete_own ON public.event_suppliers
  FOR DELETE TO authenticated
  USING (public.can_access_event_finance(event_id));

-- ============ 4) supplier_payments ============
-- Cuelga del proveedor, que a su vez cuelga del evento.

DROP POLICY IF EXISTS supplier_payments_select_own ON public.supplier_payments;
CREATE POLICY supplier_payments_select_own ON public.supplier_payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM event_suppliers es
                 WHERE es.id = supplier_payments.event_supplier_id
                   AND public.can_access_event_finance(es.event_id)));

DROP POLICY IF EXISTS supplier_payments_insert_own ON public.supplier_payments;
CREATE POLICY supplier_payments_insert_own ON public.supplier_payments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM event_suppliers es
                      WHERE es.id = supplier_payments.event_supplier_id
                        AND public.can_access_event_finance(es.event_id)));

DROP POLICY IF EXISTS supplier_payments_update_own ON public.supplier_payments;
CREATE POLICY supplier_payments_update_own ON public.supplier_payments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_suppliers es
                 WHERE es.id = supplier_payments.event_supplier_id
                   AND public.can_access_event_finance(es.event_id)));

DROP POLICY IF EXISTS supplier_payments_delete_own ON public.supplier_payments;
CREATE POLICY supplier_payments_delete_own ON public.supplier_payments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM event_suppliers es
                 WHERE es.id = supplier_payments.event_supplier_id
                   AND public.can_access_event_finance(es.event_id)));

COMMIT;

-- ============ Marcha atras ============
-- Si algo deja de cargar, este bloque devuelve las policies a como estaban el
-- 3-sep-2026 (leidas de pg_policies antes de tocar nada). Las dos funciones se
-- pueden quedar: sin policies que las invoquen no hacen nada.
--
-- BEGIN;
-- DROP POLICY IF EXISTS suppliers_select_own ON public.suppliers;
-- CREATE POLICY suppliers_select_own ON public.suppliers
--   FOR SELECT USING (auth.uid() = user_id);
-- DROP POLICY IF EXISTS suppliers_insert_own ON public.suppliers;
-- CREATE POLICY suppliers_insert_own ON public.suppliers
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
-- DROP POLICY IF EXISTS suppliers_update_own ON public.suppliers;
-- CREATE POLICY suppliers_update_own ON public.suppliers
--   FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DROP POLICY IF EXISTS suppliers_delete_own ON public.suppliers;
-- CREATE POLICY suppliers_delete_own ON public.suppliers
--   FOR DELETE USING (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS event_suppliers_select_own ON public.event_suppliers;
-- CREATE POLICY event_suppliers_select_own ON public.event_suppliers
--   FOR SELECT USING (EXISTS (SELECT 1 FROM events
--     WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
-- DROP POLICY IF EXISTS event_suppliers_insert_own ON public.event_suppliers;
-- CREATE POLICY event_suppliers_insert_own ON public.event_suppliers
--   FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM events
--     WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
-- DROP POLICY IF EXISTS event_suppliers_update_own ON public.event_suppliers;
-- CREATE POLICY event_suppliers_update_own ON public.event_suppliers
--   FOR UPDATE USING (EXISTS (SELECT 1 FROM events
--     WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
-- DROP POLICY IF EXISTS event_suppliers_delete_own ON public.event_suppliers;
-- CREATE POLICY event_suppliers_delete_own ON public.event_suppliers
--   FOR DELETE USING (EXISTS (SELECT 1 FROM events
--     WHERE events.id = event_suppliers.event_id AND events.user_id = auth.uid()));
--
-- DROP POLICY IF EXISTS supplier_payments_select_own ON public.supplier_payments;
-- CREATE POLICY supplier_payments_select_own ON public.supplier_payments
--   FOR SELECT USING (EXISTS (SELECT 1 FROM event_suppliers es
--     JOIN events e ON e.id = es.event_id
--     WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- DROP POLICY IF EXISTS supplier_payments_insert_own ON public.supplier_payments;
-- CREATE POLICY supplier_payments_insert_own ON public.supplier_payments
--   FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM event_suppliers es
--     JOIN events e ON e.id = es.event_id
--     WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- DROP POLICY IF EXISTS supplier_payments_update_own ON public.supplier_payments;
-- CREATE POLICY supplier_payments_update_own ON public.supplier_payments
--   FOR UPDATE USING (EXISTS (SELECT 1 FROM event_suppliers es
--     JOIN events e ON e.id = es.event_id
--     WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- DROP POLICY IF EXISTS supplier_payments_delete_own ON public.supplier_payments;
-- CREATE POLICY supplier_payments_delete_own ON public.supplier_payments
--   FOR DELETE USING (EXISTS (SELECT 1 FROM event_suppliers es
--     JOIN events e ON e.id = es.event_id
--     WHERE es.id = supplier_payments.event_supplier_id AND e.user_id = auth.uid()));
-- COMMIT;
```

**El otro cambio real, escondido en lo demás:** las policies de hoy son `TO {public}` y las nuevas son `TO authenticated`. Es más estricto, no menos, y empata con el resto de la base (`is_event_editor` ya usa `authenticated`). Un visitante sin sesión nunca pudo leer estas tablas de todos modos, porque `auth.uid()` es null y la condición nunca se cumplía.

**Lo que este plan NO cierra:** `supplier_payments_update_own` tiene el mismo hueco que `event_suppliers_update_own` (un `USING` sin `WITH CHECK`). Se deja igual a propósito — queda anotado para otro chat.

- [ ] **Step 2: Commit del script antes de correrlo**

```bash
git add docs/superpowers/plans/sql/2026-09-03-rolodex-cimiento.sql
git commit -m "chore(sql): puerta unica de permiso para el rolodex"
```

- [ ] **Step 3: Diego lo corre en Supabase**

Pegar el script completo en el SQL Editor de Supabase y ejecutarlo. Va en una transacción: si algo falla, no queda a medias.

- [ ] **Step 4: Verificar que las políticas quedaron como se espera**

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where tablename in ('suppliers','event_suppliers','supplier_payments')
order by tablename, cmd, policyname;
```

Expected: doce políticas, todas con `roles = {authenticated}`, y ninguna con la condición repetida inline — todas invocan `can_access_catalog` o `can_access_event_finance`.

- [ ] **Step 5: Verificar que nada se rompió**

Con la sesión del dueño, en `localhost:3000` conectado a la misma base: Proveedores lista igual que antes, se puede crear uno, cambiar su estatus y registrar un pago; Pagos lista los pagos del evento. Si algo dejó de cargar, el propio script trae al final el bloque **Marcha atrás** comentado: se descomenta, se corre, y las doce políticas vuelven exactamente a como estaban esta mañana.

---

## Cómo se sabe que el plan quedó bien

Cuando las cinco tareas están hechas, esto debe ser cierto:

1. `npm test` pasa, con las 7 pruebas nuevas de `lib/rolodex/permisos.test.ts`.
2. La frase "el Rolodex es del dueño" se decide **en un solo módulo del repo y en dos funciones de Postgres**, y en ningún otro lado. Se comprueba con `grep -rn "puedeVerRolodex\|puedeVerRuta" app lib`: todo lo que aparece son llamadas al módulo, nunca la regla escrita otra vez.
3. Un colaborador no ve Proveedores ni Pagos en el nav, y si escribe la URL a mano ve un aviso — nunca una pantalla vacía.
4. El dueño no nota **ninguna diferencia**. Este plan no le agrega nada; le quita un bug que todavía no le explotaba.
