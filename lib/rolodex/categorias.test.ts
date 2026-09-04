import { describe, it, expect } from 'vitest'
import {
  CATEGORIAS_BASE, resolverVocabulario, agregarAlVocabulario, mismaCategoria,
} from './categorias'

describe('resolverVocabulario', () => {
  it('un planner sin vocabulario guardado arranca con las base', () => {
    expect(resolverVocabulario(null)).toEqual(CATEGORIAS_BASE)
    expect(resolverVocabulario([])).toEqual(CATEGORIAS_BASE)
  })

  it('lo que el planner invento se conserva junto a las base', () => {
    const v = resolverVocabulario(['Ambulancia y paramedicos'])
    expect(v).toContain('Ambulancia y paramedicos')
    expect(v).toContain('Venue')
  })

  it('no repite una base que ya venia guardada', () => {
    const v = resolverVocabulario(['Venue', 'Ambulancia y paramedicos'])
    expect(v.filter(c => c === 'Venue')).toHaveLength(1)
  })
})

describe('agregarAlVocabulario', () => {
  it('agrega una categoria nueva al final', () => {
    expect(agregarAlVocabulario(['Venue'], 'Pirotecnia')).toEqual(['Venue', 'Pirotecnia'])
  })

  it('no duplica aunque cambie la caja o sobren espacios', () => {
    expect(agregarAlVocabulario(['Venue'], '  venue ')).toEqual(['Venue'])
  })

  it('ignora un nombre vacio', () => {
    expect(agregarAlVocabulario(['Venue'], '   ')).toEqual(['Venue'])
  })
})

describe('mismaCategoria', () => {
  it('compara sin distinguir caja ni espacios', () => {
    expect(mismaCategoria('Venue', ' venue ')).toBe(true)
    expect(mismaCategoria('Venue', 'Banquete')).toBe(false)
  })
})
