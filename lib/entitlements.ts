import {
  ANFITRION_PLANS,
  ORGANIZADOR_PLANS,
  type AnfitrionTier,
  type OrganizadorTier,
  type Feature,
} from './pricing'

export type PlannerTier = OrganizadorTier
export type UserPlan = 'free' | PlannerTier
// El tier por evento puede ser un plan de anfitrion o 'ilimitado' (Sin Limites).
export type EventTier = AnfitrionTier | 'ilimitado'

const FREE_GUEST_LIMIT = 50
const ALL_FEATURES: Feature[] = ['export', 'whatsapp_agent']

// users.plan puede traer valores legacy ('pro'/'agency') de cuentas viejas.
// Los normalizamos a un valor actual sin romper su experiencia previa.
export function normalizePlan(raw: string | null | undefined): UserPlan {
  switch (raw) {
    case 'solo':
    case 'studio':
    case 'agency':
      return raw
    case 'pro': // legacy: era ilimitado -> lo tratamos como planner para no capar
      return 'studio'
    default:
      return 'free'
  }
}

export function isPlanner(raw: string | null | undefined): boolean {
  const p = normalizePlan(raw)
  return p === 'solo' || p === 'studio' || p === 'agency'
}

export function getGuestLimit(
  userPlan: string | null | undefined,
  eventTier: string | null | undefined,
): number {
  if (isPlanner(userPlan)) return Infinity
  if (eventTier === 'ilimitado') return Infinity
  const tier = eventTier ?? 'free'
  const plan = ANFITRION_PLANS.find(p => p.id === tier)
  return plan ? plan.guestLimit : FREE_GUEST_LIMIT
}

export function getActiveEventLimit(userPlan: string | null | undefined): number {
  if (!isPlanner(userPlan)) return 1
  const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
  return plan ? plan.activeEvents : 1
}

export function getSeatLimit(userPlan: string | null | undefined): number {
  if (!isPlanner(userPlan)) return 1
  const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
  return plan ? plan.seats : 1
}

export function getFeatures(
  userPlan: string | null | undefined,
  eventTier: string | null | undefined,
): Set<Feature> {
  if (isPlanner(userPlan)) {
    const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
    return new Set(plan ? plan.features : [])
  }
  if (eventTier === 'ilimitado') return new Set(ALL_FEATURES)
  const plan = ANFITRION_PLANS.find(p => p.id === (eventTier ?? 'free'))
  return new Set(plan ? plan.features : [])
}

export function can(
  userPlan: string | null | undefined,
  eventTier: string | null | undefined,
  feature: Feature,
): boolean {
  return getFeatures(userPlan, eventTier).has(feature)
}
