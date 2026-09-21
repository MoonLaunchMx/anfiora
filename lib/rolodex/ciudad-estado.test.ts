import { describe, it, expect } from 'vitest'
import { ciudadSigueSiendoValida } from './ciudad-estado'

describe('ciudadSigueSiendoValida', () => {
  it('sin ciudad escrita no hay nada que perder', () => {
    expect(ciudadSigueSiendoValida('', ['Monterrey', 'Guadalupe'])).toBe(true)
  })

  it('la ciudad esta en el catalogo del estado nuevo: se conserva', () => {
    expect(ciudadSigueSiendoValida('Monterrey', ['Monterrey', 'Guadalupe'])).toBe(true)
  })

  it('compara sin acentos ni mayusculas, como el resto de geo', () => {
    expect(ciudadSigueSiendoValida('queretaro', ['Querétaro', 'Corregidora'])).toBe(true)
  })

  it('la ciudad no esta en el catalogo del estado nuevo: se borra', () => {
    expect(ciudadSigueSiendoValida('Guadalajara', ['Monterrey', 'Guadalupe'])).toBe(false)
  })

  it('sin catalogo de ciudades para ese estado, no hay forma de invalidar: se conserva', () => {
    expect(ciudadSigueSiendoValida('Miami', [])).toBe(true)
  })
})
