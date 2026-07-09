import { describe, it, expect } from 'vitest'
import {
  buildItineraryPrompt,
  parseItineraryResponse,
  ITINERARY_SYSTEM_PROMPT,
} from './itinerary-ai'

describe('buildItineraryPrompt', () => {
  it('incluye tipo de evento y horas ancla dadas', () => {
    const p = buildItineraryPrompt({
      eventType: 'boda', eventCategory: 'social',
      ceremonyTime: '17:00', dinnerTime: '20:00', endTime: '02:00', venue: 'Hacienda San Miguel',
    })
    expect(p).toContain('boda')
    expect(p).toContain('17:00')
    expect(p).toContain('20:00')
    expect(p).toContain('02:00')
    expect(p).toContain('Hacienda San Miguel')
  })
  it('omite horas ausentes sin romper', () => {
    const p = buildItineraryPrompt({ eventType: 'boda', eventCategory: 'social' })
    expect(typeof p).toBe('string')
    expect(p).toContain('boda')
  })
  it('el system prompt fija las fases validas', () => {
    expect(ITINERARY_SYSTEM_PROMPT).toContain('ceremonia')
    expect(ITINERARY_SYSTEM_PROMPT).toContain('montaje')
  })
})

describe('parseItineraryResponse', () => {
  const good = JSON.stringify([
    { title: 'Montaje', start_time: '14:00', duration_min: 120, phase: 'montaje', location: 'Salon', notes: null, visible_to_guests: false },
    { title: 'Ceremonia', start_time: '17:00', duration_min: 45, phase: 'ceremonia', location: 'Jardin', notes: 'Puntual', visible_to_guests: true },
  ])

  it('parsea un arreglo JSON directo', () => {
    const r = parseItineraryResponse(good)
    expect(r).toHaveLength(2)
    expect(r[1].title).toBe('Ceremonia')
    expect(r[1].phase).toBe('ceremonia')
  })

  it('parsea JSON dentro de fences markdown', () => {
    const r = parseItineraryResponse('```json\n' + good + '\n```')
    expect(r).toHaveLength(2)
  })

  it('acepta el wrapper { moments: [...] }', () => {
    const r = parseItineraryResponse(JSON.stringify({ moments: JSON.parse(good) }))
    expect(r).toHaveLength(2)
  })

  it('coacciona fase invalida a otro', () => {
    const r = parseItineraryResponse(JSON.stringify([
      { title: 'X', start_time: '10:00', phase: 'xyz', visible_to_guests: true },
    ]))
    expect(r[0].phase).toBe('otro')
  })

  it('descarta item sin titulo o con hora invalida', () => {
    const r = parseItineraryResponse(JSON.stringify([
      { title: '', start_time: '10:00' },
      { title: 'Ok', start_time: '99:99' },
      { title: 'Valido', start_time: '10:00' },
    ]))
    expect(r).toHaveLength(1)
    expect(r[0].title).toBe('Valido')
  })

  it('default de visibilidad: montaje false, resto true', () => {
    const r = parseItineraryResponse(JSON.stringify([
      { title: 'Montaje', start_time: '14:00', phase: 'montaje' },
      { title: 'Coctel', start_time: '19:00', phase: 'social' },
    ]))
    expect(r[0].visible_to_guests).toBe(false)
    expect(r[1].visible_to_guests).toBe(true)
  })

  it('normaliza la hora a HH:MM', () => {
    const r = parseItineraryResponse(JSON.stringify([{ title: 'X', start_time: '9:5' }]))
    expect(r[0].start_time).toBe('09:05')
  })

  it('lanza error si no es JSON valido', () => {
    expect(() => parseItineraryResponse('lo siento, no puedo')).toThrow()
  })

  it('lanza error si el JSON no es arreglo ni wrapper', () => {
    expect(() => parseItineraryResponse('{"foo":1}')).toThrow()
  })
})
