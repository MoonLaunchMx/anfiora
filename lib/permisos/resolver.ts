import type { FeatureKey } from '@/lib/features'
import {
  MODULOS, MODULOS_CONFIG, NIVELES,
  type Modulo, type Nivel, type Accion, type PermisosEvento,
} from './catalogo'

export type RolCuenta = 'dueno' | 'admin' | 'colaborador' | null

export interface ContextoPermiso {
  esDuenoDelEvento: boolean
  rolCuenta: RolCuenta
  permisos: PermisosEvento | null
  // null mientras cargan: se trata como "nada prendido", nunca como "todo prendido"
  features: Record<FeatureKey, boolean> | null
}

const ES_MODULO = new Set<string>(MODULOS)
const ES_NIVEL = new Set<string>(NIVELES)

const FEATURE_DE: Record<Modulo, FeatureKey | null> = Object.fromEntries(
  MODULOS_CONFIG.map(m => [m.key, m.feature]),
) as Record<Modulo, FeatureKey | null>

// Lo que viene del JSONB es dato ajeno: se limpia antes de creerle.
export function normalizarPermisos(raw: unknown): PermisosEvento {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: PermisosEvento = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (ES_MODULO.has(k) && typeof v === 'string' && ES_NIVEL.has(v)) {
      out[k as Modulo] = v as Nivel
    }
  }
  return out
}

export function nivelDe(permisos: PermisosEvento | null | undefined, modulo: Modulo): Nivel {
  return permisos?.[modulo] ?? 'ninguno'
}

export function puede(nivel: Nivel, accion: Accion): boolean {
  if (accion === 'ver')    return nivel !== 'ninguno'
  if (accion === 'editar') return nivel === 'editar' || nivel === 'total'
  return nivel === 'total'
}

function estaPrendida(modulo: Modulo, features: Record<FeatureKey, boolean> | null): boolean {
  const feature = FEATURE_DE[modulo]
  if (feature === null) return true
  return features?.[feature] === true
}

export function nivelEfectivo(ctx: ContextoPermiso, modulo: Modulo): Nivel {
  if (!estaPrendida(modulo, ctx.features)) return 'ninguno'
  if (ctx.esDuenoDelEvento) return 'total'
  if (ctx.rolCuenta === 'dueno' || ctx.rolCuenta === 'admin') return 'total'
  return nivelDe(ctx.permisos, modulo)
}

export function resumir(ctx: ContextoPermiso) {
  let ve = 0, edita = 0, borra = 0
  for (const m of MODULOS) {
    const nivel = nivelEfectivo(ctx, m)
    if (nivel === 'ver')    ve++
    if (nivel === 'editar') edita++
    if (nivel === 'total')  borra++
  }
  const entra = ve + edita + borra
  const etiqueta =
    entra === 0 ? 'Fuera de esta boda' :
    borra > 0   ? 'Puede borrar' :
    edita > 0   ? 'Edita, no borra' :
                  'Solo lectura'
  return { entra, ve, edita, borra, etiqueta }
}

export function aplicarKit(
  kit: PermisosEvento | null,
  features: Record<FeatureKey, boolean> | null,
): PermisosEvento {
  if (!kit) return {}
  const out: PermisosEvento = {}
  for (const m of MODULOS) {
    const nivel = kit[m]
    if (nivel && nivel !== 'ninguno' && estaPrendida(m, features)) out[m] = nivel
  }
  return out
}
