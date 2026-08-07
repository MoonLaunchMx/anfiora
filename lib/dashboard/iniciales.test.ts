import { describe, it, expect } from 'vitest'
import { iniciales } from './iniciales'

describe('iniciales', () => {
  it('una pareja con & se lee como pareja', () => {
    expect(iniciales('Olivia & Pedro')).toBe('O&P')
  })

  it('una pareja unida por "y" tambien', () => {
    expect(iniciales('Ana y Rodrigo')).toBe('A&R')
  })

  it('el conector no aporta su letra', () => {
    expect(iniciales('Ana y Rodrigo')).not.toContain('Y')
  })

  it('un nombre que no es pareja se abrevia corrido', () => {
    expect(iniciales('Gala Anual')).toBe('GA')
  })

  it('una sola palabra da una sola letra', () => {
    expect(iniciales('TechCorp')).toBe('T')
  })

  it('ignora palabras de relleno al inicio', () => {
    expect(iniciales('La Boda de Sofia')).toBe('BS')
  })

  it('los acentos no ensucian la inicial', () => {
    expect(iniciales('Ángela y Óscar')).toBe('A&O')
  })

  it('toma solo las dos primeras', () => {
    expect(iniciales('Gala Anual TechCorp 2027')).toHaveLength(2)
  })

  it('un nombre vacio o de puro simbolo no revienta', () => {
    expect(iniciales('')).toBe('?')
    expect(iniciales('   ')).toBe('?')
    expect(iniciales('&&&')).toBe('?')
  })

  it('un numero sirve como inicial', () => {
    expect(iniciales('15 Sofia')).toBe('1S')
  })
})
