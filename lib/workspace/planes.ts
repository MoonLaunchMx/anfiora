import { MODULOS, type Modulo } from '@/lib/permisos/catalogo'

export const PLAN_IDS = ['free', 'pro', 'studio', 'agency'] as const
export type PlanId = typeof PLAN_IDS[number]

export interface Plan {
  id: PlanId
  nombre: string
  precio: number
  asientosIncluidos: number
  // null = sin limite
  eventosActivos: number | null
  invitadosPorEvento: number | null
  // 0 = sin Actividad; null = sin limite
  ventanaActividadDias: number | null
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
    eventosActivos: 1, invitadosPorEvento: 50,
    ventanaActividadDias: 0, importExport: false, whitelabel: false,
    herramientas: HERRAMIENTAS_FREE,
  },
  pro: {
    id: 'pro', nombre: 'Pro', precio: 490, asientosIncluidos: 1,
    eventosActivos: null, invitadosPorEvento: null,
    ventanaActividadDias: 30, importExport: true, whitelabel: false,
    herramientas: MODULOS,
  },
  studio: {
    id: 'studio', nombre: 'Studio', precio: 990, asientosIncluidos: 3,
    eventosActivos: null, invitadosPorEvento: null,
    ventanaActividadDias: 30, importExport: true, whitelabel: false,
    herramientas: MODULOS,
  },
  agency: {
    id: 'agency', nombre: 'Agency', precio: 1990, asientosIncluidos: 5,
    eventosActivos: null, invitadosPorEvento: null,
    ventanaActividadDias: null, importExport: true, whitelabel: true,
    herramientas: MODULOS,
  },
}

export const PRECIO_ASIENTO_EXTRA = 290

export const PAID_PLAN_IDS: readonly PlanId[] = PLAN_IDS.filter(id => PLANES[id].precio > 0)

// studio ya es un plan real y solo nunca existio en la base: ambos caen
// a la regla general (studio se reconoce, cualquier otro valor cae a free).
const ALIAS: Record<string, PlanId> = {}

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
