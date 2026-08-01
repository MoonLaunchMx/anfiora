# Dashboard v2: selector maestro — diseño aprobado

**Fecha:** 1 de agosto, 2026
**Estado:** aprobado, pendiente de implementar
**Mockup (fuente visual de verdad):** `docs/superpowers/specs/2026-08-01-dashboard-v2-mockup.html` — ábrelo en el navegador
**Mockup publicado:** https://claude.ai/code/artifact/fa758963-01a8-43f0-a829-4f5cca2f96e0
**Exploración previa (3 direcciones descartadas/fusionadas):** https://claude.ai/code/artifact/d25cbfb2-9e59-4ea3-b668-b76d9b9e3403

---

## Problema

El dashboard de hoy (`app/dashboard/page.tsx`, 794 líneas) es un tablero de confirmaciones RSVP. Anfiora ya administra dinero, proveedores, tareas, regalos, invitación y mesas, y nada de eso se ve al entrar. Además la misma pantalla sirve al anfitrión de una boda y al planner de doce eventos sin distinguirlos: cuatro tabs de estado y una lista vertical de tarjetas idénticas.

Dos objetivos que empujan en direcciones opuestas:

1. **Vender un evento.** Que la pantalla se vea presentable y muestre el evento a fondo.
2. **Servir al planner.** Que quien lleva varios eventos los tenga accesibles y comparables.

## Solución

El dashboard deja de ser una lista de eventos y se vuelve **una pantalla que apunta a un contexto**. El contexto se elige en un selector maestro en el encabezado, y puede ser:

- **Un evento** → se ve a fondo: hero con countdown, cuatro tarjetas de estado, feed de atención accionable, tareas, mesas, actividad reciente, equipo.
- **La cartera** → el mismo dashboard apuntando a todos los eventos: cuatro números globales, las urgencias más gordas de cualquier evento, y tarjetas por evento con dos barras.

La cartera **no es otra página**: es una opción más de la lista del selector, arriba de los eventos, con su propio contador de alertas.

## Decisiones cerradas

| # | Decisión | Valor |
|---|---|---|
| 1 | Dónde vive | `/dashboard` se convierte en esta pantalla. **No se toca `/events/[id]`, ni su nav, ni ninguna ruta.** |
| 2 | Hero | **Claro.** Respeta la regla de CLAUDE.md de que el negro `#1D1E20` es solo para dropdowns de filtro. El hero oscuro queda descartado. |
| 3 | Bifurcación por rol | **No hay dos pantallas.** `users.role` cambia el *orden* de las tarjetas y del feed, no el layout. |
| 4 | Fechas comprometidas de pago | **Fuera de alcance.** `supplier_payments` guarda cuándo se pagó, no cuándo toca pagar. Nada de "vence en 6 días". |
| 5 | Cambios en Supabase | **Ninguno.** Sin tablas nuevas, sin columnas nuevas, sin vistas. Todo se deriva de lo que ya existe. |
| 6 | Interruptor Planner/Anfitrión visible | **Descartado.** Era un artefacto del mockup de Gemini. El rol sale de `users.role`. |

### Sobre la decisión 4

El mockup original mostraba "Segundo pago a Banquete Aurora · vence en 6 días". Eso necesita una fecha comprometida que no existe en la base. En su lugar:

- **Feed de atención:** `Banquete Aurora · $148,000 sin pagar de $420,000 contratado` → botón *Registrar pago*. Sin fecha.
- **Cartera:** el número global pasa de "Por pagar esta semana" a **"Por pagar en total"** = contratado − pagado.

Ambos son derivables hoy. No se pierde la señal, solo la urgencia temporal.

## Anatomía de la pantalla

### Encabezado

```
[anfiora] │ [ ● Ana & Rodrigo   14 nov 2026  ▾ ]        [Acción rápida] [campana] [avatar]
             └─ selector maestro
```

El selector abierto contiene, en este orden:

1. **Buscador** — desde el primer render. Es lo que hace que aguante 40 eventos.
2. **Vista cartera** — fila destacada con fondo propio, ícono en negro, contador de alertas totales.
3. **Lista de eventos activos**, cada fila con:
   - punto de color **solo** en el evento en foco (no se colorea por tipo de evento: seis colores de tipo pelean con los semáforos y matan la señal)
   - nombre y `fecha · en N días · ciudad`
   - **cuatro barras de salud** en orden fijo: **invitados · dinero · logística · tareas**
   - **chip de deuda** a la derecha: número rojo si hay tareas vencidas, ámbar si hay algo para hoy, `OK` si está limpio, `Borrador` si la invitación no está publicada
4. **Pie** — `+ Nuevo evento` y acceso a pasados

### Contexto: un evento

