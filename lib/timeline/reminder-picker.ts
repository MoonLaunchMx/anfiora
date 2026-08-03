export type ReminderPreset = {
  value: string
  label: string
  minutes: number | null
}

export const ALLDAY_REMINDER_HOUR = 9

const CUSTOM: ReminderPreset = { value: 'custom', label: 'Fecha personalizada', minutes: null }

export const TIMED_PRESETS: ReminderPreset[] = [
  { value: 'exacta', label: 'A la hora de la tarea', minutes: 0 },
  { value: '15min',  label: '15 minutos antes',      minutes: 15 },
  { value: '30min',  label: '30 minutos antes',      minutes: 30 },
  { value: '1h',     label: '1 hora antes',          minutes: 60 },
  { value: '2h',     label: '2 horas antes',         minutes: 120 },
  { value: '1d',     label: '1 día antes',           minutes: 60 * 24 },
  { value: '2d',     label: '2 días antes',          minutes: 60 * 24 * 2 },
  { value: '1w',     label: '1 semana antes',        minutes: 60 * 24 * 7 },
  CUSTOM,
]

export const ALLDAY_PRESETS: ReminderPreset[] = [
  { value: 'mismo-dia', label: `El mismo día a las ${ALLDAY_REMINDER_HOUR}:00`,   minutes: 0 },
  { value: '1d',        label: `1 día antes a las ${ALLDAY_REMINDER_HOUR}:00`,    minutes: 60 * 24 },
  { value: '2d',        label: `2 días antes a las ${ALLDAY_REMINDER_HOUR}:00`,   minutes: 60 * 24 * 2 },
  { value: '1w',        label: `1 semana antes a las ${ALLDAY_REMINDER_HOUR}:00`, minutes: 60 * 24 * 7 },
  CUSTOM,
]

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function reminderPresetsFor(taskTime: string | null): ReminderPreset[] {
  return taskTime ? TIMED_PRESETS : ALLDAY_PRESETS
}

// task_date y task_time no guardan zona, asi que se interpretan en la del
// navegador. Devolver un instante (Date) en vez de texto es lo que evita que
// Postgres lo lea como UTC y el aviso suene con el offset de diferencia.
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

// Compara instantes, no texto: lo guardado viene como "...+00:00" y lo recien
// calculado como "...Z". Comparar las cadenas daria "cambio" siempre y
// reenviaria avisos ya entregados con solo reescribir el titulo.
export function reminderChanged(previous: string | null, next: string | null): boolean {
  if (!previous && !next) return false
  if (!previous || !next) return true
  const a = new Date(previous).getTime()
  const b = new Date(next).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return true
  return a !== b
}

// Los campos de "fecha personalizada" se llenan con la hora local, no con la
// UTC que trae el ISO guardado.
export function localDateTimeParts(iso: string): { date: string; time: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => n.toString().padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
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
  const mm = rd.getMinutes().toString().padStart(2, '0')
  return `${rd.getDate()} ${MONTH_ABBR[rd.getMonth()]} ${rd.getHours()}:${mm}`
}
