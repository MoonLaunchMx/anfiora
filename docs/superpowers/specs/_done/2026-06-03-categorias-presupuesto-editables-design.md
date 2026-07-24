# Categorías de presupuesto editables por evento

**Fecha:** 2026-06-03
**Estado:** Diseño aprobado
**Rama:** `feature/categorias-editables`

## Objetivo

Que las categorías del presupuesto **dejen de ser un enum fijo boda-céntrico** y sean
**por evento**: cada evento arranca con un set apropiado a su tipo y el usuario puede
**agregar / renombrar / eliminar / reordenar** las suyas. Un evento corporativo nunca debe
ver "Ceremonia".

## Decisiones de UX (aprobadas)

Híbrido por frecuencia de uso:
- **Agregar categoría → inline**: botón "+ Agregar categoría" al final de la lista de
  categorías; despliega un input chico; al confirmar, se agrega (vacía) y se persiste.
- **Renombrar / eliminar / reordenar → modal "Categorías"** (botón en la toolbar): lista
  ordenable (drag con `@dnd-kit`), cada fila con renombrar (input) y eliminar (trash).
- **Eliminar con conceptos**: no destructivo. Si la categoría tiene conceptos, se confirma
  y esos conceptos se **mueven a "Otro"** (asegurando que "Otro" exista en la lista). Si
  está vacía, se quita directo. "Eliminar" = quitarla de **este** evento (no es global).
- **Renombrar**: actualiza el nombre en la lista y en los `event_budgets` de esa categoría
  (la categoría se guarda por nombre). Renombrar una categoría default la vuelve custom
  (deja de tener auto-match de proveedor) — esperado.

## Datos

### Storage (lo corre Diego en Supabase)
```sql
alter table event_settings add column if not exists budget_categories jsonb;
```
`event_settings.budget_categories` = arreglo JSONB **ordenado de nombres** (strings).
Ej: `["Venue","Banquete","Audio y Video","Decoración","Otro"]`.

### Tipo a confirmar (toca lib/types.ts)
`EventBudget.category` pasa de `BudgetCategory` a `string` (para aceptar nombres custom).
`BudgetCategory`/`BUDGET_CATEGORIES`/`BUDGET_CATEGORY_LABELS` se conservan (son los
defaults conocidos y sus labels). `suppliers.category` SIGUE siendo `BudgetCategory`.

## Arquitectura

### Nuevo módulo `app/events/[id]/presupuesto/lib/categories.ts`
- `DEFAULT_CATEGORIES_BY_TYPE`: sets ordenados por tipo (boda / social / corporativo /
  impacto), usando nombres del enum existente (para que los labels resuelvan).
- `resolveTypeKey(eventType, eventCategory)`: `boda` si type==='boda'; si no, por
  `event_category` ('corporativo' | 'impacto') o `social` por defecto.
- `getEventCategories(stored, eventType, eventCategory, budgets)`: lista efectiva =
  `stored` (si existe) ó default-por-tipo; **siempre** unida con categorías presentes en
  `budgets` que no estén ya (al final), para que ningún concepto quede huérfano.
- `categoryLabel(name)`: `BUDGET_CATEGORY_LABELS[name] ?? name`.

### Sets default por tipo (orden = prioridad)
- **boda:** Venue, Banquete, Bebidas, Audio y Video, Imagen, Decoracion, Ceremonia,
  Entretenimiento, Papeleria, Planeacion, Logistica, Recuerdos, Digital, Otro.
- **social:** Venue, Banquete, Bebidas, Audio y Video, Decoracion, Entretenimiento,
  Imagen, Papeleria, Recuerdos, Logistica, Digital, Otro.  (sin Ceremonia)
- **corporativo:** Planeacion, Venue, Banquete, Bebidas, Audio y Video, Decoracion,
  Papeleria, Entretenimiento, Logistica, Digital, Otro.  (sin Ceremonia/Imagen/Recuerdos)
- **impacto:** Planeacion, Venue, Banquete, Bebidas, Audio y Video, Decoracion, Papeleria,
  Entretenimiento, Logistica, Digital, Otro.

### Cambios en `presupuesto/page.tsx`
- Cargar `event_settings.budget_categories` (en `loadAll`).
- Estado `categories: string[]` derivado con `getEventCategories(...)`.
- Reemplazar `BUDGET_CATEGORIES.map(...)` (línea ~504) por `categories.map(...)`.
- `itemsByCategory` y `availableSuppliersByCategory` se construyen sobre `categories`
  (string) en vez del enum. El match de proveedores sólo aplica donde el nombre coincide
  con una `BudgetCategory`.
- Búsqueda / import preview usan `categoryLabel(...)` en vez de `BUDGET_CATEGORY_LABELS[...]`.
- `persistCategories(next: string[])`: `upsert` a `event_settings` (por `event_id`) y set
  de estado.
- Handlers: `addCategory(name)`, `renameCategory(old, nuevo)`, `deleteCategory(name)`
  (mueve conceptos a "Otro" si los hay), `reorderCategories(next)`.
- Al **generar** presupuesto (feature ya existente), hacer merge de las categorías nuevas
  del template a la lista guardada (que aparezcan aunque no las tuviera).
- Botón "Categorías" en la toolbar (abre el modal) + "+ Agregar categoría" inline al final
  de la lista.

### Nuevo componente `presupuesto/BudgetCategoriesModal.tsx`
Modal de gestión: lista ordenable (`@dnd-kit/sortable`), renombrar inline, eliminar (con
la lógica de mover a "Otro"), agregar. Recibe `categories`, `itemCountByCategory`, y
callbacks. Estilo flat/teal, sin emojis, español con acentos.

### Modal de concepto (`BudgetItemModal`)
El select de categoría usa la lista dinámica `categories` (no el enum).

## Compatibilidad / no romper nada
- Eventos existentes (sin `budget_categories`): el resolver cae al default-por-tipo y une
  las categorías ya presentes en sus `event_budgets` → ven todo lo que ya tenían.
- Proveedores intactos: enum global; categorías custom sin auto-match (vínculo por ID
  sigue). Forward-compat para el espacio "pro".

## Fuera de alcance (YAGNI)
- Categorías globales reutilizables entre eventos (esto es por-evento).
- Cambiar el modelo de `suppliers.category`.
- Colores/íconos por categoría custom.

## Criterios de éxito
- Un evento corporativo no muestra Ceremonia/Imagen; uno de boda sí.
- El usuario agrega/renombra/elimina/reordena y persiste (recargar mantiene).
- Eliminar categoría con conceptos los mueve a "Otro" (cero pérdida de datos).
- Proveedores y su vinculación siguen funcionando.
- `npm run lint` + `npm run build` pasan.
