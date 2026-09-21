import { describe, it, expect } from 'vitest'
import {
  aplicarFiltrosProveedores, coincideFiltros, contarFiltrosActivos, filtrosVacios,
  EntradaFiltrable, FiltrosProveedores,
} from './filtros'

function entrada(over: Partial<EntradaFiltrable> = {}): EntradaFiltrable {
  return { categoriaId: 'cat-venue', estatus: 'nuevo', ciudad: 'Monterrey', desempeno: null, ...over }
}

describe('filtrosVacios / contarFiltrosActivos', () => {
  it('arranca sin nada seleccionado', () => {
    expect(contarFiltrosActivos(filtrosVacios())).toBe(0)
  })

  it('cuenta las opciones prendidas en los cuatro grupos', () => {
    const f = filtrosVacios()
    f.categoria.add('cat-venue')
    f.estatus.add('nuevo').add('cotizado')
    f.ciudad.add('CDMX')
    f.desempeno.add('5')
    expect(contarFiltrosActivos(f)).toBe(5)
  })
})

describe('coincideFiltros — seleccion vacia', () => {
  it('sin nada seleccionado, todo pasa', () => {
    expect(coincideFiltros(entrada(), filtrosVacios())).toBe(true)
    expect(coincideFiltros(entrada({ categoriaId: null, ciudad: null }), filtrosVacios())).toBe(true)
  })
})

describe('coincideFiltros — un grupo a la vez', () => {
  it('categoria: solo pasan las categorias marcadas', () => {
    const f = filtrosVacios()
    f.categoria.add('cat-venue')
    expect(coincideFiltros(entrada({ categoriaId: 'cat-venue' }), f)).toBe(true)
    expect(coincideFiltros(entrada({ categoriaId: 'cat-banquete' }), f)).toBe(false)
    expect(coincideFiltros(entrada({ categoriaId: null }), f)).toBe(false)
  })

  it('estatus: OR entre los estatus marcados', () => {
    const f = filtrosVacios()
    f.estatus.add('nuevo').add('cotizado')
    expect(coincideFiltros(entrada({ estatus: 'nuevo' }), f)).toBe(true)
    expect(coincideFiltros(entrada({ estatus: 'cotizado' }), f)).toBe(true)
    expect(coincideFiltros(entrada({ estatus: 'contratado' }), f)).toBe(false)
  })

  it('ciudad: solo pasan las ciudades marcadas', () => {
    const f = filtrosVacios()
    f.ciudad.add('CDMX')
    expect(coincideFiltros(entrada({ ciudad: 'CDMX' }), f)).toBe(true)
    expect(coincideFiltros(entrada({ ciudad: 'Monterrey' }), f)).toBe(false)
    expect(coincideFiltros(entrada({ ciudad: null }), f)).toBe(false)
  })

  it('desempeno: 5 estrellas es exactamente 5', () => {
    const f = filtrosVacios()
    f.desempeno.add('5')
    expect(coincideFiltros(entrada({ desempeno: 5 }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: 4.5 }), f)).toBe(false)
  })

  it('desempeno: 4 o mas incluye 4 pero no 5 ni 3.9', () => {
    const f = filtrosVacios()
    f.desempeno.add('4mas')
    expect(coincideFiltros(entrada({ desempeno: 4 }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: 4.7 }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: 5 }), f)).toBe(false)
    expect(coincideFiltros(entrada({ desempeno: 3.9 }), f)).toBe(false)
  })

  it('desempeno: 3 o menos incluye 3 y menores', () => {
    const f = filtrosVacios()
    f.desempeno.add('3menos')
    expect(coincideFiltros(entrada({ desempeno: 3 }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: 1 }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: 3.1 }), f)).toBe(false)
  })

  it('desempeno: sin calificar es solo null', () => {
    const f = filtrosVacios()
    f.desempeno.add('sin_calificar')
    expect(coincideFiltros(entrada({ desempeno: null }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: 1 }), f)).toBe(false)
  })

  it('desempeno: varias opciones combinan con OR', () => {
    const f = filtrosVacios()
    f.desempeno.add('5').add('sin_calificar')
    expect(coincideFiltros(entrada({ desempeno: 5 }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: null }), f)).toBe(true)
    expect(coincideFiltros(entrada({ desempeno: 4 }), f)).toBe(false)
  })
})

describe('coincideFiltros — grupos combinados con AND', () => {
  it('debe cumplir categoria Y estatus Y ciudad a la vez', () => {
    const f = filtrosVacios()
    f.categoria.add('cat-venue')
    f.estatus.add('contratado')
    f.ciudad.add('CDMX')

    expect(coincideFiltros(entrada({ categoriaId: 'cat-venue', estatus: 'contratado', ciudad: 'CDMX' }), f)).toBe(true)
    // Cumple categoria y ciudad pero no estatus.
    expect(coincideFiltros(entrada({ categoriaId: 'cat-venue', estatus: 'nuevo', ciudad: 'CDMX' }), f)).toBe(false)
    // Cumple categoria y estatus pero no ciudad.
    expect(coincideFiltros(entrada({ categoriaId: 'cat-venue', estatus: 'contratado', ciudad: 'Monterrey' }), f)).toBe(false)
  })
})

describe('aplicarFiltrosProveedores', () => {
  type Item = { id: string; entrada: EntradaFiltrable }
  const item = (id: string, over: Partial<EntradaFiltrable> = {}): Item => ({ id, entrada: entrada(over) })

  it('sin filtros regresa todo, en el mismo orden', () => {
    const items = [item('a'), item('b'), item('c')]
    const resultado = aplicarFiltrosProveedores(items, filtrosVacios(), i => i.entrada)
    expect(resultado.map(i => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('filtra por la funcion extractora, no por la forma del item', () => {
    const items = [
      item('a', { ciudad: 'CDMX' }),
      item('b', { ciudad: 'Monterrey' }),
      item('c', { ciudad: 'CDMX' }),
    ]
    const f: FiltrosProveedores = filtrosVacios()
    f.ciudad.add('CDMX')
    const resultado = aplicarFiltrosProveedores(items, f, i => i.entrada)
    expect(resultado.map(i => i.id)).toEqual(['a', 'c'])
  })
})
