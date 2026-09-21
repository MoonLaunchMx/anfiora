# Itinerario de varios días

**Fecha:** 2026-08-08
**Mockup:** `docs/superpowers/specs/2026-08-08-itinerario-multidia-mockup.html`

## El problema

Un evento puede durar varios días —`events.event_end_date` existe y se captura en Configuración— pero el itinerario lo ignora. `event_itinerary_moments` sólo guarda `start_time`, sin fecha, así que una boda de tres días queda como una sola lista revuelta donde el rompehielos del viernes y la tornaboda del domingo se mezclan con el sábado.

El planner no puede planear cada día, y el invitado no sabe qué pasa cuándo.

## Decisiones cerradas

1. **Los días son fechas reales.** Salen del rango `event_date → event_end_date`. Cada momento guarda su fecha.
2. **El día se acaba a las 12 am**, como Google Calendar. Se elimina el truco de `DAY_START_HOUR = 6`. El cierre de las 03:00 pertenece al día siguiente y se muestra ahí.
3. **La invitación agrupa por día**, respetando el `visible_to_guests` de cada momento.
4. **Fuera la IA del itinerario.** El botón se queda; por dentro pasa a plantillas.
5. **Acortar el rango no se bloquea.** El día que queda fuera se marca en rojo con un botón para eliminarlo.
6. **Los itinerarios que ya existen** se adaptan: todos sus momentos a `event_date`.
7. **Alcance de contenido:** plantillas completas para boda; una genérica por categoría (social, corporativo, impacto) para los otros 16 tipos de evento.

## Modelo de datos

Una columna nueva en `event_itinerary_moments`:

```sql
alter table event_itinerary_moments add column moment_date date;
update event_itinerary_moments m
  set moment_date = e.event_date
  from events e where e.id = m.event_id and m.moment_date is null;
alter table event_itinerary_moments alter column moment_date set not null;
create index on event_itinerary_moments (event_id, moment_date);
```

**Orden de despliegue.** La columna va primero: el código que escribe `moment_date` truena si no existe. Secuencia: aplicar el `alter` + `update` de backfill → desplegar el código → aplicar el `set not null`. El SQL vive en `docs/superpowers/plans/sql/` y no se ejecuta sin OK explícito.

No hay tabla de días. Un día no es una entidad: es una fecha derivada del rango del evento más los momentos que la traen. Menos estado que mantener y nada que se pueda desincronizar.

## Lógica pura — `lib/itinerary.ts`

**Se va:** `DAY_START_HOUR`, `momentOrderMinutes`, y el wrap de medianoche dentro de `sortMoments`.

**Se queda y cambia:**

- `sortMoments` ordena por `(moment_date, start_time, position)`.
- `curateForGuests` deja de devolver una lista plana y devuelve días.

**Se agrega:**

- `eventDays(eventDate, eventEndDate): string[]` — las fechas del rango. Si `event_end_date` es null o igual a `event_date`, devuelve un solo día.
- `groupByDay(moments, days)` — parte los momentos en días del rango y días huérfanos, conservando el orden.
- `dayLabel(date)` — `{ dow: 'Sábado', num: '13 sep' }` para la línea del día.

Contrato nuevo para el invitado:

```ts
type GuestItineraryDay = {
  date: string            // ISO
  label: string           // "Sábado 13"
  items: GuestItineraryItem[]
}
```

`GuestItineraryItem` no cambia. El invitado sigue sin ver `phase`, `notes` ni `duration_min`.

## Plantillas — `lib/itinerary-templates.ts` (nuevo)

Sustituyen a la IA. Una plantilla es una hora ancla y una tabla de desfases:

```ts
type TemplateStep = {
  offsetMin: number              // relativo al ancla; negativo = antes
  title: string
  durationMin: number | null
  phase: ItineraryPhase
  visible: boolean
}
type DayTemplate = {
  key: DayTypeKey
  anchorLabel: string            // "Ceremonia", "Apertura"
  defaultAnchorTime: string
  steps: TemplateStep[]
}
```

**Ocho tipos de día**, compartidos por todos los eventos: `montaje`, `ensayo`, `bienvenida`, `principal`, `sesiones`, `noche`, `siguiente`, `despedida`.

