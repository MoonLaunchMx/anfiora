# Itinerario del día — diseño

**Fecha:** 2026-07-06
**Módulo:** Timeline (`app/events/[id]/timeline/`)
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Contexto y objetivo

El Timeline hoy es un **plan de largo plazo**: tareas del save-the-date a la torna boda, agrupadas por mes, con vista lista y calendario (tabla `event_timeline_tasks`).

El **itinerario del día** es otra cosa: el *run-of-show* del día del evento — la secuencia hora por hora de lo que pasa (llegada de proveedores, ceremonia, coctel, cena, primer baile, cierre). Vive dentro del Timeline como una **pestaña nueva** junto a Lista y Calendario.

Sirve para dos cosas:
- **Guión operativo interno** para que el planner/coordinador ejecute el día.
- **Versión limpia y curada** que se comparte con los invitados dentro de la **invitación RSVP** (feature construido por otro agente en paralelo).

## 2. Alcance

**Dentro:**
- Nueva pestaña "Itinerario" en el timeline.
- Momentos con hora de inicio, duración (fin encadenado calculado), responsable/proveedor, ubicación/área, fase y notas.
- Toggle de visibilidad por momento (`visible_to_guests`).
- Barra "Compartir en la invitación RSVP".
- **Auto-generar con Claude**: a partir del tipo de evento y horas ancla (ceremonia, cena, cierre), Claude Haiku propone un run-of-show que el planner ajusta (ver §5.5).
- Contrato de datos de solo lectura que consume la invitación RSVP.
- Lógica pura testeable con Vitest.

**Fuera (fase 2 / no ahora):**
- Multi-día (víspera, día, torna boda). Solo el día del evento en v1.
- Drag & drop para reordenar momentos (v1 ordena por hora; se deja `position` para habilitarlo después).
- Render dentro de la invitación RSVP (lo hace el otro agente; aquí solo se define y expone el contrato).
- Export PDF / compartir por link independiente del itinerario (la vista compacta B se descartó como principal; puede volver como export en fase 2).
- Asistente de ajuste sobre itinerario existente (detectar huecos/traslapes) — posible fase 2.

## 3. Decisiones de diseño (del brainstorming)

| Decisión | Resultado |
|---|---|
| Propósito | Operativo interno **y** versión limpia compartible |
| Anatomía del momento | hora + duración (encadenada), responsable/proveedor, notas/guión, ubicación/área |
| Alcance temporal | **Solo el día del evento** (un día) |
| Layout | **Variante A · "Hilo del día"** (hilo vertical en oro, encadenado). B y C descartadas como principal |
| Compartir en RSVP | **Toggle por momento** (`visible_to_guests`): un solo itinerario, dos vistas (interna vs pública curada) |
| Coordinación con agente RSVP | **Yo defino el contrato de datos**; el otro agente lo consume. No toco sus archivos |
| Modelo de datos | **Tabla nueva `event_itinerary_moments`** (ver §4 para el porqué) |

**Identidad visual:** el itinerario del día usa **oro (`#c99a3f` / `#d4a853`)** como color de hilo, para diferenciarse del plan de meses que vive en gris/teal. Fases con paleta propia: montaje (gris), ceremonia (oro), social (teal), cena (ámbar), fiesta (plum).

Mockup de referencia: `https://claude.ai/code/artifact/c8f00efd-0fed-4727-96ec-ceb4bec0fb9e`

## 4. Modelo de datos

### Por qué tabla nueva y no reusar `event_timeline_tasks`

Se evaluó reusar la tabla existente. Se decidió **tabla nueva** como decisión de backend/CTO:

1. **Entidad distinta.** Momentos de un día, encadenados por duración, con fase y visibilidad; ciclo de vida diferente al de tareas con fecha/recordatorio/`bloqueante`/`is_completed`.
2. **Blast radius.** Reusar obligaría a filtrar `is_itinerary` en *cada* query del timeline actual (lista, calendario, los 4 contadores de stats). Cada uno es un punto donde se cuela un momento operativo en el plan de meses o se inflan los conteos. Con varios agentes en vuelo, se minimiza el radio de impacto.
3. **Higiene de columnas.** Reusar mete 5 columnas siempre-null en tareas de plan y arrastra `reminder_date`/`priority`/`is_highlighted` sin sentido para un momento. Tabla dedicada = cada columna con significado.
4. **Contrato limpio.** La invitación RSVP consume una superficie propia (`visible_to_guests = true`), no una vista filtrada de una tabla compartida.