1. **Hero claro** — chips de estado (activo, tipo, invitación publicada, modo de acceso), nombre grande, fecha/hora/venue, countdown, barra de organización, y tres botones: *Abrir evento*, *Ver invitación*, *Copiar link*.
2. **Cuatro tarjetas** — Invitados, Presupuesto, Proveedores, Mesa de regalos.
3. **Feed "Requiere tu atención"** — filas con ícono semántico, título, detalle y **botones que resuelven ahí mismo**.
4. **Dos columnas** — izquierda: pendientes de la semana con checkbox + mesas y acomodo. Derecha: actividad reciente + equipo.

### Contexto: la cartera

1. **Cuatro números globales** con borde izquierdo de color: tareas vencidas, por pagar en total, confirmados en total, presupuesto gestionado.
2. **Feed transversal** — lo más urgente de cualquier evento, con el nombre del evento en el detalle.
3. **Tabs de estado** (activos/pasados/pausados/cancelados) — se conservan los de hoy.
4. **Tarjetas por evento** en grid de 3, cada una con dos barras: confirmados y dinero. Se descartó la tabla densa: con dos barras se lee igual de rápido, aguanta mejor en móvil y no necesita scroll horizontal.

## La tarjeta de presupuesto

Es donde el mockup de Gemini se contradecía (decía `$245,000 de $300,000` en una vista y `$180k / $245k` en otra, mezclando dos definiciones). Definición única y final:

| Concepto | Origen | En la barra |
|---|---|---|
| **Estimado** | suma de `event_budgets.budget_amount` | es el 100 % de la pista |
| **Pagado** | suma de `supplier_payments.amount` de los proveedores del evento | tramo 1, teal oscuro |
| **Contratado por pagar** | `contratado − pagado` | tramo 2, teal |
| **Sin contratar** | `estimado − contratado` | resto de la pista, gris |
| **Excedido** | `contratado > estimado` | la barra se pinta roja |

El total mostrado en grande es siempre **estimado**. Es la única lectura que no se contradice con la página de presupuesto.

## De dónde sale cada número

| Dato | Origen |
|---|---|
| Confirmados, pendientes, declinados | `guests` + `party_members` |
| Requieren atención | `guests.needs_attention`, `attention_reason` |
| Estimado / contratado / pagado | `event_budgets`, `event_suppliers.contract_amount`, `supplier_payments` |
| Proveedores por estado | `event_suppliers.status` (nuevo, cotizado, contratado, descartado) |
| Tareas vencidas, hoy, bloqueantes | `timeline_tasks` (`task_date`, `priority`, `is_completed`) |
| Regalos y dinero recibido | `gift_registry_items`, `gift_reservations` |
| Mesas y sin lugar | `tables`, `table_seats` contra `guests` |
| Actividad reciente | `event_audit_log`, `gift_reservations`, `song_recommendations` |
| Invitación publicada o borrador | `event_settings` |
| Equipo | `event_collaborators` |
| Rol del usuario | `users.role` |

## Rendimiento

Hoy la página ya trae **todas** las filas de `guests` y `party_members` de **todos** los eventos para contarlas en el navegador. Con 6 eventos de 200 invitados son ~1,200 filas de dos columnas: molesto pero no un problema real.

**Decisión:** en esta primera versión se conserva la agregación en el cliente y se le suman las consultas nuevas (presupuestos, proveedores, pagos, tareas, regalos, asientos), todas acotadas por `event_id` y sobre tablas mucho más chicas que `guests`. Cero cambios en Supabase, se puede probar en local de inmediato.

**Umbral de revisión:** si un usuario con más de 15 eventos activos ve el dashboard tardar más de 1.5 s, se mueve la agregación a una vista en Postgres. No antes: sería optimizar sin medir.

Se conserva la regla que ya está comentada en el archivo actual: **una sola llamada a `supabase.auth.getUser()`** para toda la pantalla, porque cada llamada toma un candado global y varias en paralelo se encolan hasta agotar el timeout de 5 s en redes lentas.

## Permisos

- El `viewer` **no ve** las tarjetas de dinero (presupuesto, proveedores, por pagar) ni el feed de pagos.
- Los eventos compartidos siguen apareciendo con su chip de rol, como hoy.

## Fuera de alcance

- Fechas comprometidas de pago (decisión 4).
- Vista en Postgres para agregación.
- Tabla densa ordenable por columna para la cartera. Se evalúa cuando alguien traiga 20 eventos.
- Que el rol cambie el layout. Solo cambia el orden.
- Tocar `/events/[id]` o su nav.

## Decisión 7: el chip negro del selector

El chip de "Vista cartera" seleccionada usa negro `#1D1E20`. **Aprobado por Diego el 1 de agosto de 2026.** La regla de CLAUDE.md dice que el negro es exclusivo de dropdowns de filtro, y la lectura acordada es que el selector maestro **es** un dropdown de filtro: filtra el contexto de toda la pantalla. No hay nada que confirmar — si más adelante se quiere otro tono, es un cambio de una clase.
