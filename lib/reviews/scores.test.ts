import { describe, it, expect } from 'vitest'
import { calcularScores } from './scores'
import type { SupplierReview } from '@/lib/types'

function review(parcial: Partial<SupplierReview>): SupplierReview {
  return {
    id: crypto.randomUUID(),
    user_id: 'u', supplier_id: 's', event_id: 'e', event_supplier_id: 'es',
    review_type: 'post_evento', autor: 'planner',
    precio_valor: null, calidad: null, comunicacion: null,
    servicio_trato: null, manejo_imprevistos: null,
    razones_seleccion: null, motivo_descarte: null,
    recontratacion: null, cobros_extra: null, monto_cobros_extra: null,
    comentarios: null, created_by: null,
    created_at: '2026-09-06', updated_at: '2026-09-06',
    ...parcial,
  }
}

describe('calcularScores', () => {
  it('sin reviews los tres scores son null', () => {
    expect(calcularScores([])).toEqual({ propuesta: null, desempeno: null, clientes: null })
  })

  it('un descarte NUNCA mueve el score de desempeno', () => {
    const scores = calcularScores([
      review({ review_type: 'descarte', precio_valor: 1, calidad: 1, comunicacion: 1 }),
      review({
        review_type: 'post_evento', autor: 'planner',
        precio_valor: 5, calidad: 5, comunicacion: 5,
        servicio_trato: 5, manejo_imprevistos: 5,
      }),
    ])
    expect(scores.desempeno).toBe(5)
    expect(scores.propuesta).toBe(1)
  })

  it('el cliente y el planner nunca se promedian entre si', () => {
    const scores = calcularScores([
      review({
        autor: 'planner',
        precio_valor: 3, calidad: 3, comunicacion: 3, servicio_trato: 3, manejo_imprevistos: 3,
      }),
      review({
        autor: 'cliente',
        precio_valor: 5, calidad: 5, comunicacion: 5, servicio_trato: 5, manejo_imprevistos: 5,
      }),
    ])
    expect(scores.desempeno).toBe(3)
    expect(scores.clientes).toBe(5)
  })

  it('contratacion y descarte caen al mismo score de propuesta', () => {
    const scores = calcularScores([
      review({ review_type: 'contratacion', precio_valor: 5, calidad: 5, comunicacion: 5 }),
      review({ review_type: 'descarte', precio_valor: 1, calidad: 1, comunicacion: 1 }),
    ])
    expect(scores.propuesta).toBe(3)
  })

  it('un eje en null sale del promedio en vez de contar como cero', () => {
    const scores = calcularScores([
      review({
        precio_valor: 4, calidad: 4, comunicacion: 4, servicio_trato: 4,
        manejo_imprevistos: null,
      }),
    ])
    expect(scores.desempeno).toBe(4)
  })

  it('un descarte sin calificar no cuenta para propuesta', () => {
    const scores = calcularScores([
      review({ review_type: 'descarte', motivo_descarte: 'disponibilidad' }),
    ])
    expect(scores.propuesta).toBeNull()
  })

  it('redondea a un decimal', () => {
    const scores = calcularScores([
      review({ review_type: 'contratacion', precio_valor: 4, calidad: 5, comunicacion: 5 }),
    ])
    expect(scores.propuesta).toBe(4.7)
  })
})
