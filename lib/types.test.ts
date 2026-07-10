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
