import { describe, it, expect } from 'vitest'
import {
  ordenarFichas,
  letraDe,
  indicePrimeraLetra,
  moverIndice,
  desplazamientoFicha,
  veloFicha,
  escalaFicha,
  indiceAlSoltar,
  puedeAvanzar,
} from './fichero'

const ficha = (name: string) => ({ supplier: { name } })

describe('ordenarFichas', () => {
  it('ordena alfabeticamente en espanol', () => {
    const orden = ordenarFichas([ficha('Zafiro'), ficha('Aurora'), ficha('Ñandú')])
    expect(orden.map(f => f.supplier.name)).toEqual(['Aurora', 'Ñandú', 'Zafiro'])
  })

  it('ignora acentos y mayusculas al comparar', () => {
    const orden = ordenarFichas([ficha('ánimo'), ficha('Alba')])
    expect(orden.map(f => f.supplier.name)).toEqual(['Alba', 'ánimo'])
  })

  it('no muta el arreglo original', () => {
    const original = [ficha('Zafiro'), ficha('Aurora')]
    ordenarFichas(original)
    expect(original[0].supplier.name).toBe('Zafiro')
  })
})

describe('letraDe', () => {
  it('devuelve la inicial en mayuscula', () => {
    expect(letraDe('Aurora')).toBe('A')
  })

  it('quita el acento de la inicial', () => {
    expect(letraDe('Ávila')).toBe('A')
  })

  it('agrupa en # lo que no empieza con letra', () => {
    expect(letraDe('3 Marías')).toBe('#')
    expect(letraDe('')).toBe('#')
  })
})

describe('indicePrimeraLetra', () => {
  it('apunta a la primera ficha de cada letra', () => {
    const mapa = indicePrimeraLetra([ficha('Alba'), ficha('Aurora'), ficha('Bruma')])
    expect(mapa).toEqual({ A: 0, B: 2 })
  })

  it('devuelve un mapa vacio sin fichas', () => {
    expect(indicePrimeraLetra([])).toEqual({})
  })
})

describe('moverIndice', () => {
  it('avanza y retrocede dentro del rango', () => {
    expect(moverIndice(2, 1, 5)).toBe(3)
    expect(moverIndice(2, -1, 5)).toBe(1)
  })

  it('se detiene en los extremos sin dar la vuelta', () => {
    expect(moverIndice(0, -1, 5)).toBe(0)
    expect(moverIndice(4, 1, 5)).toBe(4)
  })

  it('devuelve 0 cuando no hay fichas', () => {
    expect(moverIndice(0, 1, 0)).toBe(0)
  })
})

describe('desplazamientoFicha', () => {
  it('la ficha activa queda al frente', () => {
    expect(desplazamientoFicha(3, 3, 0)).toBe(0)
  })

  it('cuenta la distancia con signo', () => {
    expect(desplazamientoFicha(5, 3, 0)).toBe(2)
    expect(desplazamientoFicha(1, 3, 0)).toBe(-2)
  })

  it('el arrastre corre el cilindro sin cambiar de ficha activa', () => {
    expect(desplazamientoFicha(3, 3, 0.5)).toBe(-0.5)
    expect(desplazamientoFicha(4, 3, 0.5)).toBe(0.5)
  })
})

describe('indiceAlSoltar', () => {
  it('se queda en la ficha mas cercana', () => {
    expect(indiceAlSoltar(3, 0.4, 10)).toBe(3)
    expect(indiceAlSoltar(3, 0.6, 10)).toBe(4)
    expect(indiceAlSoltar(3, -0.6, 10)).toBe(2)
  })

  it('no se sale del fichero', () => {
    expect(indiceAlSoltar(0, -4, 10)).toBe(0)
    expect(indiceAlSoltar(9, 4, 10)).toBe(9)
  })
})

describe('puedeAvanzar', () => {
  it('deja avanzar mientras queden fichas', () => {
    expect(puedeAvanzar(0, 1, 5)).toBe(true)
    expect(puedeAvanzar(4, -1, 5)).toBe(true)
  })

  // Si el fichero se queda la rueda en el ultimo, la pagina deja de scrollear
  it('suelta la rueda en los extremos', () => {
    expect(puedeAvanzar(4, 1, 5)).toBe(false)
    expect(puedeAvanzar(0, -1, 5)).toBe(false)
  })

  it('no retiene nada cuando el fichero esta vacio', () => {
    expect(puedeAvanzar(0, 1, 0)).toBe(false)
  })
})

describe('veloFicha y escalaFicha', () => {
  it('la del frente va limpia y a tamano completo', () => {
    expect(veloFicha(0)).toBe(0)
    expect(escalaFicha(0)).toBe(1)
  })

  it('las de atras se apagan y se hunden, en ambos sentidos', () => {
    expect(veloFicha(2)).toBeCloseTo(veloFicha(-2))
    expect(veloFicha(2)).toBeGreaterThan(veloFicha(1))
    expect(escalaFicha(2)).toBeLessThan(escalaFicha(1))
  })

  it('nunca tapan del todo ni desaparecen', () => {
    expect(veloFicha(30)).toBeLessThan(1)
    expect(escalaFicha(30)).toBeGreaterThan(0.5)
  })
})
