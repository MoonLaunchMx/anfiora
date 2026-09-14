# Itinerario de varios días — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un evento de varios días pueda planear cada día por separado, con la fecha real en cada momento, y que el invitado vea el itinerario agrupado por día.

**Architecture:** Una columna `moment_date` en `event_itinerary_moments` convierte el itinerario de "un día largo" en "días reales". Los días no son una entidad: se derivan del rango `event_date → event_end_date`. La generación con IA se reemplaza por plantillas puras (una hora ancla más una tabla de desfases), lo que permite previsualizar antes de aplicar.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase, Vitest, Framer Motion, Lucide.

**Spec:** `docs/superpowers/specs/2026-08-08-itinerario-multidia-design.md`
**Mockup:** `docs/superpowers/specs/2026-08-08-itinerario-multidia-mockup.html`

## Global Constraints

- **Idioma UI:** español **con acentos**. Los mensajes de commit van **sin acentos ni ñ**.
- **Sin emojis** en ninguna superficie. Iconos de `lucide-react`.
- **Solo Tailwind CSS.** Sin inline styles salvo tokens de color que ya existan en el archivo.
- **Botones CTA en teal `#48C9B0`.** El negro `#1D1E20` es exclusivo de dropdowns de filtro: aquí no aplica.
- **Sin `confirm()` del navegador.** Cualquier confirmación usa el primitivo `ConfirmModal`.
- **Nunca ejecutar SQL en Supabase.** El archivo `.sql` se escribe y se deja; lo corre Diego.
- **No pushear a `main`** ni abrir PR sin OK explícito.
- **Sin comentarios** salvo cuando el *por qué* no sea obvio.
- Tests con Vitest sólo para lógica pura. Correr con `npm test`.
- Verificación de tipos: `npx tsc --noEmit`. El lint del repo tiene ~158 mil problemas preexistentes; **no** correr `npm run lint` completo, sólo mirar el archivo tocado si hace falta.

## Estructura de archivos

**Se crean:**
- `docs/superpowers/plans/sql/2026-08-08-itinerario-multidia.sql` — la columna, el backfill y el índice
- `lib/itinerary-templates.ts` — tipos de día, plantillas y `expandTemplate`
- `lib/itinerary-templates.test.ts`
- `app/events/[id]/timeline/DayLine.tsx` — la línea del día que crece con el scroll
- `app/events/[id]/timeline/DayTemplateModal.tsx` — elegir tipo de día y previsualizar

**Se modifican:**
- `lib/types.ts` — `ItineraryMoment.moment_date`, `GuestItineraryDay`
- `lib/itinerary.ts` — orden por fecha, `eventDays`, `groupByDay`, `dayLabel`, `curateForGuests`
- `lib/itinerary.test.ts` — se van los tests del corte de las 6 am
- `lib/guest-itinerary.ts` — devuelve días
- `app/api/invitacion/[token]/route.ts` — lee `moment_date`
- `app/components/invitacion/types.ts` — el tipo de `ctx.itinerary`
- `app/components/invitacion/sections/ItinerarioSection.tsx` — encabezado por día
- `app/invitacion/preview/[id]/page.tsx` y `app/invitacion/[slug]/[token]/InvitacionClient.tsx` — si construyen `ctx.itinerary` a mano
- `app/events/[id]/timeline/useItinerary.ts` — escribe y agrupa por fecha
- `app/events/[id]/timeline/MomentModal.tsx` — campo de fecha
- `app/events/[id]/timeline/ItineraryView.tsx` — lista continua con días
- `app/events/[id]/timeline/ItineraryToolbar.tsx` — el botón deja de decir "Autogenerar"

**Se borran:**
- `lib/itinerary-ai.ts`, `lib/itinerary-ai.test.ts`
- `app/api/itinerary/generate/route.ts`
- `app/events/[id]/timeline/GenerateItineraryModal.tsx`

---

### Task 1: La columna, los tipos y los días del rango

**Files:**
- Create: `docs/superpowers/plans/sql/2026-08-08-itinerario-multidia.sql`
- Modify: `lib/types.ts:761-782`
- Modify: `lib/itinerary.ts`
- Test: `lib/itinerary.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `ItineraryMoment.moment_date: string`, `GuestItineraryDay`, `eventDays(eventDate, eventEndDate): string[]`, `addDays(iso, n): string`

- [ ] **Step 1: Escribir el SQL (no ejecutarlo)**

Crear `docs/superpowers/plans/sql/2026-08-08-itinerario-multidia.sql`:

```sql
-- NO EJECUTAR sin OK explicito de Diego.
-- Orden: correr los pasos 1 y 2, desplegar el codigo, y hasta entonces el paso 3.

-- 1. La columna, nullable para no romper las filas que ya existen
alter table event_itinerary_moments add column moment_date date;

-- 2. Backfill: todo lo que ya existe cae en la fecha de inicio del evento
update event_itinerary_moments m
   set moment_date = e.event_date
  from events e
 where e.id = m.event_id
   and m.moment_date is null;

create index on event_itinerary_moments (event_id, moment_date);

-- 3. Solo despues de que el codigo este en main
alter table event_itinerary_moments alter column moment_date set not null;
```

- [ ] **Step 2: Escribir el test que falla**

En `lib/itinerary.test.ts`, agregar el import de `eventDays` y `addDays` al bloque de imports existente, y agregar al final del archivo:

```ts
describe('addDays', () => {
  it('suma y resta dias sin correrse por zona horaria', () => {
    expect(addDays('2026-09-12', 1)).toBe('2026-09-13')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-09-12', 0)).toBe('2026-09-12')
  })
})

describe('eventDays', () => {
  it('rango de varios dias devuelve cada fecha', () => {
    expect(eventDays('2026-09-12', '2026-09-14')).toEqual(['2026-09-12', '2026-09-13', '2026-09-14'])
  })
  it('sin fecha de fin es un solo dia', () => {
    expect(eventDays('2026-09-12', null)).toEqual(['2026-09-12'])
  })
  it('fecha de fin igual a la de inicio es un solo dia', () => {
    expect(eventDays('2026-09-12', '2026-09-12')).toEqual(['2026-09-12'])
  })
  it('fecha de fin anterior a la de inicio se ignora', () => {
    expect(eventDays('2026-09-12', '2026-09-10')).toEqual(['2026-09-12'])
  })
  it('sin fecha de inicio no hay dias', () => {
    expect(eventDays(null, '2026-09-14')).toEqual([])
  })
})
```

- [ ] **Step 3: Correr el test y verlo fallar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: FAIL — `addDays is not a function` / `eventDays is not a function`

- [ ] **Step 4: Agregar el campo al tipo**

En `lib/types.ts`, dentro de `ItineraryMoment`, después de `start_time`:

```ts
  moment_date: string           // 'YYYY-MM-DD'
```

Y debajo de `GuestItineraryItem`:

```ts
export interface GuestItineraryDay {
  date: string                  // 'YYYY-MM-DD'
  label: string                 // 'Sábado 13'
  items: GuestItineraryItem[]
}
```

- [ ] **Step 5: Implementar en `lib/itinerary.ts`**

Agregar al final del archivo. Las fechas se manejan en UTC a propósito: `new Date('2026-09-12')` es medianoche UTC, y sumar días ahí evita que un huso horario negativo devuelva el día anterior.

```ts
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function eventDays(eventDate: string | null, eventEndDate: string | null): string[] {
  if (!eventDate) return []
  const start = eventDate.slice(0, 10)
  const end = eventEndDate ? eventEndDate.slice(0, 10) : start
  if (end <= start) return [start]
  const days: string[] = []
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) days.push(cur)
  return days
}
```

- [ ] **Step 6: Correr el test y verlo pasar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/sql/2026-08-08-itinerario-multidia.sql lib/types.ts lib/itinerary.ts lib/itinerary.test.ts
git commit -m "feat(itinerario): moment_date y los dias del rango del evento"
```

---

### Task 2: El día acaba a las 12 am

Se va el corte de las 6 am. El orden pasa a ser por fecha, luego hora, luego posición.

**Files:**
- Modify: `lib/itinerary.ts:3-5,69-83`
- Test: `lib/itinerary.test.ts:8,11,90-118`

**Interfaces:**
- Consumes: `addDays` (Task 1)
- Produces: `sortMoments` ordenando por `(moment_date, start_time, position)`. Desaparecen `DAY_START_HOUR` y `momentOrderMinutes`.

- [ ] **Step 1: Cambiar los tests**

En `lib/itinerary.test.ts`: quitar `momentOrderMinutes` y `DAY_START_HOUR` del bloque de imports, borrar el `describe('momentOrderMinutes (cruce de medianoche)')` completo (líneas 90-99), y reemplazar el `describe('sortMoments')` por:

