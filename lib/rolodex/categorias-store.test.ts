import { describe, it, expect } from 'vitest'
import { activas, agregarCategoria, buscarPorNombre, nombrePorId, type Categoria } from './categorias-store'

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

describe('agregarCategoria', () => {
  it('agrega una categoria recien creada para que quede usable de inmediato', () => {
    const nueva: Categoria = { id: 'd', name: 'Mariachi', archived_at: null }
    const resultado = agregarCategoria(cats, nueva)
    expect(resultado.map(c => c.id)).toContain('d')
    expect(resultado.find(c => c.id === 'd')).toEqual(nueva)
  })

  it('no duplica si la categoria ya estaba en la lista', () => {
    const yaExiste: Categoria = { id: 'a', name: 'Venue', archived_at: null }
    const resultado = agregarCategoria(cats, yaExiste)
    expect(resultado).toEqual(cats)
  })

  it('deja el resultado ordenado por nombre', () => {
    const nueva: Categoria = { id: 'd', name: 'Ambientacion', archived_at: null }
    const resultado = agregarCategoria(cats, nueva)
    expect(resultado.map(c => c.name)).toEqual(['Ambientacion', 'Decoración', 'Pirotecnia', 'Venue'])
  })
})
