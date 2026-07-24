# Categorías de presupuesto editables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las categorías del presupuesto sean por evento (default por tipo) y el usuario pueda agregar/renombrar/eliminar/reordenar, persistiendo en `event_settings.budget_categories`.

**Architecture:** Un resolver deriva la lista efectiva de categorías (guardadas ó default-por-tipo ∪ presentes en datos). La página de presupuesto pinta esa lista (ya no el enum fijo). Un modal gestiona renombrar/eliminar/reordenar; "+ Agregar categoría" es inline. Proveedores intactos.

**Tech Stack:** Next.js 16, React, TS, Tailwind, Supabase, @dnd-kit (ya instalado).

**Verificación:** NO hay tests. Cada tarea se verifica con `npm run lint` + `npm run build` + prueba manual. Commits convencionales, sin acentos en el subject, co-author Claude Opus 4.8. Rama `feature/categorias-editables`. El SQL lo corre Diego.

---

## File Structure
- **Create `app/events/[id]/presupuesto/lib/categories.ts`** — defaults por tipo, `resolveTypeKey`, `getEventCategories`, `categoryLabel`.
- **Modify `lib/types.ts`** — `EventBudget.category: BudgetCategory` → `string` (confirmar con Diego).
- **Create `app/events/[id]/presupuesto/BudgetCategoriesModal.tsx`** — modal gestión (dnd-kit sortable, renombrar, eliminar, agregar).
- **Modify `app/events/[id]/presupuesto/page.tsx`** — cargar/persistir categorías, render dinámico, handlers, toolbar, inline add, merge al generar, `categoryLabel`.
- **Modify `app/events/[id]/presupuesto/BudgetItemModal.tsx`** — select de categoría usa lista dinámica.

---

## Task 1: módulo `categories.ts`

**Files:** Create `app/events/[id]/presupuesto/lib/categories.ts`

- [ ] **Step 1: crear el archivo con este contenido exacto**

```ts
import { BUDGET_CATEGORY_LABELS, EventBudget } from '@/lib/types'

type TypeKey = 'boda' | 'social' | 'corporativo' | 'impacto'

export const DEFAULT_CATEGORIES_BY_TYPE: Record<TypeKey, string[]> = {
  boda:        ['Venue','Banquete','Bebidas','Audio y Video','Imagen','Decoracion','Ceremonia','Entretenimiento','Papeleria','Planeacion','Logistica','Recuerdos','Digital','Otro'],
  social:      ['Venue','Banquete','Bebidas','Audio y Video','Decoracion','Entretenimiento','Imagen','Papeleria','Recuerdos','Logistica','Digital','Otro'],
  corporativo: ['Planeacion','Venue','Banquete','Bebidas','Audio y Video','Decoracion','Papeleria','Entretenimiento','Logistica','Digital','Otro'],
  impacto:     ['Planeacion','Venue','Banquete','Bebidas','Audio y Video','Decoracion','Papeleria','Entretenimiento','Logistica','Digital','Otro'],
}

export function resolveTypeKey(eventType: string | null, eventCategory: string | null): TypeKey {
  if (eventType === 'boda') return 'boda'
  if (eventCategory === 'corporativo') return 'corporativo'
  if (eventCategory === 'impacto') return 'impacto'
  return 'social'
}

export function categoryLabel(name: string): string {
  return (BUDGET_CATEGORY_LABELS as Record<string, string>)[name] ?? name
}

export function getEventCategories(
  stored: string[] | null | undefined,
  eventType: string | null,
  eventCategory: string | null,
  budgets: Pick<EventBudget, 'category'>[],
): string[] {
  const base = (stored && stored.length > 0)
    ? [...stored]
    : [...DEFAULT_CATEGORIES_BY_TYPE[resolveTypeKey(eventType, eventCategory)]]
  const seen = new Set(base.map(c => c.toLowerCase()))
  for (const b of budgets) {
    const c = b.category as string
    if (c && !seen.has(c.toLowerCase())) { base.push(c); seen.add(c.toLowerCase()) }
  }
  return base
}
```

- [ ] **Step 2: lint + build.** `npm run lint && npm run build` → PASS (módulo aislado, no rompe nada aún).
- [ ] **Step 3: commit.** `git add app/events/[id]/presupuesto/lib/categories.ts && git commit -m "feat(presupuesto): resolver de categorias por tipo de evento"`

---

## Task 2: aflojar el tipo `EventBudget.category`

**Files:** Modify `lib/types.ts`