La regla de "no crecer más allá de 17 tablas" protege contra *sprawl*; esta tabla acotada, que elimina riesgo transversal, es lo contrario a sprawl. Costo real: un FK nullable a proveedor.

### Esquema `event_itinerary_moments`

```sql
create table event_itinerary_moments (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  title             text not null,
  start_time        time not null,             -- hora del día (HH:MM)
  duration_min      integer,                    -- null = "hasta cierre" (sin fin fijo)
  location          text,                       -- ubicación / área (jardín, salón, terraza)
  phase             text not null default 'otro',
                     -- 'montaje' | 'ceremonia' | 'social' | 'cena' | 'fiesta' | 'otro'
  event_supplier_id uuid references event_suppliers(id) on delete set null,
  assigned_to_name  text,                       -- responsable libre (coordinador, MC)
  notes             text,
  visible_to_guests boolean not null default false,
  position          integer not null default 0, -- orden estable + futuro drag&drop
  created_at        timestamptz not null default now()
);

create index on event_itinerary_moments (event_id);
```

- `duration_min` nullable: el último momento ("apertura de pista hasta cierre") no tiene fin fijo.
- `event_supplier_id` reusa el catálogo de proveedores del evento; opcional.
- `assigned_to_name`: responsable en texto libre (no se liga a colaborador en v1; el itinerario del día suele delegarse a personas fuera del equipo con cuenta). Se puede sumar `assigned_to_user_id` en fase 2 si hace falta.

### Cambios en `lib/types.ts`

Agregar (aditivo, sin tocar tipos existentes):

```ts
export type ItineraryPhase =
  | 'montaje' | 'ceremonia' | 'social' | 'cena' | 'fiesta' | 'otro'

export interface ItineraryMoment {
  id: string
  event_id: string
  title: string
  start_time: string            // 'HH:MM' o 'HH:MM:SS'
  duration_min: number | null
  location: string | null
  phase: ItineraryPhase
  event_supplier_id: string | null
  assigned_to_name: string | null
  notes: string | null
  visible_to_guests: boolean
  position: number
  created_at: string
  // join opcional para UI
  event_supplier?: { id: string; supplier?: { id: string; name: string } | null } | null
}
```

Etiquetas y colores de fase (`PHASE_LABEL`, `PHASE_COLOR`) junto al resto de constantes del módulo.

## 5. Contrato con la invitación RSVP

El itinerario es dueño de los datos; la invitación **consume y pinta**, no guarda copia.

Función pura/lectura expuesta desde `lib/` (nombre tentativo `getGuestItinerary`):

```ts
// entrada: eventId
// salida: momentos visibles, curados y ordenados
interface GuestItineraryItem {
  start_time: string   // 'HH:MM'
  title: string
  location: string | null
}

async function getGuestItinerary(eventId: string): Promise<GuestItineraryItem[]>
// SELECT start_time, title, location
// FROM event_itinerary_moments
// WHERE event_id = eventId AND visible_to_guests = true
// ORDER BY (orden con cruce de medianoche, ver §7)
```

El agente de la invitación RSVP importa esta función (o su equivalente de query) y renderiza. No accede a columnas internas (`phase`, `notes`, `event_supplier_id`, `duration_min`).

## 5.5 Auto-generar con Claude

El planner puede pedirle a Claude un **run-of-show sugerido** en vez de armarlo desde cero (equivalente al "Generar plan sugerido" del timeline, pero para el día).

- **Entrada:** tipo de evento (`events.event_type`/`event_category`), y horas ancla que da el planner en un modal: hora de ceremonia, hora de cena/comida y hora de cierre (las tres opcionales, con defaults sensatos por tipo de evento). Opcional: venue/ubicación.
- **Modelo:** Claude Haiku (`claude-haiku-4-5-20251001`), mismo modelo que `lib/ai-rsvp.ts`.
- **Salida:** arreglo de momentos `{ title, start_time, duration_min, phase, location, notes, visible_to_guests }` — con `visible_to_guests` ya sugerido (montaje = false, ceremonia/social/cena/fiesta = true). El planner revisa y edita antes de guardar.
- **Endpoint:** `POST /api/itinerary/generate` (server, usa `ANTHROPIC_API_KEY`; el prompt vive en `lib/`). No persiste: devuelve los momentos y el cliente los mete a estado; el planner decide guardar.
- **Prompt grounded:** el prompt fija fases válidas, formato `HH:MM`, encadenado coherente (sin traslapes salvo intencional) y curado de visibilidad. Salida en JSON estricto, parseo defensivo.

