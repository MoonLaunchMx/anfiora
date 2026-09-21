import { describe, it, expect } from 'vitest'
import { parecidas, puedeEliminarse } from './vocabulario-admin'

describe('parecidas', () => {
  it('encuentra un plural', () => {
    expect(parecidas(['Decoracion', 'Decoraciones'])).toEqual([['Decoracion', 'Decoraciones']])
  })

  it('encuentra cuando una empieza igual que la otra', () => {
    expect(parecidas(['Audio', 'Audio y Video'])).toEqual([['Audio', 'Audio y Video']])
  })

  it('no inventa parecidos entre categorias distintas', () => {
    expect(parecidas(['Venue', 'Banquete', 'Pirotecnia'])).toEqual([])
  })

  it('no reporta el mismo par dos veces', () => {
    expect(parecidas(['Flores', 'Flor'])).toHaveLength(1)
  })

  it('ignora acentos al comparar', () => {
    expect(parecidas(['Decoración', 'Decoracion'])).toHaveLength(1)
  })
})

describe('puedeEliminarse', () => {
  it('solo cuando nadie la usa', () => {
    expect(puedeEliminarse({ proveedores: 0, partidas: 0 })).toBe(true)
    expect(puedeEliminarse({ proveedores: 1, partidas: 0 })).toBe(false)
    expect(puedeEliminarse({ proveedores: 0, partidas: 3 })).toBe(false)
  })
})