```ts
describe('sortMoments', () => {
  it('ordena por fecha antes que por hora', () => {
    const ms = [
      moment({ id: 'domingo', moment_date: '2026-09-14', start_time: '12:00' }),
      moment({ id: 'sabado-madrugada', moment_date: '2026-09-13', start_time: '02:00' }),
      moment({ id: 'viernes', moment_date: '2026-09-12', start_time: '20:00' }),
    ]
    expect(sortMoments(ms).map(m => m.id)).toEqual(['viernes', 'sabado-madrugada', 'domingo'])
  })
  it('dentro del mismo dia la madrugada va primero, sin trucos', () => {
    const ms = [
      moment({ id: 'cena', moment_date: '2026-09-13', start_time: '20:00' }),
      moment({ id: 'madrugada', moment_date: '2026-09-13', start_time: '01:00' }),
    ]
    expect(sortMoments(ms).map(m => m.id)).toEqual(['madrugada', 'cena'])
  })
  it('mismo inicio -> respeta position', () => {
    const ms = [
      moment({ id: 'b', moment_date: '2026-09-13', start_time: '18:00', position: 2 }),
      moment({ id: 'a', moment_date: '2026-09-13', start_time: '18:00', position: 1 }),
    ]
    expect(sortMoments(ms).map(m => m.id)).toEqual(['a', 'b'])
  })
})
```

En el helper `moment()` (línea 17), agregar dentro del objeto que devuelve:

```ts
    moment_date: partial.moment_date ?? '2026-09-13',
```

En el `describe('curateForGuests')` (línea 120), los tres momentos necesitan `moment_date`. Este test se reescribe entero en la Task 4; por ahora sólo agregar `moment_date: '2026-09-13'` a los tres y cambiar el resultado esperado a que la fiesta de la 01:00 vaya **primero**:

```ts
    expect(curateForGuests(ms)).toEqual([
      { start_time: '01:00', title: 'Fiesta', location: null },
      { start_time: '18:00', title: 'Ceremonia', location: 'Jardin' },
    ])
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: FAIL — el orden sigue metiendo la madrugada al final

- [ ] **Step 3: Implementar**

En `lib/itinerary.ts`, borrar el bloque de comentario más `DAY_START_HOUR` (líneas 3-5) y la función `momentOrderMinutes` (líneas 69-74). Reemplazar `sortMoments`:

```ts
export function sortMoments<T extends { moment_date: string; start_time: string; position: number }>(moments: T[]): T[] {
  return [...moments].sort((a, b) => {
    if (a.moment_date !== b.moment_date) return a.moment_date < b.moment_date ? -1 : 1
    const ta = parseTimeToMinutes(a.start_time) ?? Number.MAX_SAFE_INTEGER
    const tb = parseTimeToMinutes(b.start_time) ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    return a.position - b.position
  })
}
```

Ajustar el tipo `CurateInput` (línea 85) para que incluya `moment_date`:

```ts
type CurateInput = Pick<ItineraryMoment, 'moment_date' | 'start_time' | 'title' | 'location' | 'visible_to_guests' | 'position'>
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: PASS

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: fallan sólo los archivos que aún no escriben `moment_date` (`useItinerary.ts`, `guest-itinerary.ts`, la ruta de invitación). Se arreglan en las tasks 4 y 7.

- [ ] **Step 6: Commit**

```bash
git add lib/itinerary.ts lib/itinerary.test.ts
git commit -m "refactor(itinerario): el dia acaba a medianoche, se va el corte de las 6am"
```

---

### Task 3: Agrupar por día y detectar huérfanos

**Files:**
- Modify: `lib/itinerary.ts`
- Test: `lib/itinerary.test.ts`

**Interfaces:**
- Consumes: `eventDays`, `sortMoments`
- Produces: `dayLabel(iso): { dow: string; num: string }`, `groupByDay<T>(moments, days): { inRange: DayGroup<T>[]; orphans: DayGroup<T>[] }` con `DayGroup<T> = { date: string; moments: T[] }`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar el import de `dayLabel` y `groupByDay`, y al final de `lib/itinerary.test.ts`:

```ts
describe('dayLabel', () => {
  it('devuelve dia de la semana y fecha corta en espanol', () => {
    expect(dayLabel('2026-09-12')).toEqual({ dow: 'Sábado', num: '12 sep' })
    expect(dayLabel('2026-09-14')).toEqual({ dow: 'Lunes', num: '14 sep' })
  })
})

describe('groupByDay', () => {
  const days = ['2026-09-12', '2026-09-13']
  it('agrupa cada momento en su dia y respeta el orden', () => {
    const ms = [
      moment({ id: 'sab', moment_date: '2026-09-13', start_time: '18:00' }),
      moment({ id: 'vie2', moment_date: '2026-09-12', start_time: '21:00' }),
      moment({ id: 'vie1', moment_date: '2026-09-12', start_time: '19:00' }),
    ]
    const { inRange, orphans } = groupByDay(ms, days)
    expect(inRange.map(g => g.date)).toEqual(['2026-09-12', '2026-09-13'])
    expect(inRange[0].moments.map(m => m.id)).toEqual(['vie1', 'vie2'])
    expect(orphans).toEqual([])
  })
  it('incluye los dias del rango que no tienen momentos', () => {
    const { inRange } = groupByDay([], days)
    expect(inRange).toEqual([
      { date: '2026-09-12', moments: [] },
      { date: '2026-09-13', moments: [] },
    ])
  })
  it('lo que cae fuera del rango sale como huerfano', () => {
    const ms = [
      moment({ id: 'dom', moment_date: '2026-09-14', start_time: '12:00' }),
      moment({ id: 'sab', moment_date: '2026-09-13', start_time: '18:00' }),
    ]
    const { inRange, orphans } = groupByDay(ms, days)
    expect(orphans.map(g => g.date)).toEqual(['2026-09-14'])
    expect(orphans[0].moments.map(m => m.id)).toEqual(['dom'])
    expect(inRange[1].moments.map(m => m.id)).toEqual(['sab'])
  })
  it('sin rango todo es huerfano', () => {
    const ms = [moment({ id: 'x', moment_date: '2026-09-13' })]
    expect(groupByDay(ms, []).orphans.map(g => g.date)).toEqual(['2026-09-13'])
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: FAIL — `dayLabel is not a function`

- [ ] **Step 3: Implementar**

En `lib/itinerary.ts`. Los nombres se escriben a mano en vez de usar `toLocaleDateString` porque el runtime de Node en CI no siempre trae el locale `es` completo.

```ts
const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function dayLabel(iso: string): { dow: string; num: string } {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return {
    dow: DOW[d.getUTCDay()],
    num: `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`,
  }
}

export interface DayGroup<T> {
  date: string
  moments: T[]
}

