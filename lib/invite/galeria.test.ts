import { describe, it, expect } from 'vitest'
import { addFotos, removeFotoAt, moveFoto, MAX_GALERIA_FOTOS } from './galeria'

describe('galeria helpers', () => {
  it('adds new fotos al final', () => {
    expect(addFotos(['a'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('respeta el limite maximo', () => {
    const start = Array.from({ length: MAX_GALERIA_FOTOS }, (_, i) => `f${i}`)
    expect(addFotos(start, ['extra'])).toHaveLength(MAX_GALERIA_FOTOS)
    expect(addFotos(start, ['extra'])).not.toContain('extra')
  })

  it('recorta cuando la tanda nueva excede el limite', () => {
    expect(addFotos(['a'], ['b', 'c'], 2)).toEqual(['a', 'b'])
  })

  it('quita la foto en el indice', () => {
    expect(removeFotoAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  it('mueve una foto a la derecha', () => {
    expect(moveFoto(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('mueve una foto a la izquierda', () => {
    expect(moveFoto(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
  })

  it('no mueve fuera de rango', () => {
    expect(moveFoto(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveFoto(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})
