import { AdminUser } from './types'
import { PLAN_PRICES, isPaidPlan } from '@/lib/billing'
import { PLAN_IDS, normalizarPlan, type PlanId } from '@/lib/workspace/planes'

const DAY = 86400000

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
}

export interface ResumenMetrics {
  mrr: number
  arr: number
  payingCustomers: number
  newPayingThisMonth: number
  mrrTrendPct: number | null
  churnDowngrades: number
  conversionPct: number
  newUsers7d: number
  newUsers7dPrev: number
  newEvents7d: number
  active7d: number
  active30d: number
  ghostAccounts: number
  byPlan: Record<PlanId, number>
  lastActivity: AdminUser | null
}

export function computeResumen(users: AdminUser[]): ResumenMetrics {
  const now = Date.now()
  const monthStart     = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime()

  const paying = users.filter(u => isPaidPlan(u.plan))
  const mrr = paying.reduce((s, u) => s + (PLAN_PRICES[u.plan] ?? 0), 0)

  const newPayingThisMonth = paying.filter(u => new Date(u.created_at).getTime() >= monthStart).length
  const newPayingPrevMonth = paying.filter(u => {
    const t = new Date(u.created_at).getTime()
    return t >= prevMonthStart && t < monthStart
  }).length
  const mrrTrendPct = newPayingPrevMonth > 0
    ? Math.round(((newPayingThisMonth - newPayingPrevMonth) / newPayingPrevMonth) * 100)
    : null

  const within = (iso: string | null, days: number) => {
    const d = daysSince(iso)
    return d !== null && d <= days
  }

  const byPlan = Object.fromEntries(PLAN_IDS.map(id => [id, 0])) as Record<PlanId, number>
  for (const u of users) byPlan[normalizarPlan(u.plan)] += 1

  return {
    mrr,
    arr: mrr * 12,
    payingCustomers: paying.length,
    newPayingThisMonth,
    mrrTrendPct,
    churnDowngrades: 0,
    conversionPct: users.length ? Math.round((paying.length / users.length) * 1000) / 10 : 0,
    newUsers7d: users.filter(u => now - new Date(u.created_at).getTime() <= 7 * DAY).length,
    newUsers7dPrev: users.filter(u => {
      const age = now - new Date(u.created_at).getTime()
      return age > 7 * DAY && age <= 14 * DAY
    }).length,
    newEvents7d: users.reduce((s, u) =>
      s + u.events.filter(e => now - new Date(e.created_at).getTime() <= 7 * DAY).length, 0),
    active7d:  users.filter(u => within(u.last_sign_in, 7)).length,
    active30d: users.filter(u => within(u.last_sign_in, 30)).length,
    ghostAccounts: users.filter(u => u.event_count === 0).length,
    byPlan,
    lastActivity: [...users]
      .filter(u => u.last_sign_in)
      .sort((a, b) => new Date(b.last_sign_in!).getTime() - new Date(a.last_sign_in!).getTime())[0] || null,
  }
}

export function powerUsers(users: AdminUser[], limit = 5): AdminUser[] {
  return [...users].sort((a, b) => b.total_count - a.total_count).slice(0, limit)
}

export function atRiskUsers(users: AdminUser[], limit = 5): AdminUser[] {
  return users
    .filter(u => isPaidPlan(u.plan))
    .filter(u => {
      const d = daysSince(u.last_sign_in)
      return d === null || d > 30
    })
    .sort((a, b) => (daysSince(b.last_sign_in) ?? 9999) - (daysSince(a.last_sign_in) ?? 9999))
    .slice(0, limit)
}

export function newSignups(users: AdminUser[], limit = 5): AdminUser[] {
  return [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

export { daysSince }
