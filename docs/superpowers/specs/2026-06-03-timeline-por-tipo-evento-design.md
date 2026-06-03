# Timeline por tipo de evento (generar plan sugerido)

**Fecha:** 2026-06-03
**Estado:** Diseño aprobado
**Rama:** `feature/timeline-templates`

## Objetivo

Darle al usuario un timeline **ya armado y ordenado por prioridades** segun el tipo de
evento, con tareas programadas **antes de la fecha del evento**, que luego puede modificar.
Le facilita la vida vs. crear cada tarea desde cero.

## Comportamiento

- En Timeline vacio: boton **"Generar plan sugerido"** en el empty state. Tambien un boton
  "Generar plan" en la toolbar (disponible siempre para re-generar).
- Al generar: se crean las tareas de la plantilla del tipo de evento, ordenadas por
  prioridad/cercania, con `task_date = fecha_evento − offset`.
- **Fechas pasadas** (evento muy cercano): si la fecha calculada ya paso, se mueve a HOY
  (plan accionable, sin muro de vencidas).
- **Anti-duplicados:** se omiten las tareas cuyo titulo (case-insensitive) ya exista en el
  timeline actual. Asi re-generar no llena de repetidos.
- Requiere `events.event_date`. Si no hay fecha, el boton se deshabilita con hint
  ("Primero define la fecha del evento").
- Todo editable/borrable despues (son tareas normales).

## Seleccion de plantilla

- `event_type === 'boda'` → plantilla **Boda**
- `event_category === 'corporativo'` → plantilla **Corporativo**
- resto (social/impacto/otros) → plantilla **Social generica**

## Plantillas (offset = dias antes del evento)

### Boda
| # | Titulo | Categoria | Offset (dias) | Prioridad |
|---|---|---|---|---|
| 1 | Definir presupuesto y estilo | tarea | 365 | bloqueante |
| 2 | Armar lista de invitados (estimado) | tarea | 365 | bloqueante |
| 3 | Reservar venue / lugar | tarea | 330 | bloqueante |
| 4 | Anticipo del venue | pago | 330 | no_bloqueante |
| 5 | Contratar banquete / catering | tarea | 270 | bloqueante |
| 6 | Contratar fotografo y video | tarea | 240 | no_bloqueante |
| 7 | Contratar musica / DJ o banda | tarea | 240 | no_bloqueante |
| 8 | Enviar save the date | comunicacion | 210 | no_bloqueante |
| 9 | Elegir vestido de novia | tarea | 210 | no_bloqueante |
| 10 | Definir decoracion y flores | tarea | 180 | no_bloqueante |
| 11 | Elegir traje del novio | tarea | 150 | no_bloqueante |
| 12 | Pastel de bodas | tarea | 120 | no_bloqueante |
| 13 | Enviar invitaciones | comunicacion | 90 | no_bloqueante |
| 14 | Prueba de hair & makeup | tarea | 90 | no_bloqueante |
| 15 | Prueba de menu con el banquete | reunion | 60 | no_bloqueante |
| 16 | Acomodo de mesas (seating) | tarea | 30 | no_bloqueante |
| 17 | Confirmar asistencia (RSVP) | comunicacion | 21 | no_bloqueante |
| 18 | Pagos finales a proveedores | pago | 14 | bloqueante |
| 19 | Confirmar logistica del dia con proveedores | reunion | 7 | bloqueante |
| 20 | Detalles finales / kit de emergencia | tarea | 3 | no_bloqueante |

