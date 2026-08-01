import { PLAN_PRICES } from '@/lib/billing'

export interface PlanChangeTarget {
  id: string
  email: string
  plan: string
}

export interface PlanChangeCheck {
  ok: boolean
  error: string | null
}

// Los planes vivos se definen en lib/billing.ts. Cuando cambien de nombre o
// entren nuevos, la validacion los sigue sola en vez de quedarse en el pasado.
export const VALID_PLANS = Object.keys(PLAN_PRICES)

function normalize(plan: string): string {
  return (plan || '').trim().toLowerCase()
}

export function checkPlanChange(params: {
  target: PlanChangeTarget | null
  newPlan: string
}): PlanChangeCheck {
  const { target } = params
  const newPlan = normalize(params.newPlan)

  if (!target) return { ok: false, error: 'Usuario no encontrado.' }
  if (!VALID_PLANS.includes(newPlan)) return { ok: false, error: 'Plan no valido.' }
  if (normalize(target.plan || 'free') === newPlan) {
    return { ok: false, error: 'El usuario ya tiene ese plan.' }
  }

  return { ok: true, error: null }
}

// Un UPDATE filtrado por RLS no falla: no encuentra la fila y devuelve cero
// resultados sin error. Por eso el exito se decide por filas afectadas, no por
// la ausencia de error.
export function interpretPlanUpdate(params: {
  error: { message: string } | null
  rows: unknown[] | null
}): PlanChangeCheck {
  const { error, rows } = params

  if (error) return { ok: false, error: 'No se pudo cambiar el plan: ' + error.message }
  if (!rows || rows.length === 0) {
    return { ok: false, error: 'No se actualizo ninguna fila. El cambio no se guardo.' }
  }

  return { ok: true, error: null }
}
