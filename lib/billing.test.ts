import { describe, it, expect } from 'vitest'
import { getBillingRows, getBillingSummary, isPaidPlan } from './billing'

describe('isPaidPlan', () => {
  it('free no cobra', () => {
    expect(isPaidPlan('free')).toBe(false)
  })

  it('los tres planes pagados cobran', () => {
    expect(isPaidPlan('pro')).toBe(true)
    expect(isPaidPlan('studio')).toBe(true)
    expect(isPaidPlan('agency')).toBe(true)
  })
})

describe('getBillingRows + getBillingSummary', () => {
  it('cuenta los cuatro planes y cobra el precio nuevo', () => {
    const rows = getBillingRows([
      { id: '1', email: 'a@a.com', full_name: null, plan: 'pro',    created_at: '2026-01-01' },
      { id: '2', email: 'b@a.com', full_name: null, plan: 'studio', created_at: '2026-01-01' },
      { id: '3', email: 'c@a.com', full_name: null, plan: 'agency', created_at: '2026-01-01' },
      { id: '4', email: 'd@a.com', full_name: null, plan: 'free',   created_at: '2026-01-01' },
    ])
    const resumen = getBillingSummary(rows)
    expect(resumen.mrr).toBe(490 + 990 + 1990)
    expect(resumen.byPlan.studio).toBe(1)
    expect(resumen.byPlan.pro).toBe(1)
    expect(resumen.byPlan.agency).toBe(1)
    expect(resumen.byPlan.free).toBe(0)
  })

  it('free no genera fila de cobro', () => {
    const rows = getBillingRows([
      { id: '1', email: 'a@a.com', full_name: null, plan: 'free', created_at: '2026-01-01' },
    ])
    expect(rows).toHaveLength(0)
  })

  it('un plan desconocido cae a free y no aparece en byPlan de un plan pagado', () => {
    const rows = getBillingRows([
      { id: '1', email: 'a@a.com', full_name: null, plan: 'enterprise', created_at: '2026-01-01' },
    ])
    const resumen = getBillingSummary(rows)
    expect(resumen.payingCustomers).toBe(0)
    expect(resumen.byPlan.free).toBe(0)
    expect(resumen.byPlan.pro).toBe(0)
  })
})