- [ ] **Step 1:** En `lib/types.ts`, en `export type EventBudget = { ... }`, cambiar `category: BudgetCategory` por `category: string`. Dejar `BudgetCategory`, `BUDGET_CATEGORIES`, `BUDGET_CATEGORY_LABELS` y `suppliers`/`EventSupplier` como están.
- [ ] **Step 2: lint + build.** `npm run lint && npm run build`. Si aparecen errores de tipo en `presupuesto/page.tsx` por usar `BUDGET_CATEGORY_LABELS[b.category]` (ahora `string`), se resolverán en Task 3 al cambiar a `categoryLabel(...)`. Si el build truena SOLO por eso, continuar a Task 3 y verificar el build al final de Task 3. (No commitear roto: si build falla, hacer Task 2+3 juntas y commitear al final de Task 3.)
- [ ] **Step 3: commit (si build pasa).** `git add lib/types.ts && git commit -m "refactor(types): event_budgets.category como string para categorias custom"`

---

## Task 3: página de presupuesto dinámica

**Files:** Modify `app/events/[id]/presupuesto/page.tsx`

Contexto de anclas (estado actual):
- Import (línea ~17): `import { buildBudgetItems, BudgetTier } from './lib/templates'`
- `loadAll` trae `event_settings`? NO hoy — hay que agregarlo.
- `availableSuppliersByCategory` (línea ~124-131) y `itemsByCategory` (~155-158) iteran `BUDGET_CATEGORIES`.
- Búsqueda usa `BUDGET_CATEGORY_LABELS[b.category]` (~151).
- Render `BUDGET_CATEGORIES.map(category => ...)` (~504).
- `generateWith` (~354) inserta y hace `loadAll()`.

- [ ] **Step 1: imports.** Agregar:
```ts
import { getEventCategories, categoryLabel } from './lib/categories'
import { BudgetCategoriesModal } from './BudgetCategoriesModal'
```

- [ ] **Step 2: estado.** Junto a los otros `useState`:
```ts
  const [storedCategories, setStoredCategories] = useState<string[] | null>(null)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
```

- [ ] **Step 3: cargar categorías en `loadAll`.** Después de cargar budgets, agregar una consulta a `event_settings`:
```ts
      const { data: settingsRow } = await supabase
        .from('event_settings').select('budget_categories').eq('event_id', eventId).single()
      setStoredCategories((settingsRow?.budget_categories as string[] | null) ?? null)
```
(tolerante: si la columna no existe aún, `settingsRow` puede venir sin ella → null, no truena.)

- [ ] **Step 4: lista efectiva (derivada).** Cerca de `itemsByCategory`:
```ts
  const categories = getEventCategories(storedCategories, event?.event_type ?? null, event?.event_category ?? null, budgets)
```
Reemplazar `const itemsByCategory ... BUDGET_CATEGORIES.forEach(...)` por iterar `categories`:
```ts
  const itemsByCategory: Record<string, EventBudget[]> = {}
  categories.forEach(cat => { itemsByCategory[cat] = [] })
  budgets.forEach(b => { (itemsByCategory[b.category] ||= []).push(b) })
```
Reemplazar `availableSuppliersByCategory` para iterar `categories` (keyed por string):
```ts
  const availableSuppliersByCategory: Record<string, EventSupplierWithName[]> = {}
  categories.forEach(cat => { availableSuppliersByCategory[cat] = [] })
  eventSuppliers.forEach(es => {
    const cat = es.supplier?.category
    if (cat && availableSuppliersByCategory[cat]) availableSuppliersByCategory[cat].push(es)
  })
```
Búsqueda: cambiar `BUDGET_CATEGORY_LABELS[b.category]` por `categoryLabel(b.category)`.

- [ ] **Step 5: persistencia.**
```ts
  const persistCategories = async (next: string[]) => {
    setStoredCategories(next)
    await supabase.from('event_settings').update({ budget_categories: next }).eq('event_id', eventId)
  }
```

- [ ] **Step 6: handlers de categorías.**
```ts
  const addCategory = async (raw: string) => {
    const name = raw.trim()
    if (!name) return
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) return
    await persistCategories([...categories, name])
    setNewCategoryName(''); setAddingCategory(false)
  }

  const renameCategory = async (oldName: string, raw: string) => {
    const name = raw.trim()
    if (!name || name === oldName) return
    await persistCategories(categories.map(c => c === oldName ? name : c))
    await supabase.from('event_budgets').update({ category: name }).eq('event_id', eventId).eq('category', oldName)
    loadAll()
  }

  const deleteCategory = async (name: string) => {
    const count = (itemsByCategory[name] || []).length
    if (count > 0) {
      if (!confirm(`"${categoryLabel(name)}" tiene ${count} concepto(s). Se moveran a "Otro". Continuar?`)) return
      const next = categories.filter(c => c !== name)
      if (!next.includes('Otro')) next.push('Otro')
      await persistCategories(next)
      await supabase.from('event_budgets').update({ category: 'Otro' }).eq('event_id', eventId).eq('category', name)
      loadAll()
    } else {
      await persistCategories(categories.filter(c => c !== name))
    }
  }

  const reorderCategories = (next: string[]) => persistCategories(next)
```

