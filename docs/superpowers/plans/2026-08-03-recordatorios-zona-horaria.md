# Recordatorios del timeline: zona horaria y selector — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el recordatorio que el usuario ve en pantalla sea exactamente el que se guarda y el que suena, y que el selector deje de inventar horas en silencio.

**Architecture:** Hoy la lógica del recordatorio está triplicada: `TaskModal` la tiene dos veces (escribir y releer) y `TaskCard` una tercera para pintar la etiqueta, cada una con su propia copia de `REMINDER_OPTIONS`. Las tres comparten el mismo defecto: mezclan texto sin zona con instantes UTC. Se extrae una sola fuente de verdad a `lib/timeline/reminder-picker.ts`, con funciones puras cubiertas por Vitest, y los tres sitios pasan a consumirla.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Vitest, Supabase (`event_timeline_tasks.reminder_date` es `timestamptz`).

## Global Constraints

- Worktree: `C:\Users\diego\Documents\anfiora-recordatorios`, rama `fix/recordatorios-zona-horaria`. **Verificar la rama antes de cada commit**: hay otras sesiones trabajando sobre el mismo repo.
- Sin cambios de esquema. Se mantiene una sola columna `reminder_date` y un único recordatorio por tarea.
- Sin migración de datos: los 6 recordatorios viejos quedan como están.
- La zona de referencia es la del navegador del planner.
- Hora del aviso para tareas sin horario: **9:00**.
- Comentarios solo cuando el porqué no es obvio (regla del repo).
- UI en español con acentos; mensajes de commit sin acentos ni eñes.
- Los tests viven junto al código como `<archivo>.test.ts` bajo `lib/`.

---

### Task 1: Módulo único de recordatorios

**Files:**
- Create: `lib/timeline/reminder-picker.ts`
- Create: `lib/timeline/reminder-picker.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type ReminderPreset = { value: string; label: string; minutes: number | null }`
  - `ALLDAY_REMINDER_HOUR: number`
  - `TIMED_PRESETS: ReminderPreset[]`
  - `ALLDAY_PRESETS: ReminderPreset[]`
  - `reminderPresetsFor(taskTime: string | null): ReminderPreset[]`
  - `computeReminderInstant(taskDate: string, taskTime: string | null, key: string): string | null`
  - `computeCustomInstant(date: string, time: string): string | null`
  - `detectReminderKey(reminderDate: string | null, taskDate: string, taskTime: string | null): string`
  - `formatReminderLabel(reminderDate: string, taskDate: string, taskTime: string | null): string`

- [ ] **Step 1: Fijar la zona de las pruebas**

En `vitest.config.ts`, agregar `env` dentro de `test` para que la suite no dependa de la zona de la máquina:

```ts
export default defineConfig({
  test: {
    environment: 'node',
    env: { TZ: 'America/Mexico_City' },
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 2: Escribir las pruebas que fallan**

Crear `lib/timeline/reminder-picker.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  reminderPresetsFor,
  computeReminderInstant,
  computeCustomInstant,
  detectReminderKey,
  formatReminderLabel,
} from './reminder-picker'

describe('reminderPresetsFor', () => {
  it('ofrece los presets por minutos cuando la tarea tiene hora', () => {
    const values = reminderPresetsFor('16:00').map(p => p.value)
    expect(values).toContain('exacta')
    expect(values).toContain('15min')
  })

  it('sin hora, solo ofrece los que se cuentan por dias', () => {
    const values = reminderPresetsFor(null).map(p => p.value)
    expect(values).not.toContain('exacta')
    expect(values).not.toContain('15min')
    expect(values).toEqual(['mismo-dia', '1d', '2d', '1w', 'custom'])
  })

  it('dice la hora del aviso en la etiqueta cuando la tarea no tiene hora', () => {
    const mismoDia = reminderPresetsFor(null).find(p => p.value === 'mismo-dia')
    expect(mismoDia?.label).toBe('El mismo día a las 9:00')
  })
})

