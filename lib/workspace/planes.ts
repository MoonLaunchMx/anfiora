import { MODULOS, type Modulo } from '@/lib/permisos/catalogo'

export const PLAN_IDS = ['free', 'pro', 'agency'] as const
export type PlanId = typeof PLAN_IDS[number]

export interface Plan {
  id: PlanId
  nombre: string
  precio: number
  asientosIncluidos: number
  // 0 = sin Actividad; null = sin limite
  ventanaActividadDias: number | null
  // null = ilimitadas
  bodasActivas: number | null
  importExport: boolean
  whitelabel: boolean
  herramientas: readonly Modulo[]
}

const HERRAMIENTAS_FREE: readonly Modulo[] = [
  'invitados', 'mesas', 'timeline', 'presupuesto', 'proveedores', 'pagos',
  'album', 'playlist', 'vestimenta',
]

export const PLANES: Record<PlanId, Plan> = {
  free: {
    id: 'free', nombre: 'Free', precio: 0, asientosIncluidos: 1,
    ventanaActividadDias: 0, bodasActivas: 1, importExport: false, whitelabel: false,
    herramientas: HERRAMIENTAS_FREE,
  },
  pro: {
    id: 'pro', nombre: 'Pro', precio: 990, asientosIncluidos: 1,
    ventanaActividadDias: 30, bodasActivas: null, importExport: true, whitelabel: false,
    herramientas: MODULOS,
  },
  agency: {
    id: 'agency', nombre: 'Agency', precio: 1990, asientosIncluidos: 3,
    ventanaActividadDias: null, bodasActivas: null, importExport: true, whitelabel: true,
    herramientas: MODULOS,
  },
}

export const PRECIO_ASIENTO_EXTRA = 290

// 'studio' es el catalogo de junio (3 asientos, 25 eventos): hoy equivale a Pro.
// 'solo' y cualquier otro valor caen a Free.
const ALIAS: Record<string, PlanId> = { studio: 'pro' }

export function normalizarPlan(raw: unknown): PlanId {
  if (typeof raw !== 'string') return 'free'
  const v = raw.trim().toLowerCase()
  if ((PLAN_IDS as readonly string[]).includes(v)) return v as PlanId
  return ALIAS[v] ?? 'free'
}

export function planDe(id: PlanId): Plan {
  return PLANES[id]
}

export function incluyeHerramienta(plan: PlanId, modulo: Modulo): boolean {
  return PLANES[plan].herramientas.includes(modulo)
}

export function etiquetaPlan(id: PlanId): string {
  return PLANES[id].nombre
}
