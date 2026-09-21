# Finanzas gateada — plan de implementación (Tramo 3, parte 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el hueco número uno del spec: hoy Presupuesto, Proveedores y Pagos son **invisibles para cualquier colaborador**, aunque le des permiso. Al terminar, un colaborador con `presupuesto: 'ver'` ve las partidas y ningún botón; con `'editar'` las cambia y no borra; con `'total'` borra y queda firmado en la bitácora.

**Architecture:** Se repite la plantilla del Tramo 2 (Timeline) en tres módulos: policies por operación con `puede_ver / puede_editar / puede_borrar`, controles envueltos en `<Puede>`, cortes de permiso **dentro** de cada función que escribe, y disparador de bitácora por tabla. **Con una diferencia que este tramo obliga a resolver:** dos de las tablas de finanzas (`suppliers` y `categories`) no son del evento sino del despacho, y hoy están amarradas a `auth.uid()`. Eso se ataca primero, porque sin ello abrir las policies deja las pantallas igual de vacías por otra razón.

**Tech Stack:** Next 16 App Router, React 19, TypeScript, Supabase (Postgres + RLS), Vitest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-04-accesos-por-herramienta-design.md`
**Tramo anterior:** `docs/superpowers/plans/2026-09-04-accesos-timeline.md` — es la plantilla exacta.
**SQL de referencia:** `docs/superpowers/plans/sql/2026-09-05-accesos-timeline-policies.sql`

## Global Constraints

- **Idioma de la interfaz: español, con acentos.** Los mensajes de commit van **sin acentos ni ñ**.
- **Sin emojis.** Iconos de `lucide-react`.
- **Solo Tailwind.** Botones de acción en teal `#48C9B0`; el negro `#1D1E20` es exclusivo de dropdowns de filtro.
- **Si el nivel es de lectura, la mutación NI SE DIBUJA.** No deshabilitada: ausente. Pero el detalle **sí abre** en solo lectura — explorar no es tocar.
- **No abrir la lectura de un módulo sin gatear sus botones en la misma tanda.**
- **El código va a producción ANTES que el SQL**, y todo debe funcionar mientras el SQL no se ha corrido.
- Los `.sql` se escriben y se commitean. **Los corre Diego. Nunca tocar Supabase.**
- Otro agente puede estar en el mismo checkout: **nunca `git add -A`**, siempre rutas explícitas, y verificar la rama antes de commitear.
- **Verificar con `npm run build`**, no solo `tsc`: los guardianes viven en el prebuild.

---

## Estado de la base, ya leído (no re-investigar)

`pg_policies` leído en producción el **5-sep**. Las cuatro tablas de finanzas tienen la **misma forma**: cuatro policies `<tabla>_{select,insert,update,delete}_own`, todas contra `events.user_id = auth.uid()`.

| Tabla | Eje | Condición actual | Nota |
|---|---|---|---|
| `event_budgets` | evento | `events.user_id = auth.uid()` | roles `{public}` |
| `event_suppliers` | evento | `events.user_id = auth.uid()` | roles `{public}` |
| `supplier_payments` | evento (vía `event_suppliers`) | join a `events.user_id` | roles `{public}` |
| `suppliers` | **usuario** | `auth.uid() = user_id` | roles `{public}` |
| `categories` | **usuario** | `user_id = auth.uid()` | roles `{authenticated}` |

**Los cuatro UPDATE de las tablas de evento no tienen `WITH CHECK`.** Se les pone al reescribirlas: sin él, el dueño de una fila puede cambiarle el `event_id` e inyectarla en una boda ajena.

Otros hechos verificados en el código, ya confirmados:

- **No hay un solo enlace directo `?id=` en finanzas.** Barrido de `useSearchParams` en los tres módulos: cero. El peor bug del Tramo 2 no se puede repetir aquí. **Lo que sí hay son dos mutaciones sin botón de por medio:** arrastrar en el kanban de proveedores (`SupplierKanbanView`) y reordenar categorías del presupuesto (`BudgetCategoriesModal`). Se tratan igual que un botón.
- **El seed automático del presupuesto ya no existe.** `CLAUDE.md` sigue diciendo que se auto-siembra al primer acceso; hoy es el botón "Generar" (`handleGenerateClick`). Un colaborador en `ver` **no dispara escrituras al entrar**.
- Los tres módulos tienen `feature: null` en `MODULOS_CONFIG`: no se prenden ni apagan, no hay cruce con `enabled_features`.
- **`event_settings.budget_categories`** guarda la lista de secciones del presupuesto, y `event_settings` está gobernada por `is_event_editor`, que **todavía lee `event_collaborators.role`**. Alguien con `presupuesto: 'ver'` y `role='editor'` de antes puede reordenar y borrar secciones. Se cierra en la Tarea 8.
- `hasAccess` **no lo consume nadie fuera de `lib/event-access-context.tsx`** (grep verificado). Derivarlo o borrarlo no toca ninguna pantalla.

---

## Decisión de producto tomada por Diego (5-sep)

**Un colaborador con `editar` SÍ puede crear proveedores y categorías nuevas, y la fila nace del dueño del despacho** — `user_id` = `events.user_id`, no el de quien la teclea.

Sin esto, `editar` en Proveedores queda casi inservible: el alta *es* el flujo principal. Y de paso arregla un bug latente: hoy `handleCreateSupplier` escribe `user_id: user.id` de la sesión, así que en cuanto un colaborador diera de alta un proveedor, la ficha nacería suya, la policy dejaría fuera al dueño del evento, el join `supplier:suppliers(*)` devolvería `null` y **la tarjeta se rompería en la pantalla del dueño**.

Corrección a lo que se dijo en el chat: **borrar una categoría ya es solo de esta boda** (mueve las partidas a "Otro" y la quita de `event_settings`; no toca el catálogo). La que escribe en el catálogo del despacho es *crear* una.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/permisos/resolver.ts` | **Modificar.** Borrar `permisosDesdeRolLegado()` |
| `lib/permisos/resolver.test.ts` | **Modificar.** Quitar su bloque de pruebas |
| `lib/event-access-context.tsx` | **Modificar.** `hasAccess` derivado de `resumir()`; respaldo legado fuera |
| `app/events/[id]/presupuesto/page.tsx` | **Modificar.** Catálogo al eje del dueño + cortes + `<Puede>` |
| `app/events/[id]/presupuesto/BudgetItemRow.tsx` | **Modificar.** Inputs inline, picker de proveedor y borrar |
| `app/events/[id]/presupuesto/BudgetCategoryRow.tsx` | **Modificar.** Botón de agregar partida |
| `app/events/[id]/presupuesto/BudgetCategoriesModal.tsx` | **Modificar.** Agregar, borrar y **reordenar arrastrando** |
| `app/events/[id]/presupuesto/BudgetItemModal.tsx` | **Modificar.** No abre sin `editar` |
| `app/events/[id]/proveedores/page.tsx` | **Modificar.** Alta al eje del dueño + cortes + `<Puede>` |
| `app/events/[id]/proveedores/SupplierDetailModal.tsx` | **Modificar.** Abre en solo lectura; guardar/borrar/pagos gateados |
| `app/events/[id]/proveedores/SupplierModal.tsx` | **Modificar.** No abre sin `editar` |
| `app/events/[id]/proveedores/SupplierReviewModal.tsx` | **Modificar.** Guardar solo con `editar` |
| `app/events/[id]/proveedores/SupplierKanbanView.tsx` | **Modificar.** Arrastrar solo con `editar` |
| `app/events/[id]/pagos/page.tsx` | **Modificar.** Cortes + `<Puede>` |
| `docs/.../sql/2026-09-06-accesos-finanzas-policies.sql` | **Crear.** Las 3 tablas de evento + disparadores |
| `docs/.../sql/2026-09-06-accesos-catalogo.sql` | **Crear.** `suppliers` y `categories` al eje del despacho |
| `docs/.../sql/2026-09-06-guard-user-id.sql` | **Crear.** Cerrar el secuestro de `events.user_id` |
| `docs/.../sql/2026-09-06-accesos-event-settings.sql` | **Crear.** La fuga de `budget_categories` |

---

## Orden de las tareas y por qué

1. **Tarea 0** — deuda del Tramo 1. Aislada, no depende de nada.
2. **Tarea 1** — el catálogo al eje del dueño. **Va antes que el gateo**: si no, aunque abramos `event_budgets`, el presupuesto le sale en blanco al colaborador porque `cargarCategorias(user.id)` le trae cero categorías y ninguna partida encaja en ninguna sección.
3. **Tarea 2** — el artifact de las tres pantallas en `ver`, antes de codear.
4. **Tareas 3, 4, 5** — Presupuesto, Proveedores y Pagos gateados.
5. **Tareas 6, 7, 8, 9** — los cuatro `.sql`, que corre Diego al final.

---

## Task 0: La deuda del Tramo 1

**Files:**
- Modify: `lib/permisos/resolver.ts`, `lib/permisos/resolver.test.ts`, `lib/event-access-context.tsx`

**Interfaces:**
- Removes: `permisosDesdeRolLegado()`
- Changes: `hasAccess` deja de ser `role !== null` y pasa a `resumir(ctx).entra > 0`

- [ ] **Step 1: Borrar `permisosDesdeRolLegado()`**

Quitar la función de `resolver.ts` y su `describe` de `resolver.test.ts`.

En `lib/event-access-context.tsx:155`, la línea

```ts
setPermisos(permisosLeidos ?? permisosDesdeRolLegado(collaborator?.role))
```

pasa a

```ts
setPermisos(permisosLeidos ?? {})
```

**El porqué, que hay que decir en el commit:** hoy ese respaldo es *failure-open* — si la lectura de `permisos` falla, le devuelve `total` en los doce módulos a cualquier `editor` o `admin` legado. La migración ya corrió y todos los colaboradores tienen permisos, así que el respaldo no le aplica a nadie; lo único que queda es el riesgo. `{}` lo vuelve *failure-closed*.

- [ ] **Step 2: `hasAccess` derivado de `resumir()`**

En `lib/event-access-context.tsx`, sustituir `const hasAccess = role !== null` por el cálculo sobre el mismo `ContextoPermiso` que ya arma `nivelDeModulo`, y memorizarlo junto a él. Verificado por grep: **nadie consume `hasAccess` fuera de este archivo**, así que el cambio no toca ninguna pantalla.

- [ ] **Step 3: Verificar**

Run: `npx vitest run lib/permisos`
Expected: PASS, sin el bloque borrado.

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/permisos/resolver.ts lib/permisos/resolver.test.ts lib/event-access-context.tsx
git commit -m "refactor(accesos): hasAccess sale de resumir y muere el respaldo por rol legado"
```