**El nombre lo pone el evento.** El mismo tipo se llama Rompehielos en una boda y Bienvenida en un retiro; Tornaboda en boda y Tornafiesta en XV. Un mapa `DAY_TYPES_BY_EVENT: Record<string, { key: DayTypeKey; label: string }[]>` dice qué tipos ofrece cada uno de los 17 tipos de evento y con qué etiqueta. La tabla completa está en el mockup.

**Contenido a construir:**

- **Boda:** los seis días completos. Montaje, Ensayo, Rompehielos, Día principal, Tornaboda, Despedida.
- **Genéricas:** una por categoría (social, corporativo, impacto) para el resto. Un congreso arranca con la de corporativo hasta que alguien pida la suya.

`expandTemplate(template, anchorTime, dayDate)` devuelve momentos listos para insertar. Un desfase que pasa de las 12 am cae en el día siguiente: la función devuelve la fecha corrida, no una hora mayor a 24.

Las plantillas nacen con el ojo del invitado puesto: el montaje oculto, la ceremonia visible.

## UI del planner — `app/events/[id]/timeline/`

**La línea del día.** Una sola lista continua, sin pestañas ni filtros. Cada día abre con una línea `SÁBADO 13 sep ————— 5 momentos · 4 visibles` pegada arriba (`sticky`), y **su fecha crece** mientras estás dentro de ese día. Al pasar al siguiente se encoge y se apaga. Si el evento es de un día, la línea no se dibuja: la pantalla queda igual que hoy.

La animación es sobre `font-size` dentro de una fila de altura fija, para que el crecimiento no empuje la lista. Respeta `prefers-reduced-motion`.

**El día huérfano.** Un día con momentos fuera del rango se dibuja al final, con la línea en rojo, la leyenda "fuera del rango" y un aviso con botón **Eliminar el día**. No bloquea nada: sus momentos simplemente dejan de salir en la invitación. El borrado pasa por el primitivo de confirmación, no por `confirm()`.

**El modal.** `GenerateItineraryModal` se reemplaza por `DayTemplateModal`, de dos pasos:

1. **Elegir** — qué pasa este día (los tipos que ofrece el evento) y a qué hora empieza el ancla.
2. **Previsualizar** — la lista completa antes de aceptarla, con "Cambiar" y "Agregar N momentos".

La previsualización es posible justamente porque ya no hay IA: es instantánea, así que se puede enseñar sin haber escrito nada.

**`MomentModal`** gana un campo de fecha, limitado a los días del rango, para mover un momento de día sin arrastrarlo.

## La invitación

`lib/guest-itinerary.ts` y `app/api/invitacion/[token]/route.ts` pasan a leer `moment_date` y devolver `GuestItineraryDay[]`. `ItinerarioSection.tsx` los pinta con su encabezado de día. Con un solo día, la sección se ve exactamente igual que hoy: el encabezado se omite.

Consumidores a tocar: `app/components/invitacion/types.ts`, `ItinerarioSection.tsx`, `InvitacionRenderer.tsx`, `app/invitacion/preview/[id]/page.tsx` y `app/invitacion/[slug]/[token]/InvitacionClient.tsx`.

## Lo que se borra

- `lib/itinerary-ai.ts` y `lib/itinerary-ai.test.ts`
- `app/api/itinerary/generate/route.ts`
- `app/events/[id]/timeline/GenerateItineraryModal.tsx`

`ANTHROPIC_API_KEY` se queda: `lib/ai-rsvp.ts` y el agente la siguen usando.

## Tests (Vitest, lógica pura)

- `eventDays` con rango de un día, de tres, y con `event_end_date` nulo
- `sortMoments` ordenando por fecha antes que por hora
- `groupByDay` separando huérfanos de días del rango
- `expandTemplate`: desfases correctos, cruce de medianoche que corre la fecha, ojo del invitado preservado
- `curateForGuests` agrupando y filtrando por `visible_to_guests`
- Los tests de `lib/itinerary.test.ts` que cubrían el wrap de las 6 am se eliminan con la regla

La UI y la invitación se verifican a mano: local → preview → main.

## Fuera de alcance

- Plantillas propias para los 16 tipos de evento que no son boda
- Arrastrar momentos entre días
- Copiar un día a otro
- Ligar el día del itinerario con las tareas del timeline