describe('computeReminderInstant', () => {
  it('guarda el instante real, no la hora local como si fuera UTC', () => {
    // El caso reportado: 11:06 en Mexico son las 17:06 UTC.
    const iso = computeReminderInstant('2026-08-03', '11:06', 'exacta')
    expect(iso).toBe('2026-08-03T17:06:00.000Z')
  })

  it('resta los minutos del preset', () => {
    const iso = computeReminderInstant('2026-08-03', '16:00', '15min')!
    const d = new Date(iso)
    expect(d.getHours()).toBe(15)
    expect(d.getMinutes()).toBe(45)
  })

  it('sin hora, usa las 9:00 del dia de la tarea', () => {
    const iso = computeReminderInstant('2026-08-03', null, 'mismo-dia')!
    const d = new Date(iso)
    expect(d.getHours()).toBe(9)
    expect(d.getDate()).toBe(3)
  })

  it('sin hora, un dia antes cae a las 9:00 del dia anterior', () => {
    const iso = computeReminderInstant('2026-08-03', null, '1d')!
    const d = new Date(iso)
    expect(d.getHours()).toBe(9)
    expect(d.getDate()).toBe(2)
  })

  it('devuelve null para personalizado y para claves desconocidas', () => {
    expect(computeReminderInstant('2026-08-03', '16:00', 'custom')).toBeNull()
    expect(computeReminderInstant('2026-08-03', '16:00', 'inventada')).toBeNull()
    expect(computeReminderInstant('', '16:00', '15min')).toBeNull()
  })

  it('no ofrece presets por minutos a una tarea sin hora', () => {
    expect(computeReminderInstant('2026-08-03', null, '15min')).toBeNull()
  })
})

describe('computeCustomInstant', () => {
  it('interpreta la fecha y hora escritas en la zona del navegador', () => {
    expect(computeCustomInstant('2026-08-03', '11:06')).toBe('2026-08-03T17:06:00.000Z')
  })

  it('devuelve null sin fecha', () => {
    expect(computeCustomInstant('', '11:06')).toBeNull()
  })
})

describe('detectReminderKey', () => {
  it('reconoce un recordatorio guardado como el mismo preset (ida y vuelta)', () => {
    const iso = computeReminderInstant('2026-08-03', '16:00', '1h')!
    expect(detectReminderKey(iso, '2026-08-03', '16:00')).toBe('1h')
  })

  it('hace la ida y vuelta tambien sin hora', () => {
    const iso = computeReminderInstant('2026-08-03', null, '1w')!
    expect(detectReminderKey(iso, '2026-08-03', null)).toBe('1w')
  })

  it('cae en personalizado cuando no coincide con ningun preset', () => {
    expect(detectReminderKey('2026-08-01T13:00:00.000Z', '2026-08-03', '16:00')).toBe('custom')
  })

  it('devuelve cadena vacia sin recordatorio', () => {
    expect(detectReminderKey(null, '2026-08-03', '16:00')).toBe('')
  })
})

describe('formatReminderLabel', () => {
  it('usa la etiqueta del preset cuando coincide', () => {
    const iso = computeReminderInstant('2026-08-03', '16:00', '2h')!
    expect(formatReminderLabel(iso, '2026-08-03', '16:00')).toBe('2 horas antes')
  })

  it('para uno personalizado muestra la fecha y hora locales', () => {
    const iso = computeCustomInstant('2026-08-01', '13:30')!
    expect(formatReminderLabel(iso, '2026-08-03', '16:00')).toBe('1 ago 13:30')
  })
})
```

- [ ] **Step 3: Correr las pruebas y verificar que fallan**

```bash
npm test -- lib/timeline/reminder-picker.test.ts
```

Esperado: FALLA porque `lib/timeline/reminder-picker.ts` no existe.

- [ ] **Step 4: Escribir el módulo**

Crear `lib/timeline/reminder-picker.ts`:

```ts
export type ReminderPreset = {
  value: string
  label: string
  minutes: number | null
}

export const ALLDAY_REMINDER_HOUR = 9

const CUSTOM: ReminderPreset = { value: 'custom', label: 'Personalizado...', minutes: null }

export const TIMED_PRESETS: ReminderPreset[] = [
  { value: 'exacta', label: 'A la hora de la tarea', minutes: 0 },
  { value: '15min',  label: '15 minutos antes',     minutes: 15 },
  { value: '30min',  label: '30 minutos antes',     minutes: 30 },
  { value: '1h',     label: '1 hora antes',         minutes: 60 },
  { value: '2h',     label: '2 horas antes',        minutes: 120 },
  { value: '1d',     label: '1 día antes',          minutes: 60 * 24 },
  { value: '2d',     label: '2 días antes',         minutes: 60 * 24 * 2 },
  { value: '1w',     label: '1 semana antes',       minutes: 60 * 24 * 7 },
  CUSTOM,
]

