import { describe, it, expect } from 'vitest'
import { expandTemplate, dayTypesFor, templateFor, type DayTemplate } from './itinerary-templates'
import { EVENT_TYPES } from './event-types'

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
  it('un congreso usa las sesiones base con coffee break', () => {
    expect(templateFor('congreso', 'sesiones').steps.some(s => s.title === 'Coffee break')).toBe(true)
  })
  it('un retiro usa el programa de inmersion, no las sesiones de sala', () => {
    const t = templateFor('retiro', 'sesiones')
    expect(t.steps.some(s => s.title === 'Fogata')).toBe(true)
    expect(templateFor('campamento', 'sesiones').steps.some(s => s.title === 'Fogata')).toBe(true)
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
