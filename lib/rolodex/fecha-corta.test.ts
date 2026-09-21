import { describe, it, expect } from 'vitest'
import {formatFechaCorta, fechaCortaISO, MESES_CORTOS } from './fecha-corta'

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

describe('fechaCortaISO', () => {
  it('parte la fecha a mano: 2026-07-26 es 26 jul, sin corrimiento UTC', () => {
    expect(fechaCortaISO('2026-07-26')).toBe('26 jul')
    expect(fechaCortaISO('2026-01-01')).toBe('1 ene')
  })
  it('vacio o basura devuelve cadena vacia', () => {
    expect(fechaCortaISO(null)).toBe('')
    expect(fechaCortaISO('hoy')).toBe('')
  })
  it('los meses son doce', () => {
    expect(MESES_CORTOS).toHaveLength(12)
  })
})