---

## Task 1: El catálogo al eje del dueño

Las dos tablas del despacho (`suppliers`, `categories`) se leen y escriben hoy con el usuario de la **sesión**. Esta tarea las pasa al dueño del evento. **El comportamiento visible no cambia hoy** —para el dueño, sesión y dueño son la misma persona— y es lo que permite que el gateo funcione mañana.

**Files:**
- Modify: `app/events/[id]/presupuesto/page.tsx`, `app/events/[id]/proveedores/page.tsx`

- [ ] **Step 1: Las categorías se cargan del dueño**

En ambas páginas, `loadAll()` hace hoy:

```ts
const { data: { user } } = await supabase.auth.getUser()
setUserId(user?.id ?? null)
setCategorias(user ? await cargarCategorias(user.id) : [])
```

El `event` ya viene en el mismo `Promise.all`. Cambiar a cargar con `event.user_id`, y guardar ese id en el estado como **el dueño del catálogo**, que es lo que van a usar el alta de categoría y el alta de proveedor. Si `event` no cargó, `[]` — nunca caer al usuario de la sesión como respaldo, que es justo el bug.

- [ ] **Step 2: Crear categoría escribe en el catálogo del dueño**

En `presupuesto/page.tsx`, `addCategory()` llama `crearCategoria(user.id, ...)`. Pasa a usar el dueño del catálogo.

- [ ] **Step 3: La ficha de proveedor nace del dueño**

En `proveedores/page.tsx`, `handleCreateSupplier` escribe `user_id: user.id`. Pasa al dueño del evento. Quitar el `supabase.auth.getUser()` si queda huérfano.

