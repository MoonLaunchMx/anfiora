import { describe, it, expect } from 'vitest'
import { esVariosDias, formatFechaEvento, textoFechaPortada, detallesSoloLugar } from './fechas'

describe('esVariosDias', () => {
  it('es de varios dias cuando el fin es otro dia', () => {
    expect(esVariosDias('2026-10-09', '2026-10-11')).toBe(true)
  })
  it('no lo es cuando el fin es el mismo dia, falta o la fecha esta vacia', () => {
    expect(esVariosDias('2026-10-09', '2026-10-09')).toBe(false)
    expect(esVariosDias('2026-10-09', null)).toBe(false)
    expect(esVariosDias(null, '2026-10-11')).toBe(false)
  })
})

describe('formatFechaEvento', () => {
  it('un solo dia lleva el dia de la semana', () => {
    expect(formatFechaEvento('2026-10-09', null)).toBe('viernes, 9 de octubre de 2026')
    expect(formatFechaEvento('2026-10-09', '2026-10-09')).toBe('viernes, 9 de octubre de 2026')
  })
  it('mismo mes: no repite mes ni año', () => {
    expect(formatFechaEvento('2026-10-09', '2026-10-11')).toBe('9 al 11 de octubre de 2026')
  })
  it('meses distintos: repite mes, no año', () => {
    expect(formatFechaEvento('2026-10-30', '2026-11-02')).toBe('30 de octubre al 2 de noviembre de 2026')
  })
  it('años distintos: dice los dos años', () => {
    expect(formatFechaEvento('2026-12-30', '2027-01-02')).toBe('30 de diciembre de 2026 al 2 de enero de 2027')
  })
  it('sin fecha no inventa nada', () => {
    expect(formatFechaEvento(null, null)).toBe('')
  })
})

describe('textoFechaPortada', () => {
  it('automatica usa el rango completo', () => {
    expect(textoFechaPortada('auto', '', '2026-10-09', '2026-10-11')).toBe('9 al 11 de octubre de 2026')
  })
  it('solo el dia principal ignora el fin', () => {
    expect(textoFechaPortada('inicio', '', '2026-10-09', '2026-10-11')).toBe('viernes, 9 de octubre de 2026')
  })
  it('el texto propio manda, y vacio no pinta nada', () => {
    expect(textoFechaPortada('libre', '  Fin de semana del 9 al 11  ', '2026-10-09', '2026-10-11')).toBe('Fin de semana del 9 al 11')
    expect(textoFechaPortada('libre', '   ', '2026-10-09', '2026-10-11')).toBe('')
  })
})

describe('detallesSoloLugar', () => {
  it('varios dias con itinerario: el bloque se queda en como llegar', () => {
    expect(detallesSoloLugar('2026-10-09', '2026-10-11', 6)).toBe(true)
  })
  it('varios dias sin itinerario: conserva fecha y hora', () => {
    expect(detallesSoloLugar('2026-10-09', '2026-10-11', 0)).toBe(false)
  })
  it('un solo dia no cambia aunque tenga itinerario', () => {
    expect(detallesSoloLugar('2026-10-09', '2026-10-09', 4)).toBe(false)
    expect(detallesSoloLugar('2026-10-09', null, 4)).toBe(false)
  })
})
