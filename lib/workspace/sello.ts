import { PLANES, normalizarPlan } from './planes'

export type Sello = 'fundador' | null

export const LUGARES_FUNDADOR = 25

export function normalizarSello(raw: unknown): Sello {
  if (typeof raw !== 'string') return null
  return raw.trim().toLowerCase() === 'fundador' ? 'fundador' : null
}

export function hayLugarDeFundador(ocupados: number): boolean {
  return ocupados < LUGARES_FUNDADOR
}

export function limiteEventos(plan: string | null | undefined, sello: unknown): number | null {
  if (normalizarSello(sello)) return null
  // Mismo numero que en supabase/migrations/
  return PLANES[normalizarPlan(plan)].eventosActivos
}

export function limiteInvitados(plan: string | null | undefined, sello: unknown): number | null {
  if (normalizarSello(sello)) return null
  // Mismo numero que en supabase/migrations/
  return PLANES[normalizarPlan(plan)].invitadosPorEvento
}
