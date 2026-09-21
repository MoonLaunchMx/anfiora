import { describe, it, expect } from 'vitest'
import { getBillingRows, getBillingSummary, isPaidPlan, type BillingRow } from './billing'

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

  it('un plan invalido en una fila cae a free dentro del conteo, no se pierde', () => {
    // getBillingRows nunca produce esto (filtra por isPaidPlan antes), pero
    // getBillingSummary es publica y debe defenderse sola si alguien le pasa
    // una fila con un plan invalido (ej. dato viejo, migracion a medias).
    const rows: BillingRow[] = [{
      userId: '1', email: 'a@a.com', fullName: null, plan: 'enterprise',
      amountMonthly: 0, status: 'active', registeredAt: '2026-01-01',
      startedAt: null, currentPeriodEnd: null, mrrContributed: 0,
    }]
    const resumen = getBillingSummary(rows)
    expect(resumen.byPlan.free).toBe(1)
    expect(resumen.byPlan.pro).toBe(0)
    expect(resumen.byPlan.studio).toBe(0)
    expect(resumen.byPlan.agency).toBe(0)
  })
})
