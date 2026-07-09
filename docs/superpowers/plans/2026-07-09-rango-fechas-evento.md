# Rango de fechas del evento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar fecha de inicio + fin (opcional) del evento con un calendario tipo rango, mostrando el rango con un formato colapsado consistente en toda la app.

**Architecture:** Aditivo sobre datos que ya existen (`events.event_end_date`, nullable). Se extiende el `DatePicker` compartido con un `mode="range"` opcional (default `single`, no rompe usos actuales), se agrega un helper puro `formatEventDate(start, end)` en `lib/types.ts`, y se conecta en Nuevo evento, Configuracion, Dashboard y Layout.

**Tech Stack:** Next.js 16, React 19, TypeScript, react-day-picker v9 (locale `es`), Vitest.

## Global Constraints

- Sin migracion de Supabase: la columna `events.event_end_date` y el tipo `Event.event_end_date: string | null` YA existen.
- `event_end_date = null` significa evento de un dia. Nunca guardar `end === start`.
- UI en español CON acentos/ñ. Commits SIN acentos ni ñ, convencionales (`feat:`, `fix:`, `refactor:`).
- Solo Tailwind CSS. CTA en teal `#48C9B0`. Sin emojis en UI. Iconos Lucide.
- Parseo de fechas SIEMPRE local: `str.split('T')[0].split('-').map(Number)` -> `new Date(y, m-1, d)`. Nunca `new Date(str)` (corre zona horaria).
- Código completo por archivo, sin fragmentos parciales al pegar.
- `npm test` para logica pura; UI se verifica manual (local -> preview -> main).

---

### Task 1: Helper `formatEventDate(start, end)` con tests

**Files:**
- Modify: `lib/types.ts` (agregar función export junto a `formatCurrency`, ~línea 55)
- Test: `lib/types.test.ts` (crear)

**Interfaces:**
- Produces: `export function formatEventDate(start: string | null, end?: string | null): string`
  - Entrada: strings `YYYY-MM-DD` (o con sufijo `T...`, se recorta). Salida: string legible `es-MX`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatEventDate } from './types'

