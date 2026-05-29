// Capa de abstraccion de cobros. HOY: deriva del plan + created_at.
// MANANA (Stripe): reescribir SOLO el cuerpo de getBillingRows leyendo de Stripe.
// La UI consume BillingRow / BillingSummary y no se entera del origen.

export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 1990,
  agency: 3990,
}

export type BillingStatus = 'active' | 'past_due' | 'canceled'

export interface BillingUserInput {
  id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
}

export interface BillingRow {
  userId: string
  email: string
  fullName: string | null
  plan: string
  amountMonthly: number
  status: BillingStatus
  registeredAt: string
  startedAt: string | null
  currentPeriodEnd: string | null
  mrrContributed: number
}

export interface BillingSummary {
  mrr: number
  arr: number
  payingCustomers: number
  avgTicket: number
  byPlan: { pro: number; agency: number; free: number }
}

export function isPaidPlan(plan: string): boolean {
  return (PLAN_PRICES[plan] ?? 0) > 0
}

export function getBillingRows(users: BillingUserInput[]): BillingRow[] {
  return users
    .filter(u => isPaidPlan(u.plan))
    .map(u => {
      const amountMonthly = PLAN_PRICES[u.plan] ?? 0
      return {
        userId:           u.id,
        email:            u.email,
        fullName:         u.full_name,
        plan:             u.plan,
        amountMonthly,
        status:           'active' as BillingStatus,
        registeredAt:     u.created_at,
        startedAt:        null,
        currentPeriodEnd: null,
        mrrContributed:   amountMonthly,
      }
    })
}

export function getBillingSummary(rows: BillingRow[]): BillingSummary {
  const mrr = rows.reduce((sum, r) => sum + r.mrrContributed, 0)
  const payingCustomers = rows.length
  return {
    mrr,
    arr: mrr * 12,
    payingCustomers,
    avgTicket: payingCustomers ? Math.round(mrr / payingCustomers) : 0,
    byPlan: {
      pro:    rows.filter(r => r.plan === 'pro').length,
      agency: rows.filter(r => r.plan === 'agency').length,
      free:   0,
    },
  }
}