- [ ] **Step 4: Verificar**

Run: `npm run build` → sin errores.
Run: `grep -n "cargarCategorias(user\|user_id: *user\.id" app/events/\[id\]/presupuesto/page.tsx app/events/\[id\]/proveedores/page.tsx` → **cero resultados**.

A mano, con la sesión del dueño: el presupuesto y los proveedores cargan igual que antes, con sus categorías. Dar de alta un proveedor y una categoría siguen funcionando.

- [ ] **Step 5: Commit**

```bash
git add app/events/\[id\]/presupuesto/page.tsx app/events/\[id\]/proveedores/page.tsx
git commit -m "fix(finanzas): el catalogo de categorias y proveedores es del dueno del evento, no de la sesion"
```

---

## Task 2: La interfaz, en artifact antes de codear

**No se escribe una línea de las tareas 3-5 sin esto.** Regla de la casa: la interfaz se itera en un artifact.

- [ ] **Step 1: Armar el artifact**

Las tres pantallas de finanzas en sus cuatro niveles, para que Diego vea exactamente qué desaparece:

- **Presupuesto** en `ver`: stats, HealthBar, búsqueda, exportar y las filas legibles. Sin "Agregar partida", sin importar, sin generar, sin editar inline, sin picker de proveedor, sin borrar, sin gestionar categorías.
- **Proveedores** en `ver`: tarjetas, filtros, las tres vistas, links de WhatsApp/IG. Sin "Nuevo proveedor". Kanban **sin arrastrar**. La tarjeta **sí abre** el detalle.
- **Detalle del proveedor** en `ver`: los campos completos, bloqueados, y la sección de pagos legible. Sin guardar, sin eliminar, sin registrar pago.
- **Pagos** en `ver`: tabla, filtros, orden y exportar. Sin "Nuevo pago", sin editar, sin borrar.
- Y en `total`, dónde aparece eliminar en cada una.

- [ ] **Step 2: Pasárselo a Diego y esperar el visto bueno**

---

## Task 3: Presupuesto gateado

**Files:**
- Modify: `page.tsx`, `BudgetItemRow.tsx`, `BudgetCategoryRow.tsx`, `BudgetCategoriesModal.tsx`, `BudgetItemModal.tsx`

- [ ] **Step 1: Envolver los controles**

`usePermiso('presupuesto')` en la página. Envolver en `<Puede modulo="presupuesto" accion="editar">`: agregar partida (genérico y por categoría), importar Excel, generar plantilla, gestionar categorías. En `accion="borrar"`: eliminar partida (los **dos** botones de `BudgetItemRow`, el de escritorio y el de móvil) y eliminar categoría dentro de `BudgetCategoriesModal`.

Exportar a Excel y PDF **se quedan visibles en `ver`**: el spec dice que explorar y exportar no es tocar.

`BudgetItemRow` recibe el permiso por prop y con `ver` renderiza sus campos como texto, no como `input` — que es lo que evita el nit de fechas del Tramo 2. El picker de proveedor y el botón de desvincular sólo con `editar`.

`BudgetCategoriesModal` sin `editar`: sin campo de agregar, sin borrar, y **sin `DndContext`** — el arrastre es una mutación sin botón.

- [ ] **Step 2: Cerrar las funciones, no solo los botones**

Corte de permiso **dentro** de cada una, antes de tocar Supabase: `handleImport`, `handleModalSubmit`, `handleUpdateItem`, `addCategory`, `persistCategories`, `reorderCategories`, `generateWith` → `editar`. `handleDeleteItem` y `deleteCategory` → `borrar`.

- [ ] **Step 3: Verificar**