describe('formatEventDate', () => {
  it('sin inicio devuelve cadena vacia', () => {
    expect(formatEventDate(null)).toBe('')
    expect(formatEventDate('')).toBe('')
  })

  it('solo inicio: un dia', () => {
    expect(formatEventDate('2026-07-09')).toBe('9 de julio de 2026')
  })

  it('fin igual a inicio: un dia', () => {
    expect(formatEventDate('2026-07-09', '2026-07-09')).toBe('9 de julio de 2026')
  })

  it('mismo mes y año: colapsa mes y año', () => {
    expect(formatEventDate('2026-07-09', '2026-07-11')).toBe('9 – 11 de julio de 2026')
  })

  it('distinto mes, mismo año: colapsa año', () => {
    expect(formatEventDate('2026-07-30', '2026-08-02')).toBe('30 de julio – 2 de agosto de 2026')
  })

  it('distinto año: formato corto en ambos lados', () => {
    expect(formatEventDate('2026-12-30', '2027-01-02')).toBe('30 dic 2026 – 2 ene 2027')
  })

  it('ignora sufijo de hora en el string', () => {
    expect(formatEventDate('2026-07-09T00:00:00', '2026-07-11T00:00:00')).toBe('9 – 11 de julio de 2026')
  })

  it('fin antes de inicio se trata como fin ausente', () => {
    expect(formatEventDate('2026-07-11', '2026-07-09')).toBe('11 de julio de 2026')
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- lib/types.test.ts`
Expected: FAIL — `formatEventDate is not a function` / import inexistente.

- [ ] **Step 3: Implementar el helper**

En `lib/types.ts`, justo después de `formatCurrency` (después de la línea `}` que cierra `formatCurrency`, ~línea 55), agregar:

```ts
function parseYMD(str: string): Date | null {
  const clean = str.split('T')[0]
  const [y, m, d] = clean.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function formatEventDate(start: string | null | undefined, end?: string | null): string {
  if (!start) return ''
  const from = parseYMD(start)
  if (!from) return ''

  const to = end ? parseYMD(end) : null
  const singleDay = !to || to.getTime() <= from.getTime()

  if (singleDay) {
    return from.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const sameYear = from.getFullYear() === to!.getFullYear()
  const sameMonth = sameYear && from.getMonth() === to!.getMonth()

  if (sameMonth) {
    const monthYear = from.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return `${from.getDate()} – ${to!.getDate()} de ${monthYear}`
  }

  if (sameYear) {
    const left = from.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
    const right = to!.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${left} – ${right}`
  }

  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  const left = from.toLocaleDateString('es-MX', opts).replace(/\./g, '')
  const right = to!.toLocaleDateString('es-MX', opts).replace(/\./g, '')
  return `${left} – ${right}`
}
```

Nota: `.replace(/\./g, '')` quita el punto que `es-MX` agrega al mes corto (`dic.` -> `dic`).

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- lib/types.test.ts`
Expected: PASS (8 tests verdes). Si el caso "distinto año" difiere en el punto del mes corto, ajustar el `replace` hasta que coincida con `30 dic 2026 – 2 ene 2027`.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/types.test.ts
git commit -m "feat(fechas): helper formatEventDate con formato de rango colapsado"
```

---

### Task 2: `DatePicker` gana `mode="range"` (aditivo)

**Files:**
- Modify: `app/components/ui/DatePicker.tsx` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: `formatEventDate` de `@/lib/types` (Task 1).
- Produces: `DatePicker` con props:
  - Modo single (default, sin cambios): `value: string`, `onChange: (v: string) => void`, `placeholder?`, `minDate?`, `disabled?`.
  - Modo range (nuevo): `mode="range"`, `startValue: string`, `endValue: string`, `onRangeChange: (start: string, end: string) => void`, `placeholder?`, `minDate?`, `disabled?`.

- [ ] **Step 1: Reemplazar el archivo completo**

`app/components/ui/DatePicker.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, X } from 'lucide-react'
import { formatEventDate } from '@/lib/types'
import 'react-day-picker/style.css'

type SingleProps = {
  mode?: 'single'
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minDate?: string
  disabled?: boolean
}

type RangeProps = {
  mode: 'range'
  startValue: string
  endValue: string
  onRangeChange: (start: string, end: string) => void
  placeholder?: string
  minDate?: string
  disabled?: boolean
}

type DatePickerProps = SingleProps | RangeProps

function parseLocal(str: string): Date | undefined {
  if (!str) return undefined
  const [y, m, d] = str.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDisplay(str: string): string {
  if (!str) return ''
  const [y, m, d] = str.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

const dayPickerClassNames = {
  root:            'p-4',
  month:           'w-full',
  month_caption:   'flex items-center justify-between px-1 pb-3',
  caption_label:   'text-sm font-semibold text-[#1D1E20] capitalize',
  nav:             'flex items-center gap-1',
  button_previous: 'flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]',
  button_next:     'flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]',
  weeks:           'w-full',
  weekdays:        'flex mb-1',
  weekday:         'flex-1 text-center text-[11px] font-medium text-[#bbb] uppercase pb-1',
  week:            'flex',
  day:             'flex-1 flex items-center justify-center p-0.5',
  day_button:      'h-9 w-9 rounded-lg text-sm text-[#1D1E20] transition hover:bg-[#f0fdfb] hover:text-[#1a9e88] cursor-pointer',
  selected:        'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_start:     'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_end:       'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_middle:    'bg-[#f0fdfb] text-[#1a9e88] rounded-none',
  today:           'font-bold text-[#48C9B0]',
  outside:         'text-[#ddd]',
  disabled:        'text-[#e0e0e0] cursor-not-allowed',
  hidden:          'invisible',
}

const accentStyle = { '--rdp-accent-color': '#48C9B0', '--rdp-accent-background-color': '#f0fdfb' } as React.CSSProperties

export default function DatePicker(props: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const disabled = props.disabled
  const placeholder = props.placeholder ?? 'Seleccionar fecha'
  const minDate = props.minDate

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const fromDate = minDate ? parseLocal(minDate) : undefined
  const isRange = props.mode === 'range'

  const hasValue = isRange ? !!props.startValue : !!props.value
  const buttonLabel = isRange
    ? formatEventDate(props.startValue || null, props.endValue || null)
    : formatDisplay(props.value)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRange) props.onRangeChange('', '')
    else props.onChange('')
  }

  const handleSelectSingle = (date: Date | undefined) => {
    if (!date || props.mode === 'range') return
    props.onChange(toYMD(date))
    setOpen(false)
  }

  const handleSelectRange = (range: DateRange | undefined) => {
    if (props.mode !== 'range') return
    const start = range?.from ? toYMD(range.from) : ''
    const end = range?.to ? toYMD(range.to) : ''
    props.onRangeChange(start, end)
  }

  const selectedSingle = !isRange ? parseLocal(props.value) : undefined
  const selectedRange: DateRange | undefined = isRange
    ? { from: parseLocal(props.startValue), to: parseLocal(props.endValue) }
    : undefined
  const defaultMonth = (isRange ? parseLocal(props.startValue) : parseLocal(props.value)) || fromDate || undefined

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
          disabled
            ? 'cursor-not-allowed border-[#f0f0f0] bg-[#f8f8f8] text-[#ccc]'
            : 'border-[#d0d0d0] bg-white text-[#1D1E20] hover:border-[#48C9B0]'
        }`}
      >
        <CalendarDays size={14} className={`shrink-0 ${hasValue ? 'text-[#48C9B0]' : 'text-[#bbb]'}`} />
        <span className={`flex-1 truncate ${!hasValue ? 'text-[#c0c0c0]' : ''}`}>
          {hasValue ? buttonLabel : placeholder}
        </span>
        {hasValue && !disabled && (
          <span onClick={handleClear} className="shrink-0 text-[#ccc] transition hover:text-[#888]">
            <X size={13} />
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
              <p className="text-sm font-semibold text-[#1D1E20]">
                {isRange ? 'Seleccionar fechas' : 'Seleccionar fecha'}
              </p>
              <div className="flex items-center gap-2">
                {isRange && (
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-[#48C9B0] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
                  >
                    Listo
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-[#aaa] transition hover:text-[#555]">
                  <X size={16} />
                </button>
              </div>
            </div>

            {isRange && props.startValue && (
              <div className="border-b border-[#f0f0f0] px-4 py-2 text-center text-xs text-[#888]">
                {formatEventDate(props.startValue, props.endValue || null)}
              </div>
            )}

            {isRange ? (
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={handleSelectRange}
                locale={es}
                disabled={fromDate ? { before: fromDate } : undefined}
                defaultMonth={defaultMonth || new Date()}
                style={accentStyle}
                classNames={dayPickerClassNames}
              />
            ) : (
              <DayPicker
                mode="single"
                selected={selectedSingle}
                onSelect={handleSelectSingle}
                locale={es}
                disabled={fromDate ? { before: fromDate } : undefined}
                defaultMonth={defaultMonth || new Date()}
                style={accentStyle}
                classNames={dayPickerClassNames}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verificar que compila y los usos single no truenan**

Run: `npm run lint`
Expected: sin errores nuevos de tipo en `DatePicker.tsx`. Los llamados existentes (`configuracion`, `invitacion`, `NewEventModal`) usan la firma single y deben seguir type-checkeando (aún no los tocamos; siguen pasando `value`/`onChange`).

- [ ] **Step 3: Commit**

```bash
git add app/components/ui/DatePicker.tsx
git commit -m "feat(datepicker): modo rango opcional sin romper el modo fecha unica"
```

---

### Task 3: Nuevo evento captura inicio + fin

**Files:**
- Modify: `app/components/NewEventModal.tsx`

**Interfaces:**
- Consumes: `DatePicker` modo range (Task 2).

- [ ] **Step 1: Agregar estado `endDate`**

En `NewEventModal.tsx`, junto a `const [date, setDate] = useState('')` (~línea 36) agregar:

```tsx
  const [endDate, setEndDate]             = useState('')
```

- [ ] **Step 2: Limpiar `endDate` en `resetForm`**

En `resetForm`, en la línea `setDate(''); setTime(''); setVenue('')` cambiar a:

```tsx
    setDate(''); setEndDate(''); setTime(''); setVenue('')
```

- [ ] **Step 3: Reemplazar el DatePicker de Fecha por el de rango**

Reemplazar el bloque (~líneas 288-292):

```tsx
        {/* Fecha */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">Fecha *</label>
          <DatePicker value={date} onChange={setDate} placeholder="Seleccionar fecha" />
        </div>
```

por:

```tsx
        {/* Fecha */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#555]">Fecha *</label>
          <DatePicker
            mode="range"
            startValue={date}
            endValue={endDate}
            onRangeChange={(start, end) => { setDate(start); setEndDate(end) }}
            placeholder="Seleccionar fecha"
          />
          <p className="mt-1 text-[11px] text-[#aaa]">Elige un dia, o un rango para eventos de varios dias.</p>
        </div>
```

- [ ] **Step 4: Guardar `event_end_date` en el insert**

En `handleCreate`, en el objeto del `.insert({...})` de `events`, después de `event_date: date,` agregar:

```tsx
        event_end_date: endDate || null,
```

- [ ] **Step 5: Verificacion manual**

Run: `npm run dev`
Verificar en `http://localhost:3000` (crear evento):
- Seleccionar 1 día -> el botón muestra "9 de julio de 2026" y se crea con `event_end_date` null.
- Seleccionar rango -> el botón muestra "9 – 11 de julio de 2026".
- Botón "Listo" cierra el calendario; la X limpia.

- [ ] **Step 6: Commit**

```bash
git add app/components/NewEventModal.tsx
git commit -m "feat(evento): alta con fecha de inicio y fin via calendario de rango"
```

---

### Task 4: Configuracion usa el calendario de rango

**Files:**
- Modify: `app/events/[id]/configuracion/page.tsx:762-774`

**Interfaces:**
- Consumes: `DatePicker` modo range (Task 2). Reusa estado existente `eventDate`, `eventEndDate`, `setEventDate`, `setEventEndDate`, `scheduleAutoSave`.

- [ ] **Step 1: Reemplazar los dos DatePicker separados por uno de rango**

Reemplazar el bloque (líneas ~762-774):

```tsx
                    {/* Fecha */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">Fecha</label>
                      <DatePicker value={eventDate} onChange={v => { setEventDate(v); scheduleAutoSave() }} placeholder="Fecha" />
                    </div>

                    {/* Fecha fin */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">
                        Fin <span className="font-normal text-[#bbb]">(opc.)</span>
                      </label>
                      <DatePicker value={eventEndDate} onChange={v => { setEventEndDate(v); scheduleAutoSave() }} placeholder="Fecha fin" minDate={eventDate || undefined} />
                    </div>
```

por:

```tsx
                    {/* Fecha (inicio + fin) */}
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-[#555]">Fecha</label>
                      <DatePicker
                        mode="range"
                        startValue={eventDate}
                        endValue={eventEndDate}
                        onRangeChange={(start, end) => { setEventDate(start); setEventEndDate(end); scheduleAutoSave() }}
                        placeholder="Fecha"
                      />
                    </div>
```

Nota: revisar el grid contenedor. Antes eran 2 celdas + hora; ahora 1 celda que ocupa 2 columnas (`sm:col-span-2`) + hora. Si el layout se ve raro, ajustar el `col-span` para respetar la rejilla existente (el bloque de duración ya usa `sm:col-span-3`).

- [ ] **Step 2: Verificacion manual**

Run: `npm run dev`
En `/events/[id]/configuracion`:
- Un evento existente de un día muestra su fecha; se puede extender a rango y auto-guarda.
- Un evento con rango (p. ej. creado en Task 3) muestra "9 – 11 de julio de 2026".
- La X limpia ambas fechas y auto-guarda (`event_date` null es válido en config).

- [ ] **Step 3: Commit**

```bash
git add "app/events/[id]/configuracion/page.tsx"
git commit -m "refactor(config): unifica fecha inicio y fin en un calendario de rango"
```

---

### Task 5: Display del rango en Dashboard y Layout

**Files:**
- Modify: `app/dashboard/page.tsx` (helper `formatDate` local + 2 usos)
- Modify: `app/events/[id]/layout.tsx` (helper `formatDate` local + 2 usos)

**Interfaces:**
- Consumes: `formatEventDate` de `@/lib/types` (Task 1).

- [ ] **Step 1: Dashboard — usar `formatEventDate` en los dos renders de fecha**

En `app/dashboard/page.tsx`:

1. Asegurar el import de `formatEventDate`. Buscar el import existente desde `@/lib/types` y agregar `formatEventDate`. Si no hay import de types, agregar:
   ```tsx
   import { formatEventDate } from '@/lib/types'
   ```
2. En el render de la lista de eventos (~línea 467) cambiar:
   ```tsx
   {formatDate(event.event_date)}
   ```
   por:
   ```tsx
   {formatEventDate(event.event_date, event.event_end_date)}
   ```
3. En la tarjeta del próximo evento (~línea 658) cambiar:
   ```tsx
   {formatDate(nextEvent.event_date)}
   ```
   por:
   ```tsx
   {formatEventDate(nextEvent.event_date, nextEvent.event_end_date)}
   ```
4. El helper local `formatDate` (~líneas 296-302) queda sin usos de rango; si ya no se usa en ningún otro lado, eliminarlo. Verificar con búsqueda de `formatDate(` en el archivo antes de borrar (puede seguir usándose para otras fechas de fecha única — si es así, dejarlo).

- [ ] **Step 2: Layout — usar `formatEventDate`**

En `app/events/[id]/layout.tsx`:

1. Agregar import: `import { formatEventDate } from '@/lib/types'` (o extender el import existente de `@/lib/types`).
2. En los dos usos (~líneas 577 y 703) cambiar `{formatDate(event.event_date)}` y `{formatDate(event.event_date)}` por:
   ```tsx
   {formatEventDate(event.event_date, event.event_end_date)}
   ```
3. El helper local `formatDate` (~líneas 363-368): si queda sin usos, eliminarlo; si `event_end_date` no está en el tipo `event` del estado local del layout, confirmar que el `.select()` (línea 355) ya lo trae (sí lo trae) y que el tipo local lo permite.

- [ ] **Step 3: Verificacion manual**

Run: `npm run dev`
- Dashboard: un evento multi-día muestra "9 – 11 de julio de 2026" en la lista y en la tarjeta de próximo evento.
- Header del evento (desktop y mobile): muestra el rango.
- Un evento de un día se ve idéntico a antes ("9 de julio de 2026").

- [ ] **Step 4: Lint + test + commit**

Run: `npm run lint && npm test`
Expected: sin errores; tests verdes.

```bash
git add app/dashboard/page.tsx "app/events/[id]/layout.tsx"
git commit -m "feat(display): muestra rango de fechas del evento en dashboard y header"
```

---

## Self-Review

**Spec coverage:**
- Modelo de datos nullable -> Task 3/4 (insert/update con `end || null`). ✓
- Interacción rango, fin opcional -> Task 2. ✓
- Formato colapsado -> Task 1. ✓
- Consistencia (nuevo + config, single intacto) -> Task 2/3/4; single sin cambios. ✓
- Display dashboard/layout -> Task 5. ✓
- Comida ya maneja rango -> no requiere tarea (spec lo marca opcional). ✓

**Placeholder scan:** sin TBD/TODO; todo el código está escrito. ✓

**Type consistency:** `formatEventDate(start, end?)` usado igual en Task 2 y Task 5; props de `DatePicker` range (`startValue`/`endValue`/`onRangeChange`) usadas igual en Task 3 y Task 4. ✓

## Verificación final (después de todas las tareas)

- `npm run lint` limpio.
- `npm test` verde.
- `npm run build` sin errores.
- Manual: crear evento 1 día y multi-día; editar en config; ver rango en dashboard + header + comida; confirmar invitación y timeline (fecha única) intactos.