export function groupByDay<T extends { moment_date: string; start_time: string; position: number }>(
  moments: T[],
  days: string[],
): { inRange: DayGroup<T>[]; orphans: DayGroup<T>[] } {
  const sorted = sortMoments(moments)
  const inRange: DayGroup<T>[] = days.map(date => ({ date, moments: [] }))
  const byDate = new Map(inRange.map(g => [g.date, g]))
  const orphanMap = new Map<string, DayGroup<T>>()

  for (const m of sorted) {
    const target = byDate.get(m.moment_date)
    if (target) { target.moments.push(m); continue }
    let group = orphanMap.get(m.moment_date)
    if (!group) { group = { date: m.moment_date, moments: [] }; orphanMap.set(m.moment_date, group) }
    group.moments.push(m)
  }

  return { inRange, orphans: [...orphanMap.values()].sort((a, b) => a.date < b.date ? -1 : 1) }
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/itinerary.ts lib/itinerary.test.ts
git commit -m "feat(itinerario): agrupar momentos por dia y detectar dias huerfanos"
```

---

### Task 4: El invitado ve días

**Files:**
- Modify: `lib/itinerary.ts:85-96`
- Modify: `lib/guest-itinerary.ts`
- Modify: `app/api/invitacion/[token]/route.ts:122-123,177`
- Modify: `app/components/invitacion/types.ts`
- Modify: `app/components/invitacion/sections/ItinerarioSection.tsx`
- Test: `lib/itinerary.test.ts:120-132`

**Interfaces:**
- Consumes: `groupByDay`, `dayLabel`, `GuestItineraryDay`
- Produces: `curateForGuests(moments): GuestItineraryDay[]`, `getGuestItinerary(eventId, eventDate, eventEndDate): Promise<GuestItineraryDay[]>`

- [ ] **Step 1: Reescribir el test de `curateForGuests`**

Reemplazar el `describe('curateForGuests')` completo:

```ts
describe('curateForGuests', () => {
  it('agrupa por dia, filtra ocultos y omite los dias vacios', () => {
    const ms = [
      moment({ id: 'oculto', moment_date: '2026-09-12', start_time: '09:00', visible_to_guests: false }),
      moment({ id: 'cena', title: 'Cena', moment_date: '2026-09-13', start_time: '20:30', location: 'Salon', visible_to_guests: true }),
      moment({ id: 'rompe', title: 'Rompehielos', moment_date: '2026-09-12', start_time: '20:00', visible_to_guests: true }),
      moment({ id: 'cierre', title: 'Cierre', moment_date: '2026-09-14', start_time: '03:00', visible_to_guests: true }),
    ]
    expect(curateForGuests(ms, ['2026-09-12', '2026-09-13', '2026-09-14'])).toEqual([
      { date: '2026-09-12', label: 'Sábado 12', items: [{ start_time: '20:00', title: 'Rompehielos', location: null }] },
      { date: '2026-09-13', label: 'Domingo 13', items: [{ start_time: '20:30', title: 'Cena', location: 'Salon' }] },
      { date: '2026-09-14', label: 'Lunes 14', items: [{ start_time: '03:00', title: 'Cierre', location: null }] },
    ])
  })
  it('un dia huerfano no se le muestra al invitado', () => {
    const ms = [moment({ id: 'fuera', title: 'Tornaboda', moment_date: '2026-09-20', start_time: '12:00', visible_to_guests: true })]
    expect(curateForGuests(ms, ['2026-09-12'])).toEqual([])
  })
  it('sin momentos visibles devuelve vacio', () => {
    const ms = [moment({ moment_date: '2026-09-12', visible_to_guests: false })]
    expect(curateForGuests(ms, ['2026-09-12'])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: FAIL — `curateForGuests` devuelve una lista plana

- [ ] **Step 3: Implementar `curateForGuests`**

Reemplazar la función en `lib/itinerary.ts` (líneas 85-96):

```ts
type CurateInput = Pick<ItineraryMoment, 'moment_date' | 'start_time' | 'title' | 'location' | 'visible_to_guests' | 'position'>

export function curateForGuests(moments: CurateInput[], days: string[]): GuestItineraryDay[] {
  const { inRange } = groupByDay(moments.filter(m => m.visible_to_guests), days)
  return inRange
    .filter(g => g.moments.length > 0)
    .map(g => {
      const { dow, num } = dayLabel(g.date)
      return {
        date: g.date,
        label: `${dow} ${num.split(' ')[0]}`,
        items: g.moments.map(m => {
          const mins = parseTimeToMinutes(m.start_time)
          return {
            start_time: mins === null ? m.start_time : formatMinutesToHHMM(mins),
            title: m.title,
            location: m.location,
          }
        }),
      }
    })
}
```

Actualizar el import de tipos al inicio del archivo para incluir `GuestItineraryDay`.

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test -- lib/itinerary.test.ts`
Expected: PASS

- [ ] **Step 5: Actualizar los consumidores**

`lib/guest-itinerary.ts` completo:

```ts
import { supabase } from '@/lib/supabase'
import { curateForGuests, eventDays } from '@/lib/itinerary'
import type { ItineraryMoment, GuestItineraryDay } from '@/lib/types'

// Contrato de solo lectura para la invitacion RSVP.
// Devuelve los dias visibles, curados y ordenados.
// La invitacion NO accede a columnas internas (phase, notes, duration_min, etc).
export async function getGuestItinerary(
  eventId: string,
  eventDate: string | null,
  eventEndDate: string | null,
): Promise<GuestItineraryDay[]> {
  const { data } = await supabase
    .from('event_itinerary_moments')
    .select('moment_date, start_time, title, location, visible_to_guests, position')
    .eq('event_id', eventId)
    .eq('visible_to_guests', true)
  return curateForGuests((data || []) as ItineraryMoment[], eventDays(eventDate, eventEndDate))
}
```

En `app/api/invitacion/[token]/route.ts`, línea 122-123, agregar `moment_date` al select y al tipo del `safeList`:

```ts
    safeList<{ moment_date: string; start_time: string; title: string; location: string | null; visible_to_guests: boolean; position: number }>(
      db.from('event_itinerary_moments').select('moment_date, start_time, title, location, visible_to_guests, position').eq('event_id', eventId).eq('visible_to_guests', true),
    ),
```

Y en la línea 177, pasar los días del rango. El objeto `event` ya viene de la query de arriba; usar sus campos:

```ts
    itinerary: curateForGuests(itin, eventDays(event.event_date, event.event_end_date)),
```

Agregar `eventDays` al import de `@/lib/itinerary` (línea 6). Si el select de `event` no trae `event_end_date`, agregarlo a esa query.

En `app/components/invitacion/types.ts`, cambiar el tipo del campo `itinerary` de `GuestItineraryItem[]` a `GuestItineraryDay[]` e importar el tipo nuevo.

- [ ] **Step 6: Pintar los días en la invitación**

Reemplazar el `return` de `app/components/invitacion/sections/ItinerarioSection.tsx` (líneas 21-49). Con un solo día no se dibuja el encabezado, para que la invitación de siempre se vea igual:

```tsx
  const varios = ctx.itinerary.length > 1

  return (
    <SectionShell variant="band">
      <h2 className="px-2 text-center text-xl font-semibold lg:text-2xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
        {content.titulo}
      </h2>

      <div className="mx-auto mt-8 flex max-w-md flex-col gap-6">
        {ctx.itinerary.map(day => (
          <div key={day.date}>
            {varios && (
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--inv-acento)' }}>
                  {day.label}
                </span>
                <span className="h-px flex-1 bg-[#e8e8e8]" />
              </div>
            )}
            <ol className="flex flex-col gap-0">
              {day.items.map((item, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ color: 'var(--inv-acento)', background: 'var(--inv-acento-bg)' }}>
                      <Clock size={13} />
                    </span>
                    {i < day.items.length - 1 && <span className="my-1 w-px flex-1 bg-[#e8e8e8]" />}
                  </div>
                  <div className="pb-6">
                    <p className="text-xs font-semibold" style={{ color: 'var(--inv-acento)' }}>{item.start_time}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--inv-texto)' }}>{item.title}</p>
                    {item.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs opacity-70" style={{ color: 'var(--inv-texto)' }}>
                        <MapPin size={12} /> {item.location}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </SectionShell>
  )
```

- [ ] **Step 7: Buscar los que faltan**

Run: `npx tsc --noEmit`

Arreglar cualquier error en `app/invitacion/preview/[id]/page.tsx` y `app/invitacion/[slug]/[token]/InvitacionClient.tsx`: si construyen `ctx.itinerary` a mano, pasarles `GuestItineraryDay[]`. Un preview vacío es `[]`.

Expected: sólo quedan errores en `useItinerary.ts` (Task 7).

- [ ] **Step 8: Commit**

```bash
git add lib/itinerary.ts lib/itinerary.test.ts lib/guest-itinerary.ts app/api/invitacion app/components/invitacion app/invitacion
git commit -m "feat(invitacion): el itinerario se agrupa por dia"
```

---

### Task 5: El motor de plantillas

**Files:**
- Create: `lib/itinerary-templates.ts`
- Test: `lib/itinerary-templates.test.ts`

**Interfaces:**
- Consumes: `parseTimeToMinutes`, `formatMinutesToHHMM`, `addDays`, `ItineraryPhase`
- Produces: `DayTypeKey`, `TemplateStep`, `DayTemplate`, `TemplateMoment`, `expandTemplate(tpl, anchorTime, dayDate): TemplateMoment[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/itinerary-templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { expandTemplate, type DayTemplate } from './itinerary-templates'

const tpl: DayTemplate = {
  key: 'principal',
  anchorLabel: 'Ceremonia',
  defaultAnchorTime: '17:30',
  steps: [
    { offsetMin: -30, title: 'Llegada',   durationMin: 30,   phase: 'social',    visible: true },
    { offsetMin: 0,   title: 'Ceremonia', durationMin: 45,   phase: 'ceremonia', visible: true },
    { offsetMin: 450, title: 'Tornafiesta', durationMin: null, phase: 'fiesta',  visible: true },
    { offsetMin: 570, title: 'Cierre',    durationMin: null, phase: 'otro',      visible: false },
  ],
}

describe('expandTemplate', () => {
  it('coloca cada paso segun su desfase desde el ancla', () => {
    const out = expandTemplate(tpl, '17:30', '2026-09-13')
    expect(out[0]).toEqual({ moment_date: '2026-09-13', start_time: '17:00', title: 'Llegada',   duration_min: 30,   phase: 'social',    visible_to_guests: true })
    expect(out[1]).toEqual({ moment_date: '2026-09-13', start_time: '17:30', title: 'Ceremonia', duration_min: 45,   phase: 'ceremonia', visible_to_guests: true })
  })
  it('lo que pasa de medianoche corre al dia siguiente', () => {
    const out = expandTemplate(tpl, '17:30', '2026-09-13')
    expect(out[2]).toEqual({ moment_date: '2026-09-14', start_time: '01:00', title: 'Tornafiesta', duration_min: null, phase: 'fiesta', visible_to_guests: true })
    expect(out[3]).toEqual({ moment_date: '2026-09-14', start_time: '03:00', title: 'Cierre',      duration_min: null, phase: 'otro',   visible_to_guests: false })
  })
  it('mover el ancla mueve todo el dia', () => {
    const out = expandTemplate(tpl, '19:00', '2026-09-13')
    expect(out[0].start_time).toBe('18:30')
    expect(out[1].start_time).toBe('19:00')
  })
  it('un desfase negativo que cruza la medianoche cae el dia anterior', () => {
    const madrugada: DayTemplate = { ...tpl, steps: [{ offsetMin: -120, title: 'Montaje', durationMin: 60, phase: 'montaje', visible: false }] }
    const out = expandTemplate(madrugada, '00:30', '2026-09-13')
    expect(out[0]).toEqual({ moment_date: '2026-09-12', start_time: '22:30', title: 'Montaje', duration_min: 60, phase: 'montaje', visible_to_guests: false })
  })
  it('una hora ancla invalida devuelve vacio', () => {
    expect(expandTemplate(tpl, 'nope', '2026-09-13')).toEqual([])
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- lib/itinerary-templates.test.ts`
Expected: FAIL — no existe el módulo

- [ ] **Step 3: Implementar**

Crear `lib/itinerary-templates.ts`:

```ts
import { parseTimeToMinutes, formatMinutesToHHMM, addDays } from './itinerary'
import type { ItineraryPhase } from './types'

export type DayTypeKey =
  | 'montaje' | 'ensayo' | 'bienvenida' | 'principal'
  | 'sesiones' | 'noche' | 'siguiente' | 'despedida'

export interface TemplateStep {
  offsetMin: number
  title: string
  durationMin: number | null
  phase: ItineraryPhase
  visible: boolean
}

export interface DayTemplate {
  key: DayTypeKey
  anchorLabel: string
  defaultAnchorTime: string
  steps: TemplateStep[]
}

export interface TemplateMoment {
  moment_date: string
  start_time: string
  title: string
  duration_min: number | null
  phase: ItineraryPhase
  visible_to_guests: boolean
}

export function expandTemplate(tpl: DayTemplate, anchorTime: string, dayDate: string): TemplateMoment[] {
  const anchor = parseTimeToMinutes(anchorTime)
  if (anchor === null) return []
  return tpl.steps.map(s => {
    const abs = anchor + s.offsetMin
    const shift = Math.floor(abs / 1440)
    return {
      moment_date: shift === 0 ? dayDate : addDays(dayDate, shift),
      start_time: formatMinutesToHHMM(abs),
      title: s.title,
      duration_min: s.durationMin,
      phase: s.phase,
      visible_to_guests: s.visible,
    }
  })
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test -- lib/itinerary-templates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/itinerary-templates.ts lib/itinerary-templates.test.ts
git commit -m "feat(itinerario): motor de plantillas por tipo de dia"
```

---

### Task 6: El contenido de las plantillas

Ocho tipos de día compartidos; el nombre lo pone el evento. Tres niveles de resolución: la plantilla del evento gana, si no la de su categoría, si no la base.

**Files:**
- Modify: `lib/itinerary-templates.ts`
- Test: `lib/itinerary-templates.test.ts`

**Interfaces:**
- Consumes: `DayTemplate`, `DayTypeKey`, `EVENT_TYPES` de `lib/event-types.ts`
- Produces: `dayTypesFor(eventType): { key: DayTypeKey; label: string }[]`, `templateFor(eventType, key): DayTemplate`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `lib/itinerary-templates.test.ts`:

```ts
import { dayTypesFor, templateFor, DAY_TYPES_BY_EVENT } from './itinerary-templates'
import { EVENT_TYPES } from './event-types'

describe('dayTypesFor', () => {
  it('la boda ofrece sus seis dias con nombre mexicano', () => {
    expect(dayTypesFor('boda').map(d => d.label)).toEqual([
      'Montaje', 'Ensayo', 'Rompehielos', 'Día principal', 'Tornaboda', 'Despedida',
    ])
  })
  it('el mismo tipo de dia se llama distinto en otro evento', () => {
    expect(dayTypesFor('boda').find(d => d.key === 'bienvenida')?.label).toBe('Rompehielos')
    expect(dayTypesFor('retiro').find(d => d.key === 'bienvenida')?.label).toBe('Bienvenida')
    expect(dayTypesFor('xv').find(d => d.key === 'siguiente')?.label).toBe('Tornafiesta')
  })
  it('los 17 tipos de evento tienen al menos un dia', () => {
    for (const t of EVENT_TYPES) {
      expect(dayTypesFor(t.value).length).toBeGreaterThan(0)
    }
  })
  it('un tipo desconocido cae en el generico social', () => {
    expect(dayTypesFor('inventado').length).toBeGreaterThan(0)
  })
})

describe('templateFor', () => {
  it('la boda tiene plantilla propia de dia principal', () => {
    const t = templateFor('boda', 'principal')
    expect(t.anchorLabel).toBe('Ceremonia')
    expect(t.steps.some(s => s.title === 'Vals')).toBe(true)
  })
  it('la boda tiene plantilla propia de rompehielos', () => {
    expect(templateFor('boda', 'bienvenida').steps.some(s => s.title === 'Rompehielos')).toBe(true)
  })
  it('un congreso cae en la plantilla de su categoria', () => {
    const t = templateFor('congreso', 'sesiones')
    expect(t.steps.some(s => s.title === 'Coffee break')).toBe(true)
  })
  it('un bautizo sin plantilla propia cae en la generica social', () => {
    expect(templateFor('bautizo', 'principal').steps.length).toBeGreaterThan(0)
  })
  it('todo par (evento, dia) que se ofrece resuelve a una plantilla con pasos', () => {
    for (const t of EVENT_TYPES) {
      for (const d of dayTypesFor(t.value)) {
        expect(templateFor(t.value, d.key).steps.length).toBeGreaterThan(0)
      }
    }
  })
  it('el montaje nace oculto y la ceremonia visible', () => {
    const t = templateFor('boda', 'principal')
    expect(t.steps.find(s => s.phase === 'montaje')?.visible).toBe(false)
    expect(t.steps.find(s => s.title === 'Ceremonia')?.visible).toBe(true)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- lib/itinerary-templates.test.ts`
Expected: FAIL — `dayTypesFor is not a function`

- [ ] **Step 3: Escribir las plantillas base**

Agregar a `lib/itinerary-templates.ts`:

```ts
const BASE_TEMPLATES: Record<DayTypeKey, DayTemplate> = {
  montaje: {
    key: 'montaje', anchorLabel: 'Inicio del montaje', defaultAnchorTime: '09:00',
    steps: [
      { offsetMin: 0,   title: 'Montaje del venue',  durationMin: 180, phase: 'montaje', visible: false },
      { offsetMin: 180, title: 'Prueba de audio',    durationMin: 60,  phase: 'montaje', visible: false },
      { offsetMin: 240, title: 'Llegada de flores',  durationMin: 60,  phase: 'montaje', visible: false },
      { offsetMin: 360, title: 'Revision final',     durationMin: 60,  phase: 'montaje', visible: false },
    ],
  },
  ensayo: {
    key: 'ensayo', anchorLabel: 'Ensayo', defaultAnchorTime: '17:00',
    steps: [
      { offsetMin: 0,   title: 'Ensayo de la ceremonia', durationMin: 60,  phase: 'ceremonia', visible: false },
      { offsetMin: 120, title: 'Cena de ensayo',         durationMin: 120, phase: 'cena',      visible: true },
    ],
  },
  bienvenida: {
    key: 'bienvenida', anchorLabel: 'Recepcion', defaultAnchorTime: '19:00',
    steps: [
      { offsetMin: -180, title: 'Montaje',              durationMin: 120, phase: 'montaje', visible: false },
      { offsetMin: -60,  title: 'Llegada de foraneos',  durationMin: 60,  phase: 'social',  visible: true },
      { offsetMin: 0,    title: 'Recepcion',            durationMin: 90,  phase: 'social',  visible: true },
      { offsetMin: 120,  title: 'Cena informal',        durationMin: 120, phase: 'cena',    visible: true },
      { offsetMin: 300,  title: 'Cierre',               durationMin: null, phase: 'otro',   visible: false },
    ],
  },
  principal: {
    key: 'principal', anchorLabel: 'Inicio', defaultAnchorTime: '18:00',
    steps: [
      { offsetMin: -240, title: 'Montaje',    durationMin: 180,  phase: 'montaje', visible: false },
      { offsetMin: 0,    title: 'Recepcion',  durationMin: 60,   phase: 'social',  visible: true },
      { offsetMin: 60,   title: 'Cena',       durationMin: 90,   phase: 'cena',    visible: true },
      { offsetMin: 150,  title: 'Brindis',    durationMin: 15,   phase: 'social',  visible: true },
      { offsetMin: 180,  title: 'Fiesta',     durationMin: null, phase: 'fiesta',  visible: true },
      { offsetMin: 420,  title: 'Cierre',     durationMin: null, phase: 'otro',    visible: false },
    ],
  },
  sesiones: {
    key: 'sesiones', anchorLabel: 'Apertura', defaultAnchorTime: '09:00',
    steps: [
      { offsetMin: -90, title: 'Montaje y pruebas',     durationMin: 60,  phase: 'montaje', visible: false },
      { offsetMin: -30, title: 'Registro',              durationMin: 30,  phase: 'social',  visible: true },
      { offsetMin: 0,   title: 'Apertura',              durationMin: 30,  phase: 'otro',    visible: true },
      { offsetMin: 30,  title: 'Sesion de la manana',   durationMin: 90,  phase: 'otro',    visible: true },
      { offsetMin: 120, title: 'Coffee break',          durationMin: 30,  phase: 'social',  visible: true },
      { offsetMin: 150, title: 'Panel',                 durationMin: 90,  phase: 'otro',    visible: true },
      { offsetMin: 240, title: 'Comida',                durationMin: 90,  phase: 'cena',    visible: true },
      { offsetMin: 330, title: 'Talleres',              durationMin: 120, phase: 'otro',    visible: true },
      { offsetMin: 450, title: 'Cierre del dia',        durationMin: 30,  phase: 'otro',    visible: true },
    ],
  },
  noche: {
    key: 'noche', anchorLabel: 'Inicio de la noche', defaultAnchorTime: '20:00',
    steps: [
      { offsetMin: -90, title: 'Montaje',        durationMin: 60,   phase: 'montaje', visible: false },
      { offsetMin: 0,   title: 'Coctel',         durationMin: 60,   phase: 'social',  visible: true },
      { offsetMin: 60,  title: 'Cena',           durationMin: 90,   phase: 'cena',    visible: true },
      { offsetMin: 150, title: 'Musica en vivo', durationMin: null, phase: 'fiesta',  visible: true },
      { offsetMin: 360, title: 'Cierre',         durationMin: null, phase: 'otro',    visible: false },
    ],
  },
  siguiente: {
    key: 'siguiente', anchorLabel: 'Inicio', defaultAnchorTime: '12:00',
    steps: [
      { offsetMin: -60, title: 'Montaje',    durationMin: 60,   phase: 'montaje', visible: false },
      { offsetMin: 0,   title: 'Brunch',     durationMin: 120,  phase: 'cena',    visible: true },
      { offsetMin: 120, title: 'Alberca',    durationMin: 180,  phase: 'social',  visible: true },
      { offsetMin: 300, title: 'Cierre',     durationMin: null, phase: 'otro',    visible: false },
    ],
  },
  despedida: {
    key: 'despedida', anchorLabel: 'Check-out', defaultAnchorTime: '11:00',
    steps: [
      { offsetMin: 0,   title: 'Check-out',       durationMin: 120, phase: 'otro', visible: true },
      { offsetMin: 120, title: 'Ultima comida',   durationMin: 90,  phase: 'cena', visible: true },
      { offsetMin: 300, title: 'Traslados',       durationMin: null, phase: 'otro', visible: true },
    ],
  },
}
```

- [ ] **Step 4: Escribir las plantillas propias y la resolución**

Seguir en el mismo archivo:

```ts
const BODA_PRINCIPAL: DayTemplate = {
  key: 'principal', anchorLabel: 'Ceremonia', defaultAnchorTime: '17:30',
  steps: [
    { offsetMin: -480, title: 'Montaje del venue',   durationMin: 240,  phase: 'montaje',   visible: false },
    { offsetMin: -30,  title: 'Llegada de invitados', durationMin: 30,  phase: 'social',    visible: true },
    { offsetMin: 0,    title: 'Ceremonia',            durationMin: 45,  phase: 'ceremonia', visible: true },
    { offsetMin: 45,   title: 'Sesion de fotos',      durationMin: 30,  phase: 'otro',      visible: false },
    { offsetMin: 60,   title: 'Coctel',               durationMin: 120, phase: 'social',    visible: true },
    { offsetMin: 180,  title: 'Cena',                 durationMin: 75,  phase: 'cena',      visible: true },
    { offsetMin: 255,  title: 'Primer baile',         durationMin: 15,  phase: 'fiesta',    visible: true },
    { offsetMin: 270,  title: 'Vals',                 durationMin: 20,  phase: 'fiesta',    visible: true },
    { offsetMin: 300,  title: 'Abre la pista',        durationMin: null, phase: 'fiesta',   visible: true },
    { offsetMin: 450,  title: 'Tornafiesta',          durationMin: null, phase: 'fiesta',   visible: true },
    { offsetMin: 570,  title: 'Cierre',               durationMin: null, phase: 'otro',     visible: false },
  ],
}

const BODA_ROMPEHIELOS: DayTemplate = {
  key: 'bienvenida', anchorLabel: 'Rompehielos', defaultAnchorTime: '20:00',
  steps: [
    { offsetMin: -180, title: 'Montaje',             durationMin: 120,  phase: 'montaje', visible: false },
    { offsetMin: -60,  title: 'Llegada de foraneos', durationMin: 60,   phase: 'social',  visible: true },
    { offsetMin: 0,    title: 'Rompehielos',         durationMin: 90,   phase: 'social',  visible: true },
    { offsetMin: 90,   title: 'Cena informal',       durationMin: 120,  phase: 'cena',    visible: true },
    { offsetMin: 300,  title: 'Cierre',              durationMin: null, phase: 'otro',    visible: false },
  ],
}

const BODA_TORNABODA: DayTemplate = {
  key: 'siguiente', anchorLabel: 'Tornaboda', defaultAnchorTime: '12:00',
  steps: [
    { offsetMin: -60, title: 'Montaje',   durationMin: 60,   phase: 'montaje', visible: false },
    { offsetMin: 0,   title: 'Tornaboda', durationMin: 180,  phase: 'social',  visible: true },
    { offsetMin: 60,  title: 'Comida',    durationMin: 90,   phase: 'cena',    visible: true },
    { offsetMin: 240, title: 'Cierre',    durationMin: null, phase: 'otro',    visible: false },
  ],
}

const IMPACTO_SESIONES: DayTemplate = {
  key: 'sesiones', anchorLabel: 'Inicio del programa', defaultAnchorTime: '08:00',
  steps: [
    { offsetMin: -60, title: 'Montaje',              durationMin: 60,   phase: 'montaje', visible: false },
    { offsetMin: 0,   title: 'Desayuno',             durationMin: 60,   phase: 'cena',    visible: true },
    { offsetMin: 60,  title: 'Sesion de la manana',  durationMin: 120,  phase: 'otro',    visible: true },
    { offsetMin: 180, title: 'Descanso',             durationMin: 30,   phase: 'social',  visible: true },
    { offsetMin: 210, title: 'Dinamica grupal',      durationMin: 90,   phase: 'otro',    visible: true },
    { offsetMin: 330, title: 'Comida',               durationMin: 90,   phase: 'cena',    visible: true },
    { offsetMin: 420, title: 'Tiempo libre',         durationMin: 120,  phase: 'social',  visible: true },
    { offsetMin: 540, title: 'Sesion de la tarde',   durationMin: 90,   phase: 'otro',    visible: true },
    { offsetMin: 690, title: 'Cena',                 durationMin: 90,   phase: 'cena',    visible: true },
    { offsetMin: 810, title: 'Fogata',               durationMin: null, phase: 'fiesta',  visible: true },
  ],
}

const EVENT_TEMPLATES: Record<string, Partial<Record<DayTypeKey, DayTemplate>>> = {
  boda: { principal: BODA_PRINCIPAL, bienvenida: BODA_ROMPEHIELOS, siguiente: BODA_TORNABODA },
}

const CATEGORY_TEMPLATES: Record<string, Partial<Record<DayTypeKey, DayTemplate>>> = {
  social:      {},
  corporativo: {},
  impacto:     { sesiones: IMPACTO_SESIONES },
}

function categoryOf(eventType: string): string {
  return EVENT_TYPES.find(t => t.value === eventType)?.category ?? 'social'
}

export function templateFor(eventType: string, key: DayTypeKey): DayTemplate {
  return EVENT_TEMPLATES[eventType]?.[key]
    ?? CATEGORY_TEMPLATES[categoryOf(eventType)]?.[key]
    ?? BASE_TEMPLATES[key]
}
```

Agregar el import: `import { EVENT_TYPES } from './event-types'`.

- [ ] **Step 5: Escribir el mapa de días por evento**

La etiqueta es el nombre que usaría un planner de ese evento. Seguir en el mismo archivo:

```ts
type DayTypeEntry = { key: DayTypeKey; label: string }

const D = (key: DayTypeKey, label: string): DayTypeEntry => ({ key, label })

export const DAY_TYPES_BY_EVENT: Record<string, DayTypeEntry[]> = {
  boda:         [D('montaje','Montaje'), D('ensayo','Ensayo'), D('bienvenida','Rompehielos'), D('principal','Día principal'), D('siguiente','Tornaboda'), D('despedida','Despedida')],
  xv:           [D('montaje','Montaje'), D('ensayo','Ensayo'), D('principal','Día principal'), D('siguiente','Tornafiesta')],
  cumpleanos:   [D('montaje','Montaje'), D('principal','Día principal'), D('siguiente','Tornafiesta')],
  graduacion:   [D('montaje','Montaje'), D('principal','Día principal'), D('noche','Fiesta')],
  bautizo:      [D('montaje','Montaje'), D('principal','Día principal')],
  fiesta:       [D('montaje','Montaje'), D('principal','Día principal'), D('siguiente','Tornafiesta')],
  despedida:    [D('bienvenida','Bienvenida'), D('principal','Día principal'), D('noche','Noche'), D('despedida','Despedida')],
  conferencia:  [D('montaje','Montaje'), D('sesiones','Sesiones'), D('noche','Cena de gala'), D('despedida','Cierre')],
  capacitacion: [D('montaje','Montaje'), D('sesiones','Sesiones'), D('despedida','Cierre')],
  teambuilding: [D('bienvenida','Llegada'), D('sesiones','Actividades'), D('noche','Noche'), D('despedida','Salida')],
  lanzamiento:  [D('montaje','Montaje'), D('ensayo','Ensayo'), D('principal','Día del lanzamiento')],
  asamblea:     [D('montaje','Montaje'), D('sesiones','Sesiones')],
  retiro:       [D('bienvenida','Bienvenida'), D('sesiones','Programa'), D('noche','Noche'), D('despedida','Salida')],
  congreso:     [D('montaje','Montaje'), D('sesiones','Sesiones'), D('noche','Cena'), D('despedida','Cierre')],
  campamento:   [D('bienvenida','Llegada'), D('sesiones','Actividades'), D('noche','Fogata'), D('despedida','Salida')],
  caridad:      [D('montaje','Montaje'), D('principal','Día del evento')],
  otro:         [D('montaje','Montaje'), D('principal','Día principal'), D('despedida','Despedida')],
}

const FALLBACK_DAY_TYPES: DayTypeEntry[] = DAY_TYPES_BY_EVENT.otro

export function dayTypesFor(eventType: string | null): DayTypeEntry[] {
  if (!eventType) return FALLBACK_DAY_TYPES
  return DAY_TYPES_BY_EVENT[eventType] ?? FALLBACK_DAY_TYPES
}
```

- [ ] **Step 6: Correr y ver pasar**

Run: `npm test -- lib/itinerary-templates.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/itinerary-templates.ts lib/itinerary-templates.test.ts
git commit -m "feat(itinerario): plantillas de boda y genericas por categoria"
```

---

### Task 7: El hook y el modal de momento guardan la fecha

**Files:**
- Modify: `app/events/[id]/timeline/useItinerary.ts`
- Modify: `app/events/[id]/timeline/MomentModal.tsx:9-19,30-80,96-121`

**Interfaces:**
- Consumes: `eventDays`, `groupByDay`, `dayLabel`, `TemplateMoment`
- Produces: el controller expone `days: string[]`, `inRange: DayGroup<ItineraryMoment>[]`, `orphans: DayGroup<ItineraryMoment>[]`, `deleteDay(date)`, `applyTemplate(moments)`, y `openNew(date)` recibe la fecha del día. `MomentDraft` gana `moment_date: string`.

- [ ] **Step 1: Agregar la fecha a `MomentDraft` y al formulario**

En `MomentModal.tsx`: agregar `moment_date: string` a `MomentDraft` (después de `title`). Agregar a las props `days: string[]` y `defaultDate: string`.

En el `useState` inicial y en ambas ramas del `useEffect`, agregar `moment_date`: al editar, `editMoment.moment_date`; al crear, `defaultDate`.

En `handleSave`, agregar `moment_date: form.moment_date` al objeto y sumar `&& form.moment_date` a la guarda inicial.

Agregar el selector antes del grid de Hora + Duración (líneas 96-121). Sólo se dibuja si el evento tiene más de un día:

```tsx
          {days.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#555]">Día</label>
              <div className="relative">
                <select
                  value={form.moment_date}
                  onChange={e => setForm(f => ({ ...f, moment_date: e.target.value }))}
                  className="w-full cursor-pointer appearance-none rounded-xl border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-base focus:border-[#d4a853] focus:outline-none"
                >
                  {days.map(d => {
                    const { dow, num } = dayLabel(d)
                    return <option key={d} value={d}>{dow} {num}</option>
                  })}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
              </div>
            </div>
          )}
```

Agregar `dayLabel` al import de `@/lib/itinerary` (línea 5).

- [ ] **Step 2: Actualizar el hook**

En `useItinerary.ts`:

Agregar al import de `@/lib/itinerary`: `eventDays`, `groupByDay`. Agregar `import type { TemplateMoment } from '@/lib/itinerary-templates'`.

Agregar `event_end_date: string | null` a `ItineraryEventInfo`.

Reemplazar el `useMemo` de `sorted` (línea 53) por:

```ts
  const days = useMemo(
    () => eventDays(eventInfo?.event_date ?? null, eventInfo?.event_end_date ?? null),
    [eventInfo?.event_date, eventInfo?.event_end_date],
  )
  const { inRange, orphans } = useMemo(() => groupByDay(moments, days), [moments, days])
```

Quitar `sorted` del objeto que devuelve el hook y agregar `days`, `inRange`, `orphans`.

En `createMoment` y `updateMoment`, agregar `moment_date: data.moment_date` al objeto.

Cambiar el `.order` de `fetchMoments` a:

```ts
      .order('moment_date', { ascending: true })
      .order('position', { ascending: true })
```

Reemplazar `applyGenerated` por:

```ts
  const applyTemplate = async (gen: TemplateMoment[]) => {
    const base = moments.length
    const rows = gen.map((g, i) => ({
      event_id: eventId,
      moment_date: g.moment_date,
      title: g.title,
      start_time: g.start_time,
      duration_min: g.duration_min,
      location: null,
      phase: g.phase,
      event_supplier_id: null,
      assigned_to_name: null,
      notes: null,
      visible_to_guests: g.visible_to_guests,
      position: base + i,
    }))
    if (rows.length > 0) await supabase.from('event_itinerary_moments').insert(rows)
    setShowGenerate(false)
    await fetchMoments()
  }

  const deleteDay = async (date: string) => {
    await supabase.from('event_itinerary_moments').delete().eq('event_id', eventId).eq('moment_date', date)
    await fetchMoments()
  }
```

Cambiar `openNew` para que reciba la fecha:

```ts
  const [newDate, setNewDate] = useState<string>('')
  const openNew = (date?: string) => { setEditMoment(null); setNewDate(date || days[0] || ''); setShowModal(true) }
```

Exponer `newDate`, `deleteDay` y `applyTemplate` en el objeto de retorno; quitar `applyGenerated`.

- [ ] **Step 3: Conectar el modal**

En `ItineraryView.tsx`, pasarle al `MomentModal` las props nuevas: `days={days}` y `defaultDate={editMoment?.moment_date || newDate}`.

- [ ] **Step 4: Verificar tipos y que los tests sigan verdes**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` sin errores en estos archivos (puede seguir fallando `ItineraryView` si aún usa `sorted`; se arregla en la Task 8). Todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add app/events/\[id\]/timeline/useItinerary.ts app/events/\[id\]/timeline/MomentModal.tsx app/events/\[id\]/timeline/ItineraryView.tsx
git commit -m "feat(itinerario): guardar la fecha del momento y elegir dia al editarlo"
```

---

### Task 8: La línea del día que crece con el scroll

**Files:**
- Create: `app/events/[id]/timeline/DayLine.tsx`
- Modify: `app/events/[id]/timeline/ItineraryView.tsx`

**Interfaces:**
- Consumes: `dayLabel`, `DayGroup`
- Produces: `<DayLine date active count visibleCount onAdd />`

- [ ] **Step 1: Crear `DayLine.tsx`**

La animación va sobre `font-size` dentro de una fila de altura fija, para que crecer no empuje la lista.

```tsx
'use client'

import { dayLabel } from '@/lib/itinerary'
import { Plus } from 'lucide-react'

interface DayLineProps {
  date: string
  active: boolean
  count: number
  visibleCount: number
  canEdit: boolean
  onAdd: () => void
}

export function DayLine({ date, active, count, visibleCount, canEdit, onAdd }: DayLineProps) {
  const { dow, num } = dayLabel(date)
  return (
    <div className="sticky top-0 z-[2] flex h-14 items-center gap-3 bg-white">
      <span className="flex items-baseline gap-2 whitespace-nowrap">
        <span
          className={[
            'font-semibold uppercase tracking-[0.14em] transition-all duration-[400ms] ease-out motion-reduce:transition-none',
            active ? 'text-sm text-[#d4a853] tracking-[0.17em]' : 'text-[11px] text-[#999]',
          ].join(' ')}
        >
          {dow}
        </span>
        <span
          className={[
            'font-semibold tabular-nums transition-all duration-[400ms] ease-out motion-reduce:transition-none',
            active ? 'text-2xl text-[#d4a853]' : 'text-[13px] text-[#666]',
          ].join(' ')}
        >
          {num}
        </span>
      </span>
      <span className="h-px min-w-3 flex-1 bg-[#e8e8e8]" />
      <span className={`whitespace-nowrap text-[11px] transition-colors ${active ? 'text-[#666]' : 'text-[#bbb]'}`}>
        {count === 0 ? 'Sin momentos' : `${count} momentos · ${visibleCount} visibles`}
      </span>
      {canEdit && (
        <button
          onClick={onAdd}
          aria-label={`Agregar momento el ${dow} ${num}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#fffbf0] hover:text-[#d4a853]"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Reescribir la lista de `ItineraryView.tsx`**

El día activo es el último cuya línea ya llegó al tope del contenedor. El contenedor de scroll es el `main` del layout de evento, que es `overflow-hidden`: por eso la página trae su propio `flex-1 overflow-y-auto` y el scroll se escucha ahí.

Reemplazar el bloque "Hilo del dia" (líneas 75-93) por:

```tsx
      <div ref={stageRef} className="flex-1 overflow-y-auto">
        {inRange.map(group => {
          const visibles = group.moments.filter(m => m.visible_to_guests)
          const shown = guestPreview ? visibles : group.moments
          if (guestPreview && shown.length === 0) return null
          return (
            <section key={group.date} ref={el => { secRefs.current[group.date] = el }} className="relative">
              <DayLine
                date={group.date}
                active={activeDay === group.date}
                count={group.moments.length}
                visibleCount={visibles.length}
                canEdit={canEdit && !guestPreview}
                onAdd={() => openNew(group.date)}
              />
              {shown.length === 0 ? (
                <p className="pb-4 pl-1 text-xs text-[#bbb]">Nada planeado todavía</p>
              ) : (
                <div className="flex flex-col pb-2">
                  {shown.map(m => (
                    <MomentCard key={m.id} moment={m} canEdit={canEdit} guestPreview={guestPreview} onEdit={openEdit} onToggleVisible={toggleVisible} />
                  ))}
                </div>
              )}
            </section>
          )
        })}
        <div className="h-40" />
      </div>
```

Con un solo día la línea no aporta nada: envolver el `<DayLine>` en `{days.length > 1 && (...)}`.

Agregar arriba del `return`, dentro del componente:

```tsx
  const stageRef = useRef<HTMLDivElement | null>(null)
  const secRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeDay, setActiveDay] = useState<string>(inRange[0]?.date ?? '')

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || days.length < 2) return
    let queued = false
    const sync = () => {
      queued = false
      const top = stage.getBoundingClientRect().top
      let current = inRange[0]?.date ?? ''
      for (const g of inRange) {
        const el = secRefs.current[g.date]
        if (el && el.getBoundingClientRect().top <= top + 2) current = g.date
      }
      setActiveDay(current)
    }
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(sync) } }
    stage.addEventListener('scroll', onScroll, { passive: true })
    sync()
    return () => stage.removeEventListener('scroll', onScroll)
  }, [inRange, days.length])
```

Importar `useEffect`, `useRef`, `useState` de React y `DayLine`. Sustituir `sorted` por `inRange` y agregar `days`, `openNew` con fecha, en la desestructuración del controller.

En el estado vacío (líneas 38-62), cambiar el texto del botón de `Autogenerar` a `Armar el día` y quitar el icono `Sparkles` si ya no se usa.

- [ ] **Step 3: Probar a mano**

Run: `npm run dev`

Verificar en `/events/<id>/timeline` de un evento con `event_end_date` a tres días de distancia:
- Al scrollear, la fecha del día crece y se pone dorada, y la anterior se encoge
- El `+` de cada línea abre el modal con ese día preseleccionado
- En un evento de un día no aparece ninguna línea y la pantalla se ve como antes
- En mobile el contenido scrollea (el `main` del layout es `overflow-hidden`, el scroll vive en el contenedor de la página)

- [ ] **Step 4: Commit**

```bash
git add app/events/\[id\]/timeline/DayLine.tsx app/events/\[id\]/timeline/ItineraryView.tsx
git commit -m "feat(itinerario): la fecha del dia crece con el scroll"
```

---

### Task 9: El día huérfano

**Files:**
- Modify: `app/events/[id]/timeline/ItineraryView.tsx`

**Interfaces:**
- Consumes: `orphans`, `deleteDay` (Task 7), `useConfirm` de `app/components/ui/ConfirmModal.tsx`
- Produces: nada

- [ ] **Step 1: El handler de borrado con confirmación**

`useConfirm()` devuelve una función que resuelve a `boolean`. **No** usar `confirm()` del navegador. El copy dice qué se borra, no un "¿estás seguro?".

Agregar dentro del componente `ItineraryView`:

```tsx
  const confirm = useConfirm()

  const askDeleteDay = async (group: DayGroup<ItineraryMoment>) => {
    const { dow, num } = dayLabel(group.date)
    const ok = await confirm({
      title: 'Eliminar el día',
      message: `Se borran los ${group.moments.length} momentos del ${dow} ${num}. No se puede deshacer.`,
      confirmLabel: 'Eliminar el día',
      tone: 'danger',
    })
    if (ok) await deleteDay(group.date)
  }
```

Importar `useConfirm` de `@/app/components/ui/ConfirmModal`, `dayLabel` y el tipo `DayGroup` de `@/lib/itinerary`, y `ItineraryMoment` de `@/lib/types`.

- [ ] **Step 2: Pintar los huérfanos**

Después del `.map` de `inRange` y antes del `<div className="h-40" />`, agregar:

```tsx
        {!guestPreview && orphans.map(group => {
          const { dow, num } = dayLabel(group.date)
          return (
            <section key={group.date} className="relative mt-4">
              <div className="flex h-14 items-center gap-3">
                <span className="flex items-baseline gap-2 whitespace-nowrap text-[#cc3333]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{dow}</span>
                  <span className="text-[13px] font-semibold tabular-nums">{num}</span>
                </span>
                <span className="h-px min-w-3 flex-1 bg-[#ffc0c0]" />
                <span className="whitespace-nowrap text-[11px] text-[#cc3333]">Fuera del rango</span>
              </div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ffc0c0] bg-[#fff0f0] px-3.5 py-3">
                <p className="max-w-[52ch] text-[13px] text-[#cc3333]">
                  Este día ya no está dentro de las fechas del evento. Sus {group.moments.length} momentos no se muestran a los invitados.
                </p>
                {canEdit && (
                  <button
                    onClick={() => askDeleteDay(group)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#ffc0c0] bg-white px-3 py-1.5 text-xs font-semibold text-[#cc3333] transition hover:bg-[#fff0f0]"
                  >
                    <Trash2 size={13} />Eliminar el día
                  </button>
                )}
              </div>
              <div className="flex flex-col pb-2">
                {group.moments.map(m => (
                  <MomentCard key={m.id} moment={m} canEdit={canEdit} guestPreview={false} onEdit={openEdit} onToggleVisible={toggleVisible} />
                ))}
              </div>
            </section>
          )
        })}
```

Importar `Trash2` de `lucide-react` y `dayLabel` de `@/lib/itinerary`.

- [ ] **Step 3: Verificar que el provider esté montado**

Run: `grep -rn "ConfirmProvider" app/`

`useConfirm` truena si no hay `<ConfirmProvider>` arriba en el árbol. Si el layout de `/events/[id]` no lo monta, montarlo ahí.

- [ ] **Step 4: Probar a mano**

Run: `npm run dev`

En un evento de tres días con momentos en el tercero, acortar `event_end_date` en Configuración y volver al timeline: el día sale al final en rojo, con su aviso y su botón. Eliminarlo borra sus momentos y desaparece la sección.

- [ ] **Step 5: Commit**

```bash
git add app/events/\[id\]/timeline/ItineraryView.tsx
git commit -m "feat(itinerario): avisar del dia fuera del rango y dejar borrarlo"
```

---

### Task 10: Plantillas en vez de IA

**Files:**
- Create: `app/events/[id]/timeline/DayTemplateModal.tsx`
- Modify: `app/events/[id]/timeline/ItineraryView.tsx`
- Modify: `app/events/[id]/timeline/ItineraryToolbar.tsx`
- Modify: `app/events/[id]/timeline/useItinerary.ts`
- Delete: `app/events/[id]/timeline/GenerateItineraryModal.tsx`, `app/api/itinerary/generate/route.ts`, `lib/itinerary-ai.ts`, `lib/itinerary-ai.test.ts`

**Interfaces:**
- Consumes: `dayTypesFor`, `templateFor`, `expandTemplate`, `dayLabel`, `applyTemplate` (Task 7)
- Produces: `<DayTemplateModal eventType date onClose onApply />`

- [ ] **Step 1: Crear el modal de dos pasos**

```tsx
'use client'

import { useState } from 'react'
import { Modal } from '@/app/components/ui/Modal'
import { dayLabel } from '@/lib/itinerary'
import { dayTypesFor, templateFor, expandTemplate, type DayTypeKey, type TemplateMoment } from '@/lib/itinerary-templates'

interface DayTemplateModalProps {
  eventType: string | null
  date: string
  onClose: () => void
  onApply: (moments: TemplateMoment[]) => void
}

export function DayTemplateModal({ eventType, date, onClose, onApply }: DayTemplateModalProps) {
  const options = dayTypesFor(eventType)
  const [key, setKey] = useState<DayTypeKey>(options[0].key)
  const [anchor, setAnchor] = useState(() => templateFor(eventType || '', options[0].key).defaultAnchorTime)
  const [preview, setPreview] = useState<TemplateMoment[] | null>(null)

  const tpl = templateFor(eventType || '', key)
  const { dow, num } = dayLabel(date)

  const pick = (k: DayTypeKey) => {
    setKey(k)
    setAnchor(templateFor(eventType || '', k).defaultAnchorTime)
  }

  if (preview) {
    return (
      <Modal open onClose={onClose} size="md">
        <Modal.Header title={`Así quedaría tu ${dow.toLowerCase()}`} />
        <Modal.Body>
          <p className="pb-3 text-xs text-[#888]">
            {options.find(o => o.key === key)?.label} · empieza {anchor}
          </p>
          <div className="flex flex-col">
            {preview.map((m, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr] gap-2 py-1 text-sm">
                <span className="tabular-nums text-[13px] font-semibold text-[#666]">{m.start_time}</span>
                <span>
                  {m.title}
                  {m.moment_date !== date && <span className="ml-2 text-[11px] text-[#c49a3a]">día siguiente</span>}
                  {!m.visible_to_guests && <span className="ml-2 text-[11px] text-[#bbb]">oculto</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="pt-3 text-[11px] text-[#bbb]">
            Se agregan como borrador: mueve, edita o borra lo que no aplique.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setPreview(null)} className="flex-1 rounded-xl border border-[#e0e0e0] py-2.5 text-sm text-[#888] hover:bg-[#f8f8f8]">
            Cambiar
          </button>
          <button onClick={() => onApply(preview)} className="flex-[2] rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white hover:bg-[#3ab89f]">
            Agregar {preview.length} momentos
          </button>
        </Modal.Footer>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Armar el día" />
      <Modal.Body>
        <div className="flex items-baseline gap-2 border-b border-[#e8e8e8] pb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4a853]">{dow}</span>
          <span className="text-[22px] font-semibold tabular-nums">{num}</span>
        </div>

        <p className="pb-2 pt-4 text-xs font-semibold text-[#666]">¿Qué pasa este día?</p>
        <div className="flex flex-wrap gap-2">
          {options.map(o => (
            <button
              key={o.key}
              onClick={() => pick(o.key)}
              className={[
                'rounded-full border px-3 py-1.5 text-[12.5px] transition',
                key === o.key
                  ? 'border-[#d4a853] bg-[#fffbf0] font-semibold text-[#c49a3a]'
                  : 'border-[#e0e0e0] text-[#666] hover:bg-[#f8f8f8]',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="pb-2 pt-5 text-xs font-semibold text-[#666]">¿A qué hora empieza?</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-sm text-[#666]">{tpl.anchorLabel}</div>
          <input
            type="time"
            value={anchor}
            onChange={e => setAnchor(e.target.value)}
            className="w-[108px] shrink-0 rounded-xl border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-2 text-center text-base tabular-nums focus:border-[#d4a853] focus:outline-none"
          />
        </div>
        <p className="pt-2 text-[11px] text-[#bbb]">Todo lo demás se acomoda solo a partir de esa hora.</p>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="flex-1 rounded-xl border border-[#e0e0e0] py-2.5 text-sm text-[#888] hover:bg-[#f8f8f8]">
          Cancelar
        </button>
        <button
          onClick={() => setPreview(expandTemplate(tpl, anchor, date))}
          disabled={!anchor}
          className="flex-[2] rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white hover:bg-[#3ab89f] disabled:opacity-40"
        >
          Ver propuesta
        </button>
      </Modal.Footer>
    </Modal>
  )
}
```

- [ ] **Step 2: Conectarlo y borrar el viejo**

En `ItineraryView.tsx`: sustituir `GenerateItineraryModal` por

```tsx
  const templateModal = showGenerate && (
    <DayTemplateModal
      eventType={eventInfo?.event_type ?? null}
      date={templateDate}
      onClose={() => setShowGenerate(false)}
      onApply={applyTemplate}
    />
  )
```

Agregar en el hook un `templateDate` (mismo patrón que `newDate`) y un `openTemplate(date)` que lo fije y prenda `showGenerate`. La línea del día no lleva un segundo botón: el `+` abre el momento manual, y el botón de la toolbar arma el día activo.

En `ItineraryToolbar.tsx`, cambiar el texto del botón de `Autogenerar` a `Armar el día` y el icono `Sparkles` por `CalendarPlus`.

Borrar los cuatro archivos:

```bash
git rm app/events/\[id\]/timeline/GenerateItineraryModal.tsx app/api/itinerary/generate/route.ts lib/itinerary-ai.ts lib/itinerary-ai.test.ts
```

- [ ] **Step 3: Verificar que no quedó nada colgando**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores, todos los tests pasan.

Run: `grep -rn "itinerary-ai\|itinerary/generate\|GenerateItineraryModal\|applyGenerated\|DAY_START_HOUR\|momentOrderMinutes" app lib`
Expected: sin resultados.

- [ ] **Step 4: Probar a mano**

Run: `npm run dev`

- Armar el día con "Día principal" en una boda: la previsualización trae Ceremonia, Vals y Tornafiesta, y el cierre de las 03:00 sale marcado como día siguiente
- "Cambiar" regresa al paso 1 sin haber escrito nada
- "Agregar N momentos" los inserta, y los que pasan de medianoche caen en el día siguiente
- En un evento de un día, un momento que cae al día siguiente aparece como huérfano en rojo

- [ ] **Step 5: Commit**

```bash
git add -A app/events/\[id\]/timeline lib
git commit -m "feat(itinerario): armar el dia con plantillas y quitar la generacion con IA"
```

---

## Cierre

Antes de considerar la rama terminada:

- [ ] `npm test` — todo verde
- [ ] `npx tsc --noEmit` — sin errores
- [ ] `npm run build` — compila
- [ ] El SQL de la Task 1 sigue **sin ejecutarse**. Pasárselo a Diego con el orden: pasos 1 y 2 → desplegar → paso 3.
- [ ] Agregar el release a `lib/changelog.ts` y subir `CURRENT_VERSION`
- [ ] No pushear ni abrir PR sin OK de Diego
