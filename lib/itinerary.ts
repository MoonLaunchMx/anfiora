import type { ItineraryMoment, ItineraryPhase, GuestItineraryItem } from './types'

export const ITINERARY_PHASES: ItineraryPhase[] = [
  'montaje', 'ceremonia', 'social', 'cena', 'fiesta', 'otro',
]

export const PHASE_LABEL: Record<ItineraryPhase, string> = {
  montaje:   'Montaje',
  ceremonia: 'Ceremonia',
  social:    'Social',
  cena:      'Cena',
  fiesta:    'Fiesta',
  otro:      'Otro',
}

export const PHASE_COLOR: Record<ItineraryPhase, { text: string; bg: string; border: string }> = {
  montaje:   { text: '#666666', bg: '#f2f2f2', border: '#e0e0e0' },
  ceremonia: { text: '#c49a3a', bg: '#fffbf0', border: '#f0e2c0' },
  social:    { text: '#0F6E56', bg: '#f0fdfb', border: '#c8ede7' },
  cena:      { text: '#b8860b', bg: '#fdf6e3', border: '#f0e0b0' },
  fiesta:    { text: '#8b5ca8', bg: '#f9f2fc', border: '#e8d5f0' },
  otro:      { text: '#888888', bg: '#f8f8f8', border: '#e8e8e8' },
}

export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t || typeof t !== 'string') return null
  const parts = t.split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function formatMinutesToHHMM(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}`
}

export function computeEndTime(startTime: string, durationMin: number | null): string | null {
  const mins = parseTimeToMinutes(startTime)
  if (mins === null || durationMin === null) return null
  return formatMinutesToHHMM(mins + durationMin)
}

export function formatDuration(durationMin: number | null): string {
  if (durationMin === null) return 'hasta cierre'
  if (durationMin < 60) return `${durationMin} min`
  const h = Math.floor(durationMin / 60)
  const m = durationMin % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function formatMomentRange(startTime: string, durationMin: number | null): string {
  const mins = parseTimeToMinutes(startTime)
  const start = mins === null ? startTime : formatMinutesToHHMM(mins)
  const end = computeEndTime(startTime, durationMin)
  return end ? `${start}–${end}` : start
}

export function sortMoments<T extends { moment_date: string; start_time: string; position: number }>(moments: T[]): T[] {
  return [...moments].sort((a, b) => {
    if (a.moment_date !== b.moment_date) return a.moment_date < b.moment_date ? -1 : 1
    const ta = parseTimeToMinutes(a.start_time) ?? Number.MAX_SAFE_INTEGER
    const tb = parseTimeToMinutes(b.start_time) ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    return a.position - b.position
  })
}

type CurateInput = Pick<ItineraryMoment, 'moment_date' | 'start_time' | 'title' | 'location' | 'visible_to_guests' | 'position'>

export function curateForGuests(moments: CurateInput[]): GuestItineraryItem[] {
  return sortMoments(moments.filter(m => m.visible_to_guests)).map(m => {
    const mins = parseTimeToMinutes(m.start_time)
    return {
      start_time: mins === null ? m.start_time : formatMinutesToHHMM(mins),
      title: m.title,
      location: m.location,
    }
  })
}

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