### Social generica
| # | Titulo | Categoria | Offset | Prioridad |
|---|---|---|---|---|
| 1 | Definir presupuesto | tarea | 180 | bloqueante |
| 2 | Armar lista de invitados | tarea | 180 | bloqueante |
| 3 | Reservar lugar | tarea | 150 | bloqueante |
| 4 | Contratar comida / banquete | tarea | 120 | bloqueante |
| 5 | Contratar musica / DJ | tarea | 90 | no_bloqueante |
| 6 | Decoracion y tematica | tarea | 75 | no_bloqueante |
| 7 | Enviar invitaciones | comunicacion | 45 | no_bloqueante |
| 8 | Pastel y postres | tarea | 30 | no_bloqueante |
| 9 | Confirmar asistencia (RSVP) | comunicacion | 14 | no_bloqueante |
| 10 | Pagos finales a proveedores | pago | 7 | bloqueante |
| 11 | Confirmar logistica del dia | reunion | 3 | no_bloqueante |

### Corporativo
| # | Titulo | Categoria | Offset | Prioridad |
|---|---|---|---|---|
| 1 | Definir objetivos y brief del evento | tarea | 120 | bloqueante |
| 2 | Definir presupuesto | tarea | 120 | bloqueante |
| 3 | Reservar sede | tarea | 105 | bloqueante |
| 4 | Contratar catering | tarea | 90 | no_bloqueante |
| 5 | Contratar AV y produccion | tarea | 90 | bloqueante |
| 6 | Definir agenda y programa | tarea | 75 | no_bloqueante |
| 7 | Confirmar ponentes / invitados clave | comunicacion | 75 | bloqueante |
| 8 | Armar lista de asistentes | tarea | 60 | no_bloqueante |
| 9 | Abrir registro / enviar invitaciones | comunicacion | 45 | no_bloqueante |
| 10 | Material y branding (senaletica, gafetes) | entrega | 30 | no_bloqueante |
| 11 | Confirmaciones y seguimiento | comunicacion | 14 | no_bloqueante |
| 12 | Pagos a proveedores | pago | 10 | bloqueante |
| 13 | Ensayo y logistica final | reunion | 5 | bloqueante |

## Arquitectura (archivos)

- **Create `app/events/[id]/timeline/lib/templates.ts`**
  - Tipos `TaskTemplate` y `TimelineTaskInsert`.
  - Constantes `BODA`, `SOCIAL`, `CORPORATIVO` (datos de las tablas de arriba).
  - `getTemplate(eventType, eventCategory)` → la lista correcta.
  - `buildTimelineTasks(eventId, eventType, eventCategory, eventDate, existingTitles)` →
    `TimelineTaskInsert[]`: filtra por dedupe (existingTitles, lowercase), calcula
    `task_date = event_date − offsetDays` con clamp a hoy, preserva orden.
- **Modify `app/events/[id]/timeline/page.tsx`**
  - Traer el evento (`events`: `event_date, event_type, event_category`) en un fetch.
  - Estado `generating`.
  - `handleGeneratePlan()`: arma `existingTitles` desde `tasks`, llama `buildTimelineTasks`,
    `insert` batch en `event_timeline_tasks`, luego `fetchTasks()`. Confirm al re-generar
    (cuando ya hay tareas).
  - Boton "Generar plan sugerido" en el empty state (cuando no hay filtros activos) y
    boton "Generar plan" en la toolbar (junto a "Agregar"). Deshabilitado si no hay
    `event_date`.

## Forma del insert (tabla `event_timeline_tasks`)

Igual al payload del TaskModal:
`{ event_id, title, emoji:null, category, task_date, task_time:null, notes:null,
is_highlighted:false, priority, assigned_to_user_id:null, assigned_to_name:null,
event_supplier_id:null, reminder_date:null }`

**OJO:** la tabla real es `event_timeline_tasks` (el CLAUDE.md dice `timeline_tasks`, esta
desactualizado).

## Sin cambios en Supabase

Usa `event_timeline_tasks` que ya existe. Cero SQL. Sin emojis (campo `emoji` = null).

## Fuera de alcance (YAGNI)

- Plantilla dedicada para "impacto" (usa la generica por ahora).
- Plantillas por cada uno de los 16 tipos (solo boda/social/corporativo).
- Editar/parametrizar offsets desde la UI.
