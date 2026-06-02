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

// Cuentas internas (staff/superuser): bypass total de limites y features.
// Por email, sin tocar la DB (mismo patron que ADMIN_EMAIL del panel /admin).
// Agregar mas correos de desarrolladores/staff aqui.
const STAFF_EMAILS = new Set<string>(['superuser@anfiora.com'])

export function isStaff(email: string | null | undefined): boolean {
  return !!email && STAFF_EMAILS.has(email)
}

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
  email?: string | null,
): number {
  if (isStaff(email)) return Infinity
  if (isPlanner(userPlan)) return Infinity
  if (eventTier === 'ilimitado') return Infinity
  const tier = eventTier ?? 'free'
  const plan = ANFITRION_PLANS.find(p => p.id === tier)
  return plan ? plan.guestLimit : FREE_GUEST_LIMIT
}

export function getActiveEventLimit(userPlan: string | null | undefined, email?: string | null): number {
  if (isStaff(email)) return Infinity
  if (!isPlanner(userPlan)) return 1
  const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
  return plan ? plan.activeEvents : 1
}

export function getSeatLimit(userPlan: string | null | undefined, email?: string | null): number {
  if (isStaff(email)) return Infinity
  if (!isPlanner(userPlan)) return 1
  const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
  return plan ? plan.seats : 1
}

export function getFeatures(
  userPlan: string | null | undefined,
  eventTier: string | null | undefined,
  email?: string | null,
): Set<Feature> {
  if (isStaff(email)) return new Set(ALL_FEATURES)
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
  email?: string | null,
): boolean {
  return getFeatures(userPlan, eventTier, email).has(feature)
}
