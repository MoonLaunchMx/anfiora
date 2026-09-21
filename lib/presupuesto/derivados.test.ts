import { describe, it, expect } from 'vitest'
import { repartirEntrePartidas, metaDelProveedor, partidasDelProveedor, contratadoDelProveedor } from './derivados'
import type { EventBudget } from '@/lib/types'

const partida = (
  id: string,
  budget_amount: number,
  event_supplier_id: string | null,
  contract_amount: number | null = null,
): EventBudget => ({
  id, event_id: 'e1', category_id: null, subcategory: id, budget_amount, event_supplier_id, contract_amount, notes: null, created_at: '',
})

describe('repartirEntrePartidas', () => {
  it('el contratado de cada partida es el que se escribio en ella, tal cual', () => {
    const { contractedByItem } = repartirEntrePartidas(
      [partida('salon', 120000, 'hotel', 118000), partida('mobiliario', 30000, 'hotel', 32000), partida('flores', 30000, 'flor', 28000)],
      {},
    )
    expect(contractedByItem).toEqual({ salon: 118000, mobiliario: 32000, flores: 28000 })
  })

  it('issue #68: dos partidas del mismo proveedor ya no duplican ni inventan nada', () => {
    const { contractedByItem } = repartirEntrePartidas(
      [partida('salon', 120000, 'hotel', 120000), partida('jardin', 0, 'hotel', 0)],
      {},
    )
    expect(contractedByItem).toEqual({ salon: 120000, jardin: 0 })
  })

  it('una partida ligada sin contrato capturado cuenta cero', () => {
    const { contractedByItem } = repartirEntrePartidas([partida('salon', 120000, 'hotel', null)], {})
    expect(contractedByItem).toEqual({ salon: 0 })
  })

  it('el pago del proveedor se muestra por partida en proporcion a lo contratado', () => {
    const { paidByItem } = repartirEntrePartidas(
      [partida('salon', 0, 'hotel', 120000), partida('mobiliario', 0, 'hotel', 30000)],
      { hotel: 50000 },
    )
    expect(paidByItem.salon).toBeCloseTo(40000)
    expect(paidByItem.mobiliario).toBeCloseTo(10000)
  })

  it('si ninguna partida trae contrato, el pago se reparte en partes iguales', () => {
    const { paidByItem } = repartirEntrePartidas(
      [partida('a', 100, 'hotel', null), partida('b', 100, 'hotel', null)],
      { hotel: 100 },
    )
    expect(paidByItem).toEqual({ a: 50, b: 50 })
  })

  it('partidas sin proveedor quedan en cero y no truenan', () => {
    const { contractedByItem, paidByItem } = repartirEntrePartidas([partida('suelta', 5000, null, 4000)], {})
    expect(contractedByItem).toEqual({ suelta: 0 })
    expect(paidByItem).toEqual({ suelta: 0 })
  })
})

describe('partidasDelProveedor: una sola liga, la de la partida', () => {
  const budgets = [
    partida('habitaciones', 50000, 'hotel', 48000),
    partida('salon', 150000, 'hotel', 150000),
    partida('flores', 30000, null),
  ]

  it('devuelve todas las que apuntan al proveedor', () => {
    expect(partidasDelProveedor({ id: 'hotel' }, budgets).map(b => b.id)).toEqual(['habitaciones', 'salon'])
  })

  it('sin partidas que lo apunten, lista vacia', () => {
    expect(partidasDelProveedor({ id: 'dj' }, budgets)).toEqual([])
  })
})

describe('metaDelProveedor', () => {
  it('suma lo estimado de sus partidas', () => {
    expect(metaDelProveedor({ id: 'hotel' }, [partida('a', 50000, 'hotel'), partida('b', 150000, 'hotel')])).toBe(200000)
  })
  it('sin partidas, no hay meta', () => {
    expect(metaDelProveedor({ id: 'dj' }, [partida('a', 50000, 'hotel')])).toBeNull()
  })
})

describe('contratadoDelProveedor', () => {
  it('es la suma de lo contratado en sus partidas', () => {
    expect(contratadoDelProveedor({ id: 'hotel' }, [partida('a', 0, 'hotel', 118000), partida('b', 0, 'hotel', 32000)])).toBe(150000)
  })
  it('ignora las partidas ligadas sin contrato todavia', () => {
    expect(contratadoDelProveedor({ id: 'hotel' }, [partida('a', 0, 'hotel', 118000), partida('b', 0, 'hotel', null)])).toBe(118000)
  })
  it('null cuando no hay partidas o ninguna trae contrato: la ficha lo pide', () => {
    expect(contratadoDelProveedor({ id: 'hotel' }, [])).toBeNull()
    expect(contratadoDelProveedor({ id: 'hotel' }, [partida('a', 0, 'hotel', null)])).toBeNull()
  })
})