- [ ] **Step 7: merge de categorías al generar.** En `generateWith`, después del insert y antes/junto al `loadAll`, asegurar que las categorías del template estén en la lista guardada:
```ts
    const genCats = Array.from(new Set(rows.map(r => r.category as string)))
    const merged = [...categories]
    genCats.forEach(c => { if (!merged.some(x => x.toLowerCase() === c.toLowerCase())) merged.push(c) })
    if (merged.length !== categories.length) await persistCategories(merged)
```

- [ ] **Step 8: render dinámico.** Cambiar `{BUDGET_CATEGORIES.map(category => {` por `{categories.map(category => {`. La fila `BudgetCategoryRow` recibe `category` (string) — ver Task 5 para su label. Después del `.map`, agregar el inline add:
```tsx
          {addingCategory ? (
            <div className="flex items-center gap-2 px-1 py-2">
              <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory(newCategoryName); if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryName('') } }}
                placeholder="Nombre de la categoría" className="flex-1 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm outline-none focus:border-[#48C9B0]" />
              <button onClick={() => addCategory(newCategoryName)} className="rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3ab89f]">Agregar</button>
              <button onClick={() => { setAddingCategory(false); setNewCategoryName('') }} className="text-xs text-[#888] hover:text-[#1D1E20]">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setAddingCategory(true)} className="flex items-center gap-1.5 px-1 py-2 text-sm text-[#888] hover:text-[#48C9B0]">
              <Plus size={14} /> Agregar categoría
            </button>
          )}
```

- [ ] **Step 9: botón "Categorías" en toolbar.** Junto a los menús Importar/Exportar (antes de "Generar"):
```tsx
          <button onClick={() => setShowCategoriesModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
            <SlidersHorizontal size={14} /><span className="hidden sm:inline">Categorías</span>
          </button>
```
Agregar `SlidersHorizontal` al import de lucide.

- [ ] **Step 10: render del modal.** Cerca del tier modal:
```tsx
      {showCategoriesModal && (
        <BudgetCategoriesModal
          categories={categories}
          itemCountByCategory={Object.fromEntries(categories.map(c => [c, (itemsByCategory[c] || []).length]))}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
          onReorder={reorderCategories}
          onClose={() => setShowCategoriesModal(false)}
        />
      )}
```

- [ ] **Step 11: lint + build.** `npm run lint && npm run build` → PASS. (Aquí ya deben resolverse los errores de tipo de Task 2.)
- [ ] **Step 12: commit.** `git add -A && git commit -m "feat(presupuesto): categorias dinamicas por evento (persistencia, handlers, inline add, toolbar)"`

---

## Task 4: `BudgetCategoriesModal.tsx`

**Files:** Create `app/events/[id]/presupuesto/BudgetCategoriesModal.tsx`

- [ ] **Step 1: crear el componente** (dnd-kit sortable, renombrar inline, eliminar, agregar). Contenido:

```tsx
'use client'

import { useState } from 'react'
import { X, Trash2, Plus, GripVertical, Check } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { categoryLabel } from './lib/categories'

interface Props {
  categories: string[]
  itemCountByCategory: Record<string, number>
  onAdd: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onDelete: (name: string) => void
  onReorder: (next: string[]) => void
  onClose: () => void
}

function Row({ name, count, onRename, onDelete }: { name: string; count: number; onRename: (o: string, n: string) => void; onDelete: (n: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: name })
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-white px-2 py-2">
      <button {...attributes} {...listeners} className="cursor-grab text-[#ccc] hover:text-[#888]"><GripVertical size={15} /></button>
      {editing ? (
        <input autoFocus value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onRename(name, value); setEditing(false) } if (e.key === 'Escape') { setValue(name); setEditing(false) } }}
          className="flex-1 rounded border border-[#e0e0e0] px-2 py-1 text-sm outline-none focus:border-[#48C9B0]" />
      ) : (
        <button onClick={() => { setValue(name); setEditing(true) }} className="flex-1 text-left text-sm text-[#1D1E20] hover:text-[#48C9B0]">{categoryLabel(name)}</button>
      )}
      {count > 0 && <span className="text-[11px] text-[#aaa]">{count}</span>}
      {editing
        ? <button onClick={() => { onRename(name, value); setEditing(false) }} className="text-[#48C9B0]"><Check size={15} /></button>
        : <button onClick={() => onDelete(name)} className="text-[#ccc] hover:text-[#cc3333]"><Trash2 size={14} /></button>}
    </div>
  )
}

export function BudgetCategoriesModal({ categories, itemCountByCategory, onAdd, onRename, onDelete, onReorder, onClose }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (e: any) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldIdx = categories.indexOf(active.id)
      const newIdx = categories.indexOf(over.id)
      onReorder(arrayMove(categories, oldIdx, newIdx))
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
          <h2 className="text-base font-bold text-[#1D1E20]">Categorías</h2>
          <button onClick={onClose} className="text-[#aaa] hover:text-[#555]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={categories} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {categories.map(c => (
                  <Row key={c} name={c} count={itemCountByCategory[c] || 0} onRename={onRename} onDelete={onDelete} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {adding ? (
            <div className="mt-2 flex items-center gap-2">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { onAdd(newName); setNewName(''); setAdding(false) } if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
                placeholder="Nombre de la categoría" className="flex-1 rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]" />
              <button onClick={() => { onAdd(newName); setNewName(''); setAdding(false) }} className="rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white">Agregar</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-sm text-[#888] hover:text-[#48C9B0]">
              <Plus size={14} /> Agregar categoría
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: lint + build.** `npm run lint && npm run build` → PASS.
- [ ] **Step 3: commit.** `git add -A && git commit -m "feat(presupuesto): modal de administrar categorias (reordenar, renombrar, eliminar)"`

---

## Task 5: `BudgetItemModal` y `BudgetCategoryRow` con label dinámico

**Files:** Modify `app/events/[id]/presupuesto/BudgetItemModal.tsx`, `app/events/[id]/presupuesto/BudgetCategoryRow.tsx`

- [ ] **Step 1:** En `BudgetItemModal.tsx`, el `<select>` de categoría debe poblarse con la lista dinámica. Agregar prop `categories: string[]` y mapear `categories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)` (importar `categoryLabel` de `./lib/categories`). En `page.tsx`, pasar `categories={categories}` al `<BudgetItemModal .../>`.
- [ ] **Step 2:** En `BudgetCategoryRow.tsx`, donde muestre el nombre de la categoría con `BUDGET_CATEGORY_LABELS[category]`, cambiar a `categoryLabel(category)` (import de `./lib/categories`). Si recibe `category: BudgetCategory`, ampliar el prop a `string`.
- [ ] **Step 3: lint + build.** `npm run lint && npm run build` → PASS.
- [ ] **Step 4: commit.** `git add -A && git commit -m "feat(presupuesto): label dinamico de categoria en modal de concepto y fila"`

---

## Task 6: SQL + verificación end-to-end

**Pre-requisito (lo corre Diego en Supabase):**
```sql
alter table event_settings add column if not exists budget_categories jsonb;
```

- [ ] **Step 1:** Confirmar con Diego que el SQL corrió. No avanzar sin confirmación. El agente nunca toca Supabase.
- [ ] **Step 2 (manual):** Evento **corporativo** → presupuesto: NO aparece Ceremonia/Imagen; aparecen las corporativas. Evento **boda** → sí aparecen.
- [ ] **Step 3 (manual):** Agregar categoría (inline y desde modal), renombrar, reordenar (drag), eliminar vacía y eliminar con conceptos (verifica que se mueven a "Otro"). Recargar → persiste.
- [ ] **Step 4 (manual):** Generar presupuesto (boda nivel) → las categorías del template aparecen en la lista. Agregar concepto → el select muestra la lista dinámica.
- [ ] **Step 5 (manual):** Proveedores: la vinculación por ID sigue; categorías custom sin auto-sugerencia (no truena). Export PDF/Excel sigue bien con `categoryLabel`.
- [ ] **Step 6:** `npm run lint && npm run build` → PASS. Reportar a Diego para push.

---

## Self-Review (cobertura del spec)
- Resolver default-por-tipo + datos → Task 1. ✓
- Tipo `category: string` → Task 2. ✓
- Render dinámico, persistencia, handlers (add/rename/delete→Otro/reorder), inline add, toolbar, merge al generar → Task 3. ✓
- Modal gestión dnd-kit → Task 4. ✓
- Label dinámico en modal de concepto + fila → Task 5. ✓
- SQL + proveedores intactos + verificación → Task 6. ✓
- Sin acentos en commits; UI con acentos. ✓
