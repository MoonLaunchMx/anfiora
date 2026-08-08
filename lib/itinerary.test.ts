import { describe, it, expect } from 'vitest'
import {
  parseTimeToMinutes,
  formatMinutesToHHMM,
  computeEndTime,
  formatDuration,
  formatMomentRange,
  sortMoments,
  curateForGuests,
  addDays,
  eventDays,
  dayLabel,
  groupByDay,
  ITINERARY_PHASES,
  PHASE_LABEL,
} from './itinerary'
import type { ItineraryMoment } from './types'

function moment(partial: Partial<ItineraryMoment>): ItineraryMoment {
  return {
    id: partial.id ?? 'x',
    event_id: 'e',
    title: partial.title ?? 'Momento',
    start_time: partial.start_time ?? '12:00',
    moment_date: partial.moment_date ?? '2026-09-13',
    duration_min: partial.duration_min ?? null,
    location: partial.location ?? null,
    phase: partial.phase ?? 'otro',
    event_supplier_id: null,
    assigned_to_name: null,
    notes: null,
    visible_to_guests: partial.visible_to_guests ?? false,
    position: partial.position ?? 0,
    created_at: '2026-01-01',
  }
}

describe('parseTimeToMinutes', () => {
  it('parsea HH:MM y HH:MM:SS', () => {
    expect(parseTimeToMinutes('18:00')).toBe(1080)
    expect(parseTimeToMinutes('18:00:00')).toBe(1080)
    expect(parseTimeToMinutes('09:05')).toBe(545)
  })
  it('rechaza valores invalidos', () => {
    expect(parseTimeToMinutes('25:00')).toBeNull()
    expect(parseTimeToMinutes('18:60')).toBeNull()
    expect(parseTimeToMinutes('abc')).toBeNull()
    expect(parseTimeToMinutes(null)).toBeNull()
    expect(parseTimeToMinutes(undefined)).toBeNull()
  })
})

describe('formatMinutesToHHMM', () => {
  it('formatea con padding y wrap de 24h', () => {
    expect(formatMinutesToHHMM(1080)).toBe('18:00')
    expect(formatMinutesToHHMM(545)).toBe('09:05')
    expect(formatMinutesToHHMM(1470)).toBe('00:30')
  })
})

describe('computeEndTime', () => {
  it('suma duracion y cruza medianoche', () => {
    expect(computeEndTime('18:00', 40)).toBe('18:40')
    expect(computeEndTime('23:30', 60)).toBe('00:30')
  })
  it('duracion null o inicio invalido -> null', () => {
    expect(computeEndTime('18:00', null)).toBeNull()
    expect(computeEndTime('bad', 30)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('minutos, horas y mixto', () => {
    expect(formatDuration(40)).toBe('40 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1 h 30 min')
  })
  it('null -> hasta cierre', () => {
    expect(formatDuration(null)).toBe('hasta cierre')
  })
})

describe('formatMomentRange', () => {
  it('rango con fin encadenado', () => {
    expect(formatMomentRange('18:00', 40)).toBe('18:00–18:40')
    expect(formatMomentRange('23:30', 60)).toBe('23:30–00:30')
  })
  it('sin duracion muestra solo el inicio', () => {
    expect(formatMomentRange('18:00', null)).toBe('18:00')
  })
})

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

describe('curateForGuests', () => {
  it('filtra visibles, ordena y mapea a la superficie publica', () => {
    const ms = [
      moment({ id: 'oculto', moment_date: '2026-09-13', start_time: '06:00', visible_to_guests: false }),
      moment({ id: 'ceremonia', moment_date: '2026-09-13', title: 'Ceremonia', start_time: '18:00', location: 'Jardin', visible_to_guests: true }),
      moment({ id: 'fiesta', moment_date: '2026-09-13', title: 'Fiesta', start_time: '01:00', visible_to_guests: true }),
    ]
    expect(curateForGuests(ms)).toEqual([
      { start_time: '01:00', title: 'Fiesta', location: null },
      { start_time: '18:00', title: 'Ceremonia', location: 'Jardin' },
    ])
  })
})

describe('constantes de fase', () => {
  it('las 6 fases tienen etiqueta', () => {
    for (const p of ITINERARY_PHASES) {
      expect(typeof PHASE_LABEL[p]).toBe('string')
    }
    expect(ITINERARY_PHASES).toHaveLength(6)
  })
})

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

describe('dayLabel', () => {
  it('devuelve dia de la semana y fecha corta en espanol', () => {
    expect(dayLabel('2026-09-12')).toEqual({ dow: 'Sábado', num: '12 sep' })
    expect(dayLabel('2026-09-14')).toEqual({ dow: 'Lunes', num: '14 sep' })
  })
  it('dia sin cero a la izquierda se formatea sin padding', () => {
    expect(dayLabel('2026-09-05')).toEqual({ dow: 'Sábado', num: '5 sep' })
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
