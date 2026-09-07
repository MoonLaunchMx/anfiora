import { describe, it, expect } from 'vitest'
import {
  carpetasDe, destinosDe, pasosAlcanzados, CAMINO, QUE_SIGNIFICA,
  ORDEN_REVIEWS_FICHA, esReviewLlenable, razonNoLlenableFicha,
  TITULO_REVIEW_FICHA, DESCRIPCION_REVIEW_FICHA, BOTON_REVIEW_FICHA,
} from './ficha-por-estado'
import type { SupplierStatus } from '@/lib/types'

describe('carpetasDe', () => {
  it('las cuatro carpetas siempre estan, en el mismo orden', () => {
    expect(carpetasDe()).toEqual(['Contacto', 'Cotización', 'Pagos', 'Review'])
  })

  it('no depende del estado ni de si la boda ya paso: es una lista fija', () => {
    expect(carpetasDe()).toEqual(carpetasDe())
  })
})

describe('destinosDe', () => {
  it('nunca se ofrece el estado en el que ya estas', () => {
    for (const estado of ['nuevo', 'cotizado', 'contratado', 'descartado'] as const) {
      expect(destinosDe(estado)).not.toContain(estado)
    }
  })

  it('siempre deja a donde ir', () => {
    for (const estado of ['nuevo', 'cotizado', 'contratado', 'descartado'] as const) {
      expect(destinosDe(estado).length).toBe(3)
    }
  })

  it('respeta el orden del camino y deja descartado al final', () => {
    expect(destinosDe('nuevo')).toEqual(['cotizado', 'contratado', 'descartado'])
    expect(destinosDe('contratado')).toEqual(['nuevo', 'cotizado', 'descartado'])
  })

  it('desde descartado se puede volver a cualquier paso del camino', () => {
    expect(destinosDe('descartado')).toEqual(CAMINO)
  })

  it('cada destino sabe explicarse', () => {
    for (const estado of destinosDe('nuevo')) {
      expect(QUE_SIGNIFICA[estado].length).toBeGreaterThan(0)
    }
  })
})

describe('pasosAlcanzados', () => {
  it('marca el paso en el que estas y los anteriores', () => {
    expect(pasosAlcanzados('nuevo')).toEqual(['nuevo'])
    expect(pasosAlcanzados('cotizado')).toEqual(['nuevo', 'cotizado'])
    expect(pasosAlcanzados('contratado')).toEqual(['nuevo', 'cotizado', 'contratado'])
  })

  // Descartar es salirse del camino: no se palomea lo que no se termino.
  it('un descartado no tiene pasos alcanzados', () => {
    expect(pasosAlcanzados('descartado')).toEqual([])
  })
})

describe('esReviewLlenable', () => {
  const ESTADOS: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado', 'descartado']

  it('contratacion solo se llena si esta contratado, pase o no la boda', () => {
    for (const estado of ESTADOS) {
      for (const bodaPaso of [false, true]) {
        expect(esReviewLlenable('contratacion', estado, bodaPaso)).toBe(estado === 'contratado')
      }
    }
  })

  it('descarte solo se llena si esta descartado, pase o no la boda', () => {
    for (const estado of ESTADOS) {
      for (const bodaPaso of [false, true]) {
        expect(esReviewLlenable('descarte', estado, bodaPaso)).toBe(estado === 'descartado')
      }
    }
  })

  it('post_evento necesita contratado Y que la boda ya haya pasado', () => {
    expect(esReviewLlenable('post_evento', 'contratado', true)).toBe(true)
    expect(esReviewLlenable('post_evento', 'contratado', false)).toBe(false)
    expect(esReviewLlenable('post_evento', 'nuevo', true)).toBe(false)
    expect(esReviewLlenable('post_evento', 'cotizado', true)).toBe(false)
    expect(esReviewLlenable('post_evento', 'descartado', true)).toBe(false)
  })

  it('un proveedor nuevo no puede llenar ninguna de las tres', () => {
    for (const tipo of ORDEN_REVIEWS_FICHA) {
      expect(esReviewLlenable(tipo, 'nuevo', false)).toBe(false)
      expect(esReviewLlenable(tipo, 'nuevo', true)).toBe(false)
    }
  })
})

describe('razonNoLlenableFicha', () => {
  it('cada tipo explica por que no se puede llenar todavia', () => {
    expect(razonNoLlenableFicha('contratacion')).toBe('Se llena al contratarlo')
    expect(razonNoLlenableFicha('descarte')).toBe('Se llena al descartarlo')
    expect(razonNoLlenableFicha('post_evento')).toBe('Se llena cuando pase la boda')
  })
})

describe('orden y textos de las tres reviews', () => {
  it('el orden es fijo: contratacion, descarte, post_evento', () => {
    expect(ORDEN_REVIEWS_FICHA).toEqual(['contratacion', 'descarte', 'post_evento'])
  })

  it('cada tipo tiene titulo, descripcion y boton no vacios', () => {
    for (const tipo of ORDEN_REVIEWS_FICHA) {
      expect(TITULO_REVIEW_FICHA[tipo].length).toBeGreaterThan(0)
      expect(DESCRIPCION_REVIEW_FICHA[tipo].length).toBeGreaterThan(0)
      expect(BOTON_REVIEW_FICHA[tipo].length).toBeGreaterThan(0)
    }
  })
})
