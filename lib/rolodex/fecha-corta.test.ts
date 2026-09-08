import { describe, it, expect } from 'vitest'
import { formatFechaCorta } from './fecha-corta'

describe('formatFechaCorta', () => {
  it('da dia, mes corto en minusculas y ano de dos digitos', () => {
    expect(formatFechaCorta('2026-09-04T12:00:00.000Z')).toBe('4 sep 26')
  })

  it('acepta otra fecha, a mediodia UTC para no cruzar de dia por zona horaria', () => {
    expect(formatFechaCorta('2026-01-01T12:00:00.000Z')).toBe('1 ene 26')
  })

  it('vacio o invalido da cadena vacia', () => {
    expect(formatFechaCorta(null)).toBe('')
    expect(formatFechaCorta('')).toBe('')
    expect(formatFechaCorta('no-es-fecha')).toBe('')
  })
})