export const ALLDAY_PRESETS: ReminderPreset[] = [
  { value: 'mismo-dia', label: `El mismo día a las ${ALLDAY_REMINDER_HOUR}:00`,   minutes: 0 },
  { value: '1d',        label: `1 día antes a las ${ALLDAY_REMINDER_HOUR}:00`,    minutes: 60 * 24 },
  { value: '2d',        label: `2 días antes a las ${ALLDAY_REMINDER_HOUR}:00`,   minutes: 60 * 24 * 2 },
  { value: '1w',        label: `1 semana antes a las ${ALLDAY_REMINDER_HOUR}:00`, minutes: 60 * 24 * 7 },
  CUSTOM,
]

const MONTH_ABBR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

export function reminderPresetsFor(taskTime: string | null): ReminderPreset[] {
  return taskTime ? TIMED_PRESETS : ALLDAY_PRESETS
}

// La fecha y la hora de la tarea no guardan zona, asi que se interpretan en la
// del navegador. Devolver un Date (un instante) en vez de texto es lo que evita
// que el valor se guarde como si fuera UTC.
function baseInstant(taskDate: string, taskTime: string | null): Date | null {
  if (!taskDate) return null
  const [y, mo, d] = taskDate.split('-').map(Number)
  const [h, min] = (taskTime ?? `${ALLDAY_REMINDER_HOUR}:00`).split(':').map(Number)
  if ([y, mo, d, h, min].some(Number.isNaN)) return null
  const base = new Date(y, mo - 1, d, h, min, 0, 0)
  return Number.isNaN(base.getTime()) ? null : base
}

export function computeReminderInstant(
  taskDate: string,
  taskTime: string | null,
  key: string,
): string | null {
  const preset = reminderPresetsFor(taskTime).find(p => p.value === key)
  if (!preset || preset.minutes === null) return null
  const base = baseInstant(taskDate, taskTime)
  if (!base) return null
  return new Date(base.getTime() - preset.minutes * 60000).toISOString()
}

export function computeCustomInstant(date: string, time: string): string | null {
  const instant = baseInstant(date, time || `${ALLDAY_REMINDER_HOUR}:00`)
  return instant ? instant.toISOString() : null
}

export function detectReminderKey(
  reminderDate: string | null,
  taskDate: string,
  taskTime: string | null,
): string {
  if (!reminderDate) return ''
  const base = baseInstant(taskDate, taskTime)
  const remTs = new Date(reminderDate).getTime()
  if (!base || Number.isNaN(remTs)) return 'custom'
  const diffMin = Math.round((base.getTime() - remTs) / 60000)
  const match = reminderPresetsFor(taskTime).find(p => p.minutes === diffMin)
  return match ? match.value : 'custom'
}

export function formatReminderLabel(
  reminderDate: string,
  taskDate: string,
  taskTime: string | null,
): string {
  const key = detectReminderKey(reminderDate, taskDate, taskTime)
  const match = reminderPresetsFor(taskTime).find(p => p.value === key && p.minutes !== null)
  if (match) return match.label
  const rd = new Date(reminderDate)
  if (Number.isNaN(rd.getTime())) return ''
  const hh = rd.getHours()
  const mm = rd.getMinutes().toString().padStart(2, '0')
  return `${rd.getDate()} ${MONTH_ABBR[rd.getMonth()]} ${hh}:${mm}`
}
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

```bash
npm test -- lib/timeline/reminder-picker.test.ts
```

Esperado: PASA, 17 pruebas.

- [ ] **Step 6: Commit**

```bash
git add lib/timeline/reminder-picker.ts lib/timeline/reminder-picker.test.ts vitest.config.ts
git commit -m "feat(recordatorios): modulo unico que guarda instantes en vez de texto sin zona"
```

---

### Task 2: TaskModal consume el módulo y estrena el selector

**Files:**
- Modify: `app/events/[id]/timeline/TaskModal.tsx`

