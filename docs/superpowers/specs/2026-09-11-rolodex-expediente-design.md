# Rolodex paso 3 — el expediente del proveedor

**Fecha:** 11-sep-2026
**Estado:** aprobado por Diego sobre el mockup v4.
**Mockup aprobado:** https://claude.ai/code/artifact/d0a2319c-c56f-4bf9-bf7a-ece1e1e86877 (v4)
**Spec madre:** `2026-09-01-rolodex-proveedores-design.md` (§4 Vista 2). Este documento fija lo que cambió al dibujarlo.

## Qué es

Un proveedor visto a través de todos los eventos de la cuenta. Vive en `/rolodex/[id]` con cáscara propia (patrón de `/ajustes`: logo y Volver, una columna). Se llega desde la ficha del proveedor dentro del evento con el enlace **«Ver sus N eventos»**, que no aparece si el proveedor está en un solo evento.

No hay SQL nuevo. Todo se calcula con `suppliers`, `event_suppliers`, `events`, `event_budgets.contract_amount`, `supplier_payments` y `supplier_reviews`.

## Pantalla

1. **Cabecera:** iniciales, nombre, categoría (chip), ciudad y radio, «Último cierre: <evento> (<mes año>)» (el contratado más reciente), persona de contacto, teléfono y correo en una línea, WhatsApp en teal y los íconos de correo, Instagram y sitio. Solo lectura: se edita desde la ficha del evento, que ya escribe al Rolodex.
2. **Cinco KPIs:** Tasa de cierre `67% (4 de 6)` · Ahorro negociado `−8%` · Calificación del planner `4.5` · Satisfacción del cliente `4.8` · Rango de inversión `$38,000 – $62,000`. Lo que no se puede calcular lo dice en palabras («Sin calificar», «Sin datos»), nunca cero.
3. **Dos carpetas** (mismo patrón que la ficha del evento): **Activos** (el evento no ha pasado) e **Historial** (ya pasó, cancelados incluidos). Se abre en Activos; si no hay ninguno, en Historial.
4. **Tablas de columnas fijas.** Todos los renglones traen todas las celdas; lo que no aplica es un guion.
   - Activos: Fecha del evento (con «en N días» debajo) · Evento (lugar debajo) · Estatus · Cotizado (tachado si hay contrato) · Contratado · Ahorro · Pagado (con % debajo) · Por pagar.
   - Historial: Fecha (con «concluido») · Evento · Estatus · Cotizado · Contratado · Ahorro · Por qué (razones de contratación o motivo de descarte) · Planner · Cliente · Tu comentario.
   - Pie: «Balance consolidado · N eventos · M contratados» con sumas; en Historial además «se quedó M de N» y los promedios de estrellas.
   - La fila completa es clic y abre la ficha del proveedor dentro de ese evento (`/events/[id]/proveedores?proveedor=<event_supplier_id>`).
5. **Teléfono:** tres celdas por evento. Activos: Contrató (cotizó como nota chica), Pagado (% como nota), Por pagar. Historial: Contrató (ahorro como nota), Planner, Cliente, y «Por qué» + comentario en una línea. Balance al pie. Sin barra de acciones.

## Fórmulas (viven en `lib/rolodex/expediente.ts`, con pruebas)

- **Activo / historial:** activo si `event_end_date ?? event_date` es hoy o después. Activos del más cercano al más lejano; Historial del más reciente al más viejo.
- **Tasa de cierre:** contratados / los que llegaron al menos a Cotizado (`cotizado`, `contratado`, `descartado`). Un `nuevo` no cuenta. Sin denominador → «Sin datos».
- **Ahorro:** `(contratado − cotizado) / cotizado`, solo con los dos montos > 0. El KPI es el promedio de esos; con uno solo dice «de una sola vez».
- **Contratado por evento:** suma de `event_budgets.contract_amount` de sus partidas (`contratadoDelProveedor`). Sin partidas con contrato → guion.
- **Pagado:** suma de `supplier_payments.amount`. **Por pagar:** contratado − pagado (nunca negativo). **%:** pagado / contratado.
- **Planner:** promedio de los ejes de `post_evento` con `autor = planner` (`calcularScores().desempeno`). **Cliente:** igual con `autor = cliente`. **Por qué:** `razones_seleccion` de la review de contratación o `motivo_descarte` de la de descarte. **Comentario:** el de la review de desempeño del planner; si no hay, el de contratación o descarte.
- **Rango de inversión:** mínimo y máximo de los contratados > 0. Con uno solo, un monto.
- **Último cierre:** el contratado con fecha de evento más reciente.
- **Fechas:** las de evento son `YYYY-MM-DD` y se parten a mano (nunca `new Date(iso)`), igual que `fechaCortaISO`. «en N días» se calcula contra la fecha local de hoy.

## Acceso

Solo el dueño de la cuenta ve su Rolodex (§2 del spec madre). La página lee `suppliers` por id; si la RLS no devuelve la fila, la pantalla dice «No encontramos este proveedor en tu Rolodex» y ofrece volver. No hay lógica de roles nueva.

## Volver

El enlace desde la ficha lleva `?desde=<ruta de la ficha>`; Volver regresa ahí con la misma ficha abierta. Sin `desde`, Volver va al dashboard (hasta que exista `/rolodex`, paso 4).

## Fuera de este paso

Editar contacto, Archivar, Agregar a un evento, buscador, exportar, vencimientos de pago, el enlace «Rolodex» en la cabecera de cuenta (llega con el directorio del paso 4, y así no choca con el botón «Mi workspace» del tramo 5 en `app/dashboard/page.tsx`).
