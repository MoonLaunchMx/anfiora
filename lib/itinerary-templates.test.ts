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
