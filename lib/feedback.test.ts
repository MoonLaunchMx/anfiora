import { describe, it, expect } from 'vitest'
import { formatFeedbackMessage, isFeedbackType, FEEDBACK_TYPES } from './feedback'

const baseUser = { name: 'Diego', email: 'd@x.com', plan: 'pro' }

describe('formatFeedbackMessage', () => {
  it('pone el prefijo correcto por tipo', () => {
    expect(formatFeedbackMessage({ type: 'sugerencia', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[SUGERENCIA]')
    expect(formatFeedbackMessage({ type: 'nota', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[NOTA]')
    expect(formatFeedbackMessage({ type: 'error', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[ERROR]')
  })

  it('incluye correo, plan y pagina', () => {
    const out = formatFeedbackMessage({ type: 'nota', message: 'algo', page: '/events/1/timeline', user: baseUser })
    expect(out).toContain('d@x.com')
    expect(out).toContain('pro')
    expect(out).toContain('/events/1/timeline')
    expect(out).toContain('algo')
  })

  it('no rompe con caracteres especiales en el mensaje', () => {
    const msg = 'bug con <script> & "comillas" 100% roto'
    const out = formatFeedbackMessage({ type: 'error', message: msg, page: '/x', user: baseUser })
    expect(out).toContain(msg)
  })

  it('incluye el evento solo si viene', () => {
    const con = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: baseUser, eventName: 'Boda Ana' })
    expect(con).toContain('Boda Ana')
    const sin = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: baseUser })
    expect(sin).not.toContain('Evento:')
  })

  it('usa fallback cuando no hay nombre', () => {
    const out = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: { name: '', email: 'e@x.com', plan: 'free' } })
    expect(out).toContain('Sin nombre')
  })
})

describe('isFeedbackType', () => {
  it('acepta los tres validos y rechaza el resto', () => {
    expect(isFeedbackType('sugerencia')).toBe(true)
    expect(isFeedbackType('nota')).toBe(true)
    expect(isFeedbackType('error')).toBe(true)
    expect(isFeedbackType('otro')).toBe(false)
    expect(isFeedbackType(null)).toBe(false)
    expect(isFeedbackType(3)).toBe(false)
  })
})

describe('FEEDBACK_TYPES', () => {
  it('tiene los tres tipos con label', () => {
    expect(FEEDBACK_TYPES.map(t => t.value)).toEqual(['sugerencia', 'nota', 'error'])
    expect(FEEDBACK_TYPES.every(t => t.label.length > 0)).toBe(true)
  })
})