## 6. UI / UX

### Pestaña

Se agrega "Itinerario" al switch de vistas del timeline (hoy Lista | Calendario). Icono reloj. Subrayado en oro cuando activa.

La pestaña solo tiene sentido con fecha de evento definida; si no hay `event_date`, mostrar estado vacío que invite a definirla (mismo patrón que "Generar plan sugerido").

### Vista "Hilo del día" (variante A)

- Columna izquierda: hora de inicio (grande, `tabular-nums`) + píldora de duración.
- Hilo vertical en oro con nodos que encadena los momentos.
- Tarjeta por momento: título, chips de responsable/proveedor (teal), ubicación (pin), fase (oro), y notas de guión.
- El fin de cada momento se calcula (`start_time + duration_min`); no se captura a mano.

### Compartir

- **Barra superior** con switch "Compartir en la invitación RSVP" (controla si el itinerario aparece en la invitación) + texto vivo "Los invitados ven N de M momentos".
- **Toggle por momento**: cada tarjeta tiene control de visibilidad. Visible = "Visible" (teal); oculto = "Solo interno" (ojo tachado, tarjeta atenuada con borde punteado).
- Botón "Ver como invitado" que muestra la vista curada (previsualización).

### Alta/edición de momento (modal)

Sigue el patrón de `TaskModal`: título, hora de inicio, duración, ubicación, fase, proveedor (select de `event_suppliers`), responsable libre, notas, y toggle `visible_to_guests`. Modales por preferencia del usuario (patrón existente).

### RBAC

Respetar `useEventAccess()`: `viewer` ve el itinerario en solo lectura (sin agregar/editar/eliminar, sin toggles). Gatear controles con `canEdit`.

## 7. Lógica pura testeable (Vitest)

Extraer a `app/events/[id]/timeline/lib/itinerary.ts` funciones puras (tests en `itinerary.test.ts` junto al módulo):

- **Encadenado de fin**: `computeEndTime(start_time, duration_min) → 'HH:MM' | null`.
- **Orden con cruce de medianoche**: los momentos de madrugada (ej. 01:00 de la fiesta) van *después* de los de la tarde. Regla: hora de corte del día (`DAY_START_HOUR = 6`); clave de orden = `((h < 6 ? h + 24 : h) * 60 + m)`, desempate por `position`.
- **Formato**: rango "18:00–18:40", duración "40 min" / "hasta cierre".
- **Curado para invitados**: filtra `visible_to_guests` y mapea a `GuestItineraryItem`.

Cubrir con tests: encadenado, orden con y sin cruce de medianoche, duración null, curado.

## 8. Integración con el timeline existente

- La pestaña se agrega en `timeline/page.tsx` sin tocar la lógica de Lista/Calendario (viven sobre `event_timeline_tasks`; el itinerario vive sobre `event_itinerary_moments`, aislado).
- Componentes nuevos: `ItineraryView`, `MomentCard`, `MomentModal` (o reutilizando estilos de `TaskCard`/`TaskModal` donde aplique, sin acoplarlos).
- Audit log opcional (`logAction`) para altas/ediciones/borrados de momentos, entidad `itinerary_moment`. Falla en silencio como el resto.

## 9. Consideraciones

- **Sincronía Supabase ↔ Vercel:** el `create table` y los cambios de `lib/types.ts` se aplican **después** de que el código correspondiente esté en `main`. Local → preview → main.
- **Seed:** sin seed automático al entrar (a diferencia de presupuesto). La generación es a demanda vía "Auto-generar con Claude" (§5.5).
- **Orden de construcción v1:** UI con estado en memoria (mock) + endpoint de IA primero, para ver el flujo local sin tocar la Supabase compartida. La persistencia (`create table` + wiring) entra después, con código en `main` antes de la SQL y con OK explícito de Diego.
- **Aislamiento entre agentes:** implementar en worktree/rama propia para no chocar con los otros 3 agentes en vuelo.

## 10. Riesgos y dependencias

- **Dependencia cross-feature:** la invitación RSVP (otro agente) consume `getGuestItinerary`. Si su estructura cambia, solo se ajusta el punto de consumo, no el itinerario.
- **Cruce de medianoche:** cubierto por la lógica de orden con hora de corte; validado en tests.
- **RBAC viewer:** verificar que los controles de edición no se muestren a `viewer` (deuda conocida en otros módulos — no repetirla aquí).