Run: `npm run build` → sin errores.
Run: `grep -c "Puede modulo=\"presupuesto\"" app/events/\[id\]/presupuesto/*.tsx`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(presupuesto): gatear alta, edicion y borrado por permiso de herramienta"
```

- [ ] **Step 5: Pasarle el preview a Diego**

---

## Task 4: Proveedores gateado

**Files:**
- Modify: `page.tsx`, `SupplierDetailModal.tsx`, `SupplierModal.tsx`, `SupplierReviewModal.tsx`, `SupplierKanbanView.tsx`

- [ ] **Step 1: Envolver los controles**

`editar`: "Nuevo proveedor", el `DndContext` del kanban (con `ver` el tablero se ve y no se arrastra), guardar la ficha, registrar y editar pago, guardar la review. `borrar`: quitar el proveedor del evento y eliminar un pago.

**La tarjeta sigue abriendo el detalle en los tres niveles.** Es la sobre-corrección del Tramo 2 y no se repite: con `ver` el modal abre completo, con los campos bloqueados y sin ningún botón de acción.

- [ ] **Step 2: Cerrar las funciones**

`handleCreateSupplier`, `handleStatusChange`, `handleSave`, `handleSavePayment` y el guardado de la review → `editar`. `handleDelete` y `handleDeletePayment` → `borrar`.

`handleStatusChange` merece cuidado: se dispara desde el dropdown **y** desde el arrastre del kanban. El corte va dentro de la función, que es lo que cubre las dos entradas.

- [ ] **Step 3: Verificar** — `npm run build`, y a mano que la tarjeta abra en `ver`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(proveedores): detalle en solo lectura y mutaciones gateadas por permiso"
```

- [ ] **Step 5: Pasarle el preview a Diego**

---

## Task 5: Pagos gateado

**Files:**
- Modify: `app/events/[id]/pagos/page.tsx`

- [ ] **Step 1: Envolver** — "Nuevo pago" y abrir el modal en modo edición → `editar`; eliminar → `borrar`. Filtros, orden, búsqueda y los dos exports se quedan en `ver`.

- [ ] **Step 2: Cerrar** — `handleSavePago` → `editar`; `handleDeletePago` → `borrar`.

- [ ] **Step 3: Verificar** — `npm run build`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(pagos): gatear alta, edicion y borrado por permiso de herramienta"
```

---

## Task 6: Las policies de las tres tablas de evento

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-06-accesos-finanzas-policies.sql`

Calca de `2026-09-05-accesos-timeline-policies.sql`. Doce policies nuevas (cuatro por tabla) y tres disparadores de bitácora.

- [ ] **Step 1: Escribir el archivo**

Encabezado con los requisitos en orden: el código del Tramo 3 en producción, y `-accesos-catalogo.sql` **después**, no antes.

- `event_budgets` → `puede_*(event_id, 'presupuesto')`
- `event_suppliers` → `puede_*(event_id, 'proveedores')`
- `supplier_payments` → `EXISTS` sobre `event_suppliers` con `puede_*(es.event_id, 'pagos')`

Los tres UPDATE llevan **`WITH CHECK` además de `USING`** — hoy ninguno lo tiene, y sin él se puede mover una fila a otra boda.

Disparadores: `log_borrado('presupuesto','budget','subcategory')`, `log_borrado('proveedores','event_supplier', ...)` y `log_borrado('pagos','payment','reference')`.

**Ojo con el orden del borrado en cascada:** al borrar un `event_suppliers` se van sus `supplier_payments` por la FK. Los dos disparadores escriben, así que la bitácora guarda padre e hijos — que es lo que queremos. Verificar que `log_borrado` no truene cuando el evento ya no existe.

- [ ] **Step 2: Revisar el archivo**
- [ ] **Step 3: Commit**

---