**Interfaces:**
- Consumes: todo lo que produce Task 1.
- Produces: `TaskModal` deja de exportar `REMINDER_OPTIONS`.

- [ ] **Step 1: Borrar la lógica duplicada e importar el módulo**

Quitar de `TaskModal.tsx` el bloque `export const REMINDER_OPTIONS = [...]` y las funciones `computeReminderDate` y `detectReminderKey` completas. En su lugar, junto al resto de imports:

```ts
import {
  reminderPresetsFor,
  computeReminderInstant,
  computeCustomInstant,
  detectReminderKey,
} from '@/lib/timeline/reminder-picker'
```

- [ ] **Step 2: Calcular el recordatorio con el módulo**

Reemplazar el `useMemo` de `computedReminderDate` por:

```ts
const computedReminderDate = useMemo((): string | null => {
  if (!form.reminder_key) return null
  if (form.reminder_key === 'custom') {
    return computeCustomInstant(form.reminder_custom_date, form.reminder_custom_time)
  }
  return computeReminderInstant(form.task_date, form.task_time || null, form.reminder_key)
}, [form.reminder_key, form.task_date, form.task_time, form.reminder_custom_date, form.reminder_custom_time])
```

En el `useEffect` que carga `editTask`, sustituir la llamada a la función local por la importada (la firma es idéntica):

```ts
const reminderKey = editTask.reminder_date
  ? detectReminderKey(editTask.reminder_date, editTask.task_date, editTask.task_time)
  : ''
```

- [ ] **Step 3: Mover la tarea recalcula el aviso en vez de borrarlo**

En los dos `onChange` de fecha y hora, quitar el `reminder_key: ''`. El `useMemo` ya recalcula solo, porque depende de `task_date` y `task_time`:

```tsx
onChange={e => setForm(f => ({ ...f, task_date: e.target.value }))}
```

```tsx
onChange={e => setForm(f => ({ ...f, task_time: e.target.value }))}
```

Añadir, junto al `setForm` de la hora, el descarte del preset que deja de existir al quitarle la hora a una tarea. Va como función aparte encima del render, para no meter lógica en el JSX:

```ts
const onTaskTimeChange = (value: string) => {
  setForm(f => {
    const sigueValido = reminderPresetsFor(value || null).some(p => p.value === f.reminder_key)
    return { ...f, task_time: value, reminder_key: sigueValido ? f.reminder_key : '' }
  })
}
```

Y el input de hora pasa a usarlo:

```tsx
onChange={e => onTaskTimeChange(e.target.value)}
```

- [ ] **Step 4: El selector ofrece las opciones que correspondan**

Sustituir el `.map` sobre `REMINDER_OPTIONS` por el que sale del módulo:

```tsx
{reminderPresetsFor(form.task_time || null).map(o => (
  <option key={o.value} value={o.value}>{o.label}</option>
))}
```

- [ ] **Step 5: La línea de confirmación también aparece en el modo personalizado**

Sustituir la condición que hoy excluye `custom`, para que el usuario vea siempre cuándo va a sonar. `computedReminderDate` ahora es un ISO, así que se formatea con `Date`:

```tsx
{computedReminderDate && (
  <p className="text-[11px] text-[#48C9B0] mt-1 flex items-center gap-1">
    <Bell size={10} />
    Aviso el {new Date(computedReminderDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
    {' a las '}
    {new Date(computedReminderDate).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
  </p>
)}
```

- [ ] **Step 6: Verificar tipos y suite completa**

```bash
npx tsc --noEmit
npm test
```

Esperado: `tsc` sin errores y la suite entera en verde. Si `tsc` se queja de que `REMINDER_OPTIONS` ya no se exporta, es Task 3: no arreglarlo aquí.

- [ ] **Step 7: Commit**

```bash
git add app/events/[id]/timeline/TaskModal.tsx
git commit -m "fix(recordatorios): el modal guarda la hora que muestra y ofrece presets segun la tarea"
```

---

### Task 3: TaskCard consume el módulo

**Files:**
- Modify: `app/events/[id]/timeline/TaskCard.tsx:19-28` (constante duplicada) y `:89-100` (`formatReminderLabel`)

