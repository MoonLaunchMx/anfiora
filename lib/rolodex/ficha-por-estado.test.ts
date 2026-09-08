import { describe, it, expect } from 'vitest'
import {
  carpetasDe, destinosDe, pasosAlcanzados, CAMINO, QUE_SIGNIFICA,
  ORDEN_REVIEWS_FICHA, esReviewLlenable, filasDeReview, pendientesDe, resumenPendientes,
  TITULO_REVIEW_FICHA, DESCRIPCION_REVIEW_FICHA, BOTON_CALIFICAR,
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

  it('contratacion solo se llena si esta contratado', () => {
    for (const estado of ESTADOS) {
      expect(esReviewLlenable('contratacion', estado)).toBe(estado === 'contratado')
    }
  })

  it('descarte solo se llena si esta descartado', () => {
    for (const estado of ESTADOS) {
      expect(esReviewLlenable('descarte', estado)).toBe(estado === 'descartado')
    }
  })

  it('desempeno se llena desde que esta contratado, sin esperar la fecha del evento', () => {
    expect(esReviewLlenable('post_evento', 'contratado')).toBe(true)
    expect(esReviewLlenable('post_evento', 'nuevo')).toBe(false)
    expect(esReviewLlenable('post_evento', 'cotizado')).toBe(false)
    expect(esReviewLlenable('post_evento', 'descartado')).toBe(false)
  })

  it('un proveedor nuevo no puede llenar ninguna de las tres', () => {
    for (const tipo of ORDEN_REVIEWS_FICHA) {
      expect(esReviewLlenable(tipo, 'nuevo')).toBe(false)
    }
  })
})

describe('filasDeReview: la lista "Que falta"', () => {
  it('contratado sin reviews: contratacion y desempeno pendientes', () => {
    expect(filasDeReview('contratado', [])).toEqual([
      { tipo: 'contratacion', hecha: false },
      { tipo: 'post_evento', hecha: false },
    ])
  })

  it('descartado sin reviews: solo el descarte', () => {
    expect(filasDeReview('descartado', [])).toEqual([{ tipo: 'descarte', hecha: false }])
  })

  it('nuevo o cotizado sin reviews: lista vacia', () => {
    expect(filasDeReview('nuevo', [])).toEqual([])
    expect(filasDeReview('cotizado', [])).toEqual([])
  })

  it('una review hecha se muestra aunque el estado ya no la permita', () => {
    expect(filasDeReview('descartado', ['contratacion'])).toEqual([
      { tipo: 'contratacion', hecha: true },
      { tipo: 'descarte', hecha: false },
    ])
  })

  it('respeta el orden fijo aunque las existentes vengan revueltas', () => {
    const filas = filasDeReview('contratado', ['post_evento', 'contratacion'])
    expect(filas.map(f => f.tipo)).toEqual(['contratacion', 'post_evento'])
    expect(filas.every(f => f.hecha)).toBe(true)
  })
})

describe('resumenPendientes', () => {
  it('cuenta en singular y plural', () => {
    expect(resumenPendientes(filasDeReview('contratado', []))).toBe('2 pendientes')
    expect(resumenPendientes(filasDeReview('descartado', []))).toBe('1 pendiente')
  })

  it('todo hecho es "Al dia"', () => {
    expect(resumenPendientes(filasDeReview('contratado', ['contratacion', 'post_evento']))).toBe('Al día')
  })

  it('sin filas dice que no hay nada que calificar', () => {
    expect(resumenPendientes(filasDeReview('nuevo', []))).toBe('Nada que calificar todavía')
  })

  it('pendientesDe cuenta solo las no hechas', () => {
    expect(pendientesDe(filasDeReview('contratado', ['contratacion']))).toBe(1)
  })
})

describe('orden y textos de las tres reviews', () => {
  it('el orden es fijo: contratacion, descarte, post_evento', () => {
    expect(ORDEN_REVIEWS_FICHA).toEqual(['contratacion', 'descarte', 'post_evento'])
  })

  it('cada tipo tiene titulo y descripcion no vacios, y el boton es uno solo', () => {
    for (const tipo of ORDEN_REVIEWS_FICHA) {
      expect(TITULO_REVIEW_FICHA[tipo].length).toBeGreaterThan(0)
      expect(DESCRIPCION_REVIEW_FICHA[tipo].length).toBeGreaterThan(0)
    }
    expect(BOTON_CALIFICAR).toBe('Calificar ahora')
  })
})