## Task 7: El catálogo del despacho

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-06-accesos-catalogo.sql`

Aquí está la decisión de diseño de este tramo. `suppliers` y `categories` no tienen `event_id`, así que no se pueden gobernar con `puede_*(event_id, modulo)` directo.

- [ ] **Step 1: Escribir el archivo**

**`suppliers` — SELECT:** el dueño, **o** quien pueda ver Proveedores en una boda donde esa ficha ya está vinculada.

```sql
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM event_suppliers es
             WHERE es.supplier_id = suppliers.id
               AND public.puede_ver(es.event_id, 'proveedores'))
)
```

Esto cumple el §5.3 del spec al pie: **un colaborador nunca ve el directorio completo**, sólo las fichas que ya trabajan en sus bodas.

**`suppliers` — INSERT/UPDATE:** al dar de alta, la ficha todavía no está vinculada a nada, así que el `EXISTS` de arriba no sirve. La condición es "eres editor de Proveedores en alguna boda de ese dueño":

```sql
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e
             WHERE e.user_id = suppliers.user_id
               AND public.puede_editar(e.id, 'proveedores'))
)
```

**`suppliers` — DELETE se queda como está, sólo el dueño.** Ninguna pantalla borra fichas del catálogo (`handleDelete` borra el `event_suppliers`, no el `suppliers`), y borrar una se lleva el historial de todas las bodas. No se abre lo que nadie usa.

**`categories`:** misma forma, con `puede_ver`/`puede_editar` sobre `presupuesto` **o** `proveedores`, porque las dos pantallas la leen. DELETE se queda con el dueño.

**Un límite que hay que decir en voz alta:** a diferencia de `suppliers`, la lista de categorías se abre **entera** — no hay por dónde filtrar categoría por boda. Son etiquetas, no datos del cliente, y sin ellas la pantalla no se puede dibujar. Es una concesión consciente, no un descuido.

- [ ] **Step 2: Revisar el archivo**
- [ ] **Step 3: Commit**

---

## Task 8: Las dos fugas por la puerta de atrás

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-06-guard-user-id.sql`
- Create: `docs/superpowers/plans/sql/2026-09-06-accesos-event-settings.sql`

- [ ] **Step 1: Cerrar el secuestro de `events.user_id`**

`guard_event_config` protege `user_id`, pero deja pasar entero a quien cumpla `is_event_admin(eid)` — y esa función lee `role = 'admin'` de `event_collaborators`. **Un admin de boda puede correr `update events set user_id = <el suyo>` y quedarse con la boda.** El rol ya no se otorga desde la UI, pero las filas viejas siguen ahí.

El arreglo es sacar `user_id` del `bypass`: se comprueba **antes** de la salida por admin, y sólo el dueño actual del evento puede cambiarlo.

- [ ] **Step 2: `event_settings.budget_categories`**

La lista de secciones del presupuesto vive en `event_settings`, gobernada por `is_event_editor`, que lee el `role` viejo. Alguien con `presupuesto: 'ver'` y `role='editor'` de antes puede reordenar y borrar secciones.

**Aquí hay una decisión que Diego tiene que confirmar antes de escribir el archivo**, porque `event_settings` es de veintitantas columnas de módulos distintos: o se mete `budget_categories` al disparador `guard_event_config` exigiendo `puede_editar(event_id,'presupuesto')`, o se parte la policy de `event_settings` por columna. Lo primero es una línea y resuelve hoy; lo segundo es el trabajo de verdad y le toca al tramo que gatee Configuración.

- [ ] **Step 3: Commit**

---

## Task 9: Entregarle el orden a Diego, no correrlo

- [ ] **Step 1: El orden exacto**

1. El código del Tramo 3 en producción (`main`, desplegado en Vercel).
2. `2026-09-06-accesos-finanzas-policies.sql`
3. `2026-09-06-accesos-catalogo.sql`
4. `2026-09-06-guard-user-id.sql`
5. `2026-09-06-accesos-event-settings.sql`

**El 2 antes del 3 importa:** las policies del catálogo dependen de `puede_ver`/`puede_editar`, que ya existen desde el Tramo 2, pero el `EXISTS` sobre `event_suppliers` sólo devuelve algo útil cuando la tabla ya está abierta a colaboradores.

- [ ] **Step 2: La prueba en producción, con sesión de colaborador real**

Los cinco criterios del §10 del spec que este tramo tiene que dejar ciertos:

1. Con `presupuesto: 'ver'` **ve las partidas** —hoy ve la pantalla vacía— y ningún botón de mutación.
2. Con `proveedores: 'ver'` la tarjeta **abre el detalle completo**, bloqueado y sin botones.
3. Con `pagos: 'editar'` registra un pago, **refresca y sigue ahí**.
4. Con `proveedores: 'editar'` da de alta un proveedor, y **el dueño lo ve** en su lista.
5. Con `presupuesto: 'total'` borra una partida y queda la fila en `event_audit_log` con `budget.deleted` y la fila completa en `old_value`.