**Interfaces:**
- Consumes: `formatReminderLabel` de Task 1.
- Produces: `TaskCard` conserva su export `formatReminderLabel` con la misma firma, ahora como reexport, para no tocar a quien lo importe.

- [ ] **Step 1: Borrar la copia y reexportar la del módulo**

Quitar de `TaskCard.tsx` el bloque `const REMINDER_OPTIONS = [...]` (líneas 19-28) y el cuerpo de `formatReminderLabel` (líneas 89-100). Agregar el import arriba y el reexport donde estaba la función:

```ts
import { formatReminderLabel } from '@/lib/timeline/reminder-picker'
```

```ts
export { formatReminderLabel }
```

`MONTH_NAMES` se queda: lo usan `formatDate` y otras funciones de la tarjeta.

- [ ] **Step 2: Verificar tipos y suite completa**

```bash
npx tsc --noEmit
npm test
```

Esperado: ambos limpios. Si `tsc` marca `MONTH_NAMES` sin usar, revisar que `formatDate` siga usándolo antes de borrar nada.

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/timeline/TaskCard.tsx
git commit -m "fix(recordatorios): la tarjeta lee la etiqueta del modulo compartido"
```

---

### Task 4: Verificación contra producción

**Files:** ninguno.

**Interfaces:**
- Consumes: el trabajo de las tres tareas anteriores.
- Produces: la evidencia para decidir si se enciende el `schedule`.

- [ ] **Step 1: Levantar el entorno**

```bash
npm run dev
```

El worktree es hermano del repo, no anidado, así que las rutas API responden.

- [ ] **Step 2: Probar los cuatro casos en el navegador**

En el timeline de un evento:
1. Tarea **con** hora: el menú ofrece "A la hora de la tarea" y los presets por minutos.
2. Tarea **sin** hora: el menú ofrece solo los de días, con "a las 9:00" en la etiqueta.
3. Elegir "1 hora antes", cambiar la hora de la tarea y confirmar que el aviso se recalcula en vez de desaparecer.
4. Guardar, reabrir la tarea y confirmar que el selector muestra el mismo preso que se eligió, no "Personalizado".

- [ ] **Step 3: Confirmar contra la base**

Consultar la fila recién creada y comprobar que `reminder_date` corresponde a la hora que muestra la pantalla:

```bash
curl.exe -s -H "apikey: $env:SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $env:SUPABASE_SERVICE_ROLE_KEY" "$env:NEXT_PUBLIC_SUPABASE_URL/rest/v1/event_timeline_tasks?select=title,task_date,task_time,reminder_date&order=created_at.desc&limit=1"
```

Esperado: para una tarea a las 16:00 con "1 hora antes" en México, `reminder_date` debe ser `21:00:00+00:00`, no `15:00:00+00:00`.

- [ ] **Step 4: Push y PR**

```bash
git branch --show-current
git push -u origin fix/recordatorios-zona-horaria
gh pr create --base main --title "fix(recordatorios): la hora que se muestra es la que se guarda" --body "Ver docs/superpowers/specs/2026-08-03-recordatorios-timeline-design.md"
```

**Detenerse aquí.** El merge y el encendido del `schedule` los decide Diego, en ese orden y no antes.

---

## Ajustes hechos durante la ejecución

- **Se conserva el texto "Fecha personalizada"** en vez de cambiarlo a "Personalizado...". Decisión de Diego: el cambio de copy no aportaba nada y sumaba diff.
- **Se agregó `localDateTimeParts(iso)` al módulo**, que el plan no preveía. Sin ella, al reabrir una tarea con fecha personalizada los campos se llenaban partiendo el texto ISO —que ahora viene en UTC— y mostraban la hora corrida. Son 2 pruebas más: 19 en total.
- Los 2 errores de `react-hooks/set-state-in-effect` que ESLint marca en `TaskModal.tsx` son **anteriores a este trabajo**: verificado lintando la versión de `HEAD`, que da exactamente los mismos 2.

## Nota de coordinación

`TaskModal.tsx` lo está tocando también la rama `feat/modal-primitivo-viewport-ios` (migración al primitivo `Modal`). Las dos ramas van a chocar en ese archivo. Conviene que la de modales entre a `main` primero, porque su cambio es estructural y este es local a un bloque; rebasar este encima de aquel es más barato que al revés.
