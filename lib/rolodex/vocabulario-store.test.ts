import { describe, it, expect } from 'vitest'
import { categoriasParaGuardar } from './vocabulario-store'

describe('categoriasParaGuardar', () => {
  it('mete al vocabulario lo que el evento invento', () => {
    const r = categoriasParaGuardar(['Venue'], ['Venue', 'Ambulancia y paramedicos'])
    expect(r).toEqual(['Venue', 'Ambulancia y paramedicos'])
  })

  it('devuelve null cuando el evento no aporta nada nuevo', () => {
    expect(categoriasParaGuardar(['Venue', 'Banquete'], ['Venue'])).toBeNull()
  })

  it('no duplica por caja distinta', () => {
    expect(categoriasParaGuardar(['Venue'], ['venue'])).toBeNull()
  })

  it('nunca quita del vocabulario lo que el evento ya no usa', () => {
    const r = categoriasParaGuardar(['Venue', 'Pirotecnia'], ['Venue', 'Banquete'])
    expect(r).toEqual(['Venue', 'Pirotecnia', 'Banquete'])
  })
})
