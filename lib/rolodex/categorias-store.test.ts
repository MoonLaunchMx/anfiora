import { describe, it, expect } from 'vitest'
import { activas, buscarPorNombre, nombrePorId, type Categoria } from './categorias-store'

const cats: Categoria[] = [
  { id: 'a', name: 'Venue', archived_at: null },
  { id: 'b', name: 'Decoración', archived_at: null },
  { id: 'c', name: 'Pirotecnia', archived_at: '2026-09-01T00:00:00Z' },
]

describe('activas', () => {
  it('deja fuera las ocultas', () => {
    expect(activas(cats).map(c => c.id)).toEqual(['a', 'b'])
  })
})

describe('buscarPorNombre', () => {
  it('encuentra sin distinguir caja ni acentos', () => {
    expect(buscarPorNombre(cats, 'decoracion')?.id).toBe('b')
    expect(buscarPorNombre(cats, '  VENUE ')?.id).toBe('a')
  })

  it('devuelve null cuando no existe', () => {
    expect(buscarPorNombre(cats, 'Mariachi')).toBeNull()
  })

  it('tambien encuentra una oculta: existe aunque no se ofrezca', () => {
    expect(buscarPorNombre(cats, 'Pirotecnia')?.id).toBe('c')
  })
})

describe('nombrePorId', () => {
  it('devuelve el nombre de la categoria', () => {
    expect(nombrePorId(cats, 'b')).toBe('Decoración')
  })

  it('devuelve cadena vacia si no hay id o no se encuentra', () => {
    expect(nombrePorId(cats, null)).toBe('')
    expect(nombrePorId(cats, 'zzz')).toBe('')
  })
})
