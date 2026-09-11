# Plan — Rolodex paso 3: expediente `/rolodex/[id]`

Spec: `docs/superpowers/specs/2026-09-11-rolodex-expediente-design.md`. Rama `feat/rolodex-expediente` desde `origin/main` (a104f7a), worktree `anfiora-alta`, dev en 3003. Sin SQL. Un commit por tarea.

## Tarea 1 — La lógica pura: `lib/rolodex/expediente.ts` (+ `expediente.test.ts`)

Entrada: filas crudas (`event_suppliers`, `events`, `event_budgets`, `supplier_payments`, `supplier_reviews`). Salida: filas del expediente y KPIs.

- `armarFilas(...)` → `FilaExpediente[]` con: ids, nombre, fecha, fechaFin, lugar, estatus, moneda, cotizado, contratado (suma de partidas), pagado, porPagar, porcentajePagado, ahorro, porQue, planner, cliente, comentario.
- `partirActivosHistorial(filas, hoy)` → `{ activos, historial }` ordenados.
- `tasaDeCierre(filas)`, `ahorroNegociado(filas)`, `rangoContratado(filas)`, `ultimoCierre(filas)`, `calificaciones(reviews)`.
- `etiquetaRelativa(fechaISO, hoy)` → «hoy» · «mañana» · «en N días» · «concluido». `fechaLarga(iso)` → «14 nov 2026».
- `totales(filas)` → sumas y conteos para el pie.

Pruebas: caso lleno (6 eventos), caso flaco (1 evento), sin datos, mezcla de estatus, fechas al filo (hoy, fin de evento de varios días), corrimiento UTC.

## Tarea 2 — La página: `app/rolodex/layout.tsx` + `app/rolodex/[id]/page.tsx` (+ componentes chicos en la misma carpeta)

- Layout: copia de `app/ajustes/layout.tsx` con `VolverRolodex` (cliente): lee `?desde=` y cae a `/dashboard`.
- Página (`'use client'`): auth → `suppliers` por id (si no hay fila: «No encontramos este proveedor en tu Rolodex») → en paralelo `event_suppliers`, `supplier_reviews`, `cargarCategorias(supplier.user_id)` → `events`, `event_budgets`, `supplier_payments` por ids → `armarFilas` → cabecera, KPIs, carpetas, tablas (escritorio) y renglones apilados (teléfono). Espera con `<Cargando />`.
- Fila → `router.push('/events/[id]/proveedores?proveedor=<esId>')`.
- Reusa `Estrellas`, `EstatusProveedor`, `formatCurrency`, `contactosDe`, `nombrePorId`, `calcularScores`, `contratadoDelProveedor`.

## Tarea 3 — El enlace en la ficha: `FichaDelEvento.tsx`

- Al montar, `event_suppliers` `count` por `supplier_id`. Si `>= 2`, debajo del nombre: «Ver sus N eventos ›» en teal, a `/rolodex/<supplier_id>?desde=<ruta actual con ?proveedor=<esId>>`.
- Sin cambios en props ni en FichaModal/Fichero.

## Tarea 4 — Reabrir la ficha al volver: `proveedores/page.tsx`

- Tras `loadAll`, si `window.location.search` trae `proveedor=<esId>` y existe en `items`: en Fichero `setEnfocar(item)`, en Lista/Kanban `setSelectedItem(item)`. Luego se limpia el parámetro de la URL con `history.replaceState`.

## Tarea 5 — Verificación

`npx tsc --noEmit`, `npm test`, y `npm run build` con el dev server apagado. Después, pasos de prueba en local contra datos reales (DJ Riviera maya desde la ficha de Olivia & Pedro).
