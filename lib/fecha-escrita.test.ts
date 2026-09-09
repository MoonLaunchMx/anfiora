import { describe, it, expect } from 'vitest'
import { maskDateInput, parseTypedDate, formatTypedDate, isCompleteDateInput } from './fecha-escrita'

describe('maskDateInput', () => {
  it('deja pasar los primeros dos digitos sin separador', () => {
    expect(maskDateInput('0')).toBe('0')
    expect(maskDateInput('09')).toBe('09')
  })

  it('agrega el separador al tercer digito', () => {
    expect(maskDateInput('091')).toBe('09/1')
    expect(maskDateInput('0912')).toBe('09/12')
  })

  it('agrega el segundo separador al quinto digito', () => {
    expect(maskDateInput('09122026')).toBe('09/12/2026')
  })

  it('ignora lo que no sea digito y no crece de ocho', () => {
    expect(maskDateInput('09/12/2026')).toBe('09/12/2026')
    expect(maskDateInput('09-12-2026999')).toBe('09/12/2026')
    expect(maskDateInput('abc')).toBe('')
  })
})

describe('parseTypedDate', () => {
  it('convierte una fecha completa a formato ISO', () => {
    expect(parseTypedDate('09/12/2026')).toBe('2026-12-09')
    expect(parseTypedDate('01/01/2027')).toBe('2027-01-01')
  })

  it('regresa null si esta incompleta', () => {
    expect(parseTypedDate('09/12/20')).toBeNull()
    expect(parseTypedDate('')).toBeNull()
  })

  it('rechaza dias que no existen en ese mes', () => {
    expect(parseTypedDate('31/02/2026')).toBeNull()
    expect(parseTypedDate('31/04/2026')).toBeNull()
    expect(parseTypedDate('30/02/2026')).toBeNull()
  })

  it('acepta el 29 de febrero solo en bisiesto', () => {
    expect(parseTypedDate('29/02/2028')).toBe('2028-02-29')
    expect(parseTypedDate('29/02/2026')).toBeNull()
  })

  it('rechaza mes cero, mes trece y dia cero', () => {
    expect(parseTypedDate('10/00/2026')).toBeNull()
    expect(parseTypedDate('10/13/2026')).toBeNull()
    expect(parseTypedDate('00/10/2026')).toBeNull()
  })

  it('rechaza anios anteriores a 1900', () => {
    expect(parseTypedDate('10/10/1899')).toBeNull()
  })
})

describe('formatTypedDate', () => {
  it('convierte de ISO a lo que se teclea', () => {
    expect(formatTypedDate('2026-12-09')).toBe('09/12/2026')
  })

  it('tolera un timestamp completo', () => {
    expect(formatTypedDate('2026-12-09T00:00:00Z')).toBe('09/12/2026')
  })

  it('regresa vacio si no hay fecha', () => {
    expect(formatTypedDate('')).toBe('')
  })
})

describe('isCompleteDateInput', () => {
  it('solo es completa con ocho digitos', () => {
    expect(isCompleteDateInput('09/12/2026')).toBe(true)
    expect(isCompleteDateInput('09/12/202')).toBe(false)
  })
})
