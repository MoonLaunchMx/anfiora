import { describe, it, expect } from 'vitest'
import { idsVetados } from './veto'
import type { ReviewParaVeto } from './veto'

function review(parcial: Partial<ReviewParaVeto>): ReviewParaVeto {
  return {
    supplier_id: 's',
    review_type: 'post_evento',
    autor: 'planner',
    recontratacion: null,
    ...parcial,
  }
}

describe('idsVetados', () => {
  it('sin reviews no hay nadie vetado', () => {
    expect(idsVetados([]).size).toBe(0)
  })

  it('un 1 del planner despues del evento veta al proveedor', () => {
    expect([...idsVetados([review({ supplier_id: 'flores', recontratacion: 1 })])]).toEqual(['flores'])
  })

  it('un 2 no veta: eso es un score bajo, no una exclusion', () => {
    expect(idsVetados([review({ recontratacion: 2 })]).size).toBe(0)
  })

  it('el 1 de los novios NO veta, el veto es facultad del planner', () => {
    expect(idsVetados([review({ autor: 'cliente', recontratacion: 1 })]).size).toBe(0)
  })

  it('un 1 en una review de descarte no veta: ahi la pregunta ni existe', () => {
    expect(idsVetados([review({ review_type: 'descarte', recontratacion: 1 })]).size).toBe(0)
  })

  it('sin contestar la pregunta no hay veto', () => {
    expect(idsVetados([review({ recontratacion: null })]).size).toBe(0)
  })

  it('basta una boda con 1 aunque en otra le haya ido bien', () => {
    const vetados = idsVetados([
      review({ supplier_id: 'dj', recontratacion: 5 }),
      review({ supplier_id: 'dj', recontratacion: 1 }),
      review({ supplier_id: 'pastel', recontratacion: 4 }),
    ])
    expect([...vetados]).toEqual(['dj'])
  })
})
