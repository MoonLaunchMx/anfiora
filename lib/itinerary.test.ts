import { describe, it, expect } from 'vitest'
import {
  parseTimeToMinutes,
  formatMinutesToHHMM,
  computeEndTime,
  formatDuration,
  formatMomentRange,
  momentOrderMinutes,
  sortMoments,
  curateForGuests,
  DAY_START_HOUR,
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

describe('momentOrderMinutes (cruce de medianoche)', () => {
  it('la madrugada va despues de la tarde', () => {
    expect(momentOrderMinutes('06:00')).toBe(360)
    expect(momentOrderMinutes('18:00')).toBe(1080)
    expect(momentOrderMinutes('01:00')).toBe(1500)
  })
  it('usa DAY_START_HOUR como corte', () => {
    expect(DAY_START_HOUR).toBe(6)
  })
})

describe('sortMoments', () => {
  it('ordena con cruce de medianoche y desempata por position', () => {
    const ms = [
      moment({ id: 'fiesta', start_time: '01:00', position: 0 }),
      moment({ id: 'cena', start_time: '20:00', position: 0 }),
      moment({ id: 'montaje', start_time: '06:00', position: 0 }),
      moment({ id: 'ceremonia', start_time: '18:00', position: 0 }),
    ]
    expect(sortMoments(ms).map(m => m.id)).toEqual(['montaje', 'ceremonia', 'cena', 'fiesta'])
  })
  it('mismo inicio -> respeta position', () => {
    const ms = [
      moment({ id: 'b', start_time: '18:00', position: 2 }),
      moment({ id: 'a', start_time: '18:00', position: 1 }),
    ]
    expect(sortMoments(ms).map(m => m.id)).toEqual(['a', 'b'])
  })
})

describe('curateForGuests', () => {
  it('filtra visibles, ordena y mapea a la superficie publica', () => {
    const ms = [
      moment({ id: 'oculto', start_time: '06:00', visible_to_guests: false }),
      moment({ id: 'ceremonia', title: 'Ceremonia', start_time: '18:00', location: 'Jardin', visible_to_guests: true }),
      moment({ id: 'fiesta', title: 'Fiesta', start_time: '01:00', visible_to_guests: true }),
    ]
    expect(curateForGuests(ms)).toEqual([
      { start_time: '18:00', title: 'Ceremonia', location: 'Jardin' },
      { start_time: '01:00', title: 'Fiesta', location: null },
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
