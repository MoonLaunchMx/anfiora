import { ORGANIZADOR_PLANS, type OrganizadorTier } from './pricing'

export type UserPlan = 'free' | OrganizadorTier

export const PLAN_IDS: UserPlan[] = ['free', ...ORGANIZADOR_PLANS.map(p => p.id)]

const STAFF_EMAILS = new Set<string>(['superuser@anfiora.com'])

export function isStaff(email: string | null | undefined): boolean {
  return !!email && STAFF_EMAILS.has(email)
}

// 'pro' es un plan viejo que daba eventos ilimitados. Se traduce a studio para no
// capar a quien ya lo tiene.
export function normalizePlan(raw: string | null | undefined): UserPlan {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'pro') return 'studio'
  return ORGANIZADOR_PLANS.some(p => p.id === value) ? (value as OrganizadorTier) : 'free'
}

export function isPlanner(raw: string | null | undefined): boolean {
  return normalizePlan(raw) !== 'free'
}

// Cuantos eventos vigentes puede llevar la cuenta al mismo tiempo.
// ESPEJO: el mismo numero vive en get_account_capacity() dentro de
// supabase/2026-08-19-muro-eventos.sql. Si cambias uno, cambia el otro.
export function getActiveEventLimit(
  plan: string | null | undefined,
  email?: string | null,
): number {
  if (isStaff(email)) return Infinity
  const normalized = normalizePlan(plan)
  if (normalized === 'free') return 1
  const found = ORGANIZADOR_PLANS.find(p => p.id === normalized)
  return found ? found.activeEvents : 1
}
