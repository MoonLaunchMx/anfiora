import { describe, it, expect } from 'vitest'
import { repartirEntrePartidas, metaDelProveedor, partidasDelProveedor } from './derivados'
import type { EventBudget } from '@/lib/types'

const partida = (id: string, budget_amount: number, event_supplier_id: string | null): EventBudget => ({
  id, event_id: 'e1', category_id: null, subcategory: id, budget_amount, event_supplier_id, notes: null, created_at: '',
})

describe('repartirEntrePartidas', () => {
  it('una partida por proveedor se lleva el contrato completo, como antes', () => {
    const { contractedByItem, paidByItem } = repartirEntrePartidas(
      [partida('salon', 120000, 'hotel'), partida('flores', 30000, 'flor')],
      { hotel: 120000, flor: 28000 },
      { hotel: 60000, flor: 0 },
    )
    expect(contractedByItem).toEqual({ salon: 120000, flores: 28000 })
    expect(paidByItem).toEqual({ salon: 60000, flores: 0 })
  })

  it('issue #68: dos partidas del mismo proveedor NO duplican el contrato', () => {
    const { contractedByItem } = repartirEntrePartidas(
      [partida('salon', 120000, 'hotel'), partida('jardin', 0, 'hotel')],
      { hotel: 120000 },
      {},
    )
    const total = Object.values(contractedByItem).reduce((a, b) => a + b, 0)
    expect(total).toBe(120000)
  })

  it('reparte en proporcion a lo presupuestado en cada partida', () => {
    const { contractedByItem, paidByItem } = repartirEntrePartidas(
      [partida('habitaciones', 50000, 'hotel'), partida('banquete', 100000, 'hotel'), partida('salon', 150000, 'hotel')],
      { hotel: 270000 },
      { hotel: 27000 },
    )
    expect(contractedByItem.habitaciones).toBeCloseTo(45000)
    expect(contractedByItem.banquete).toBeCloseTo(90000)
    expect(contractedByItem.salon).toBeCloseTo(135000)
    expect(paidByItem.habitaciones).toBeCloseTo(4500)
    expect(paidByItem.salon).toBeCloseTo(13500)
  })

  it('si ninguna partida trae presupuesto, reparte en partes iguales', () => {
    const { contractedByItem } = repartirEntrePartidas(
      [partida('a', 0, 'hotel'), partida('b', 0, 'hotel')],
      { hotel: 100 },
      {},
    )
    expect(contractedByItem).toEqual({ a: 50, b: 50 })
  })

  it('una partida con presupuesto y otra en cero: la de cero no recibe nada', () => {
    const { contractedByItem } = repartirEntrePartidas(
      [partida('salon', 120000, 'hotel'), partida('jardin', 0, 'hotel')],
      { hotel: 120000 },
      {},
    )
    expect(contractedByItem).toEqual({ salon: 120000, jardin: 0 })
  })

  it('partidas sin proveedor quedan en cero y no truenan', () => {
    const { contractedByItem, paidByItem } = repartirEntrePartidas(
      [partida('suelta', 5000, null)],
      {},
      {},
    )
    expect(contractedByItem).toEqual({ suelta: 0 })
    expect(paidByItem).toEqual({ suelta: 0 })
  })

  it('un proveedor ligado sin contrato registrado reparte cero', () => {
    const { contractedByItem } = repartirEntrePartidas(
      [partida('salon', 120000, 'hotel')],
      {},
      {},
    )
    expect(contractedByItem).toEqual({ salon: 0 })
  })
})

describe('partidasDelProveedor', () => {
  const budgets = [
    partida('habitaciones', 50000, 'hotel'),
    partida('salon', 150000, 'hotel'),
    partida('flores', 30000, null),
  ]

  it('devuelve todas las que apuntan al proveedor', () => {
    expect(partidasDelProveedor({ id: 'hotel', event_budget_id: 'salon' }, budgets).map(b => b.id)).toEqual(['habitaciones', 'salon'])
  })

  it('si ninguna apunta a el, la que el apunta', () => {
    expect(partidasDelProveedor({ id: 'flor', event_budget_id: 'flores' }, budgets).map(b => b.id)).toEqual(['flores'])
  })

  it('sin liga, lista vacia', () => {
    expect(partidasDelProveedor({ id: 'dj', event_budget_id: null }, budgets)).toEqual([])
  })
})

describe('metaDelProveedor', () => {
  const budgets = [
    partida('habitaciones', 50000, 'hotel'),
    partida('salon', 150000, 'hotel'),
    partida('flores', 30000, null),
  ]

  it('suma todas las partidas que apuntan al proveedor', () => {
    expect(metaDelProveedor({ id: 'hotel', event_budget_id: 'salon' }, budgets)).toBe(200000)
  })

  it('si ninguna partida apunta a el, usa la que el proveedor apunta', () => {
    expect(metaDelProveedor({ id: 'flor', event_budget_id: 'flores' }, budgets)).toBe(30000)
  })

  it('sin liga de ningun lado, no hay meta', () => {
    expect(metaDelProveedor({ id: 'dj', event_budget_id: null }, budgets)).toBeNull()
  })
})
