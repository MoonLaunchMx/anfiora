# Rolodex paso 4 — el directorio de proveedores

**Fecha:** 12-sep-2026
**Estado:** aprobado por Diego sobre el mockup, con las tres decisiones cerradas.
**Mockup aprobado:** https://claude.ai/code/artifact/8d18c694-2858-46ec-9899-b532bee4ad17
**Spec madre:** `2026-09-01-rolodex-proveedores-design.md` (§4 Vista 1). **Paso 3:** `2026-09-11-rolodex-expediente-design.md`.

## Qué es

Todos los proveedores de la cuenta en una sola tabla, con búsqueda y filtros, y los mismos números que ya muestra el expediente. Vive en `/rolodex`, dentro de la cáscara que nació con el paso 3. La fila completa abre el expediente del proveedor.

No hay SQL nuevo. Todo sale de `suppliers`, `event_suppliers`, `events`, `event_budgets.contract_amount`, `supplier_payments` y `supplier_reviews`.

## Las tres decisiones que Diego cerró

1. **El enlace de entrada vive en la cabecera del dashboard**, junto a la campana y al feedback. Lo ve todo dueño de cuenta, tenga o no workspace. No en el menú del workspace del tramo 5.
2. **Nueve columnas**, las ocho del mockup más «Rango de inversión».
3. **«Agregar proveedor sin evento» no entra aquí.** El directorio es de solo lectura; el alta a nivel cuenta es un paso aparte.

## Pantalla

1. **Título** «Rolodex» y una línea de resumen: cuántos proveedores hay, cuántos han estado en un evento y cuántos no.
2. **Barra:** buscador (nombre, ciudad o etiqueta), botón «Filtros» con los grupos Categoría y Ciudad, enlace «Limpiar» cuando algo está filtrando, y a la derecha la cuenta de lo que se está viendo.
3. **Tabla de columnas fijas**, guion donde no aplica: Proveedor (ciudad, estado y etiquetas debajo) · Categoría · Eventos (cuántos siguen activos debajo) · Tasa de cierre (X de Y debajo) · Ahorro negociado (de cuántos contratos) · Rango de inversión · Calificación del planner · Satisfacción del cliente · Última vez (evento, estatus y mes).
4. **Cualquier encabezado ordena.** El primer clic va de mayor a menor, salvo en Proveedor, Categoría y Ahorro, donde lo útil es al revés. Lo que no tiene dato se va al final en los dos sentidos, y los empates se rompen por nombre.
5. **Pie:** «Tu Rolodex · N proveedores · M en algún evento · K contratados alguna vez». Sin sumas de dinero: el dinero vive por evento.
6. **Teléfono:** tres celdas por proveedor (Eventos, Cierre, Planner) más el estatus y el mes de la última vez. Mismo patrón que el expediente, sin tarjetas.

## Fórmulas (`lib/rolodex/directorio.ts`, con pruebas)

Todo se apoya en `lib/rolodex/expediente.ts`, que ya calcula la historia de un proveedor: el directorio agrupa los vínculos por proveedor, llama a `armarFilas` una vez por cada uno y resume.

- **Eventos** son todos sus vínculos, con cualquier estatus. **Activos** usa el mismo corte que las carpetas del expediente: el evento no ha terminado.
- **Tasa de cierre, ahorro negociado, rango de inversión y las dos calificaciones** son las funciones del expediente sin cambios (`tasaDeCierre`, `ahorroNegociado`, `rangoContratado`, `calificaciones`).
- **Última vez** es el evento con fecha más reciente donde estuvo, con el estatus que tenga ahí. No es el «Último cierre» del expediente, que solo mira contratados.
- **Buscar** normaliza sin acentos y pega contra nombre, ciudad, estado y etiquetas. Los filtros son Categoría y Ciudad; la etiqueta se busca, no se filtra.
- **Moneda:** la del primer evento del proveedor, o MXN si no tiene ninguno.

## Acceso

Solo el dueño de la cuenta ve su Rolodex (§2 del spec madre). La consulta filtra `suppliers` por `user_id` y por `archived_at is null`, así que un proveedor archivado no aparece; hoy nada escribe esa columna.

## Volver

`destinoDeVuelta` vive ahora en `lib/rolodex/volver.ts` con pruebas. Desde el directorio, Volver va al dashboard. Desde el expediente, va a la ficha que lo abrió (`?desde=`) y, sin ella, al directorio — antes caía al dashboard.

## Choque con el tramo 5

`app/dashboard/page.tsx` lo tocan dos ramas. Acordado con esa sesión: el enlace del Rolodex es un componente aparte (`app/components/EnlaceRolodex.tsx`), su import no va como última línea del bloque y el botón se inserta **antes** del de feedback, que es donde el tramo 5 mete «Mi workspace». Los dos botones comparten estilo para leerse como un par de accesos de cuenta. Quien entre segundo a `main` rebasea.

## Fuera de este paso

Agregar proveedor sin evento · editar contacto · archivar · exportar · filtro por etiqueta · recordar los filtros entre visitas · la pieza del Rolodex en el dashboard (§3 del spec madre).
