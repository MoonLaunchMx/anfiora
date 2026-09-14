import { PLANES, PRECIO_ASIENTO_EXTRA, type PlanId } from './planes'

// El asiento se ocupa al invitar: una invitacion pendiente ya cuenta.
export function contarAsientos(miembros: { status: string }[]): number {
  return miembros.filter(m => m.status === 'pending' || m.status === 'active').length
}

export function asientosExtra(plan: PlanId, ocupados: number): number {
  return Math.max(0, ocupados - PLANES[plan].asientosIncluidos)
}

export function costoAsientosExtra(plan: PlanId, ocupados: number): number {
  return asientosExtra(plan, ocupados) * PRECIO_ASIENTO_EXTRA
}

export interface PermisoDeInvitar {
  ok: boolean
  motivo: 'plan' | null
  costoNuevoAsiento: number
}

export function puedeInvitar(plan: PlanId, ocupados: number): PermisoDeInvitar {
  if (plan === 'free') return { ok: false, motivo: 'plan', costoNuevoAsiento: 0 }
  const cuesta = ocupados + 1 > PLANES[plan].asientosIncluidos
  return { ok: true, motivo: null, costoNuevoAsiento: cuesta ? PRECIO_ASIENTO_EXTRA : 0 }
}

export function resumenAsientos(plan: PlanId, miembros: { status: string }[]) {
  const ocupados = contarAsientos(miembros)
  return {
    ocupados,
    incluidos: PLANES[plan].asientosIncluidos,
    extra: asientosExtra(plan, ocupados),
    costoExtraMensual: costoAsientosExtra(plan, ocupados),
  }
}
