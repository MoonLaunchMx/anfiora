import { AUDIT_ACTION_LABEL, esBorrado, type AuditAction } from './vocabulario'
import { MODULOS, type Modulo } from '@/lib/permisos/catalogo'
import type { FilaAudit, Movimiento } from './tipos'

// Cuanto silencio parte una tanda de ediciones en dos. Diez minutos separa
// "estuvo capturando confirmaciones" de "volvio despues de comer".
export const VENTANA_MS = 10 * 60 * 1000

const ES_MODULO = new Set<string>(MODULOS)

const ts = (f: FilaAudit) => new Date(f.created_at).getTime()

function moduloValido(m: string | null): Modulo | null {
  return m && ES_MODULO.has(m) ? (m as Modulo) : null
}

function armar(filas: FilaAudit[], restaurados: Set<string>): Movimiento {
  // Descendente: el disparador AFTER DELETE de una cascada corre hijos
  // primero, asi que leer al reves deja al padre arriba, que es el orden en
  // que hay que volver a insertarlos.
  const orden = [...filas].sort((a, b) => ts(b) - ts(a))
  const cabeza = orden[0]
  const borrado = esBorrado(cabeza.action)

  return {
    clave: cabeza.batch_id ?? cabeza.id,
    accion: cabeza.action,
    etiquetaAccion: AUDIT_ACTION_LABEL[cabeza.action as AuditAction] ?? cabeza.action,
    modulo: moduloValido(cabeza.modulo),
    persona: cabeza.user_name ?? cabeza.user_email,
    personaId: cabeza.user_id,
    cuando: cabeza.created_at,
    esBorrado: borrado,
    batchId: cabeza.batch_id,
    filas: orden,
    total: orden.length,
    restaurado: borrado && orden.every(f => f.entity_id !== null && restaurados.has(f.entity_id)),
  }
}

export function agrupar(filas: FilaAudit[], restaurados: Set<string>): Movimiento[] {
  if (filas.length === 0) return []

  const porLote = new Map<string, FilaAudit[]>()
  const sueltas: FilaAudit[] = []

  // Los borrados vienen del disparador y siempre traen batch_id: una
  // transaccion es un lote. Las ediciones vienen de logAction() y no traen
  // nada, asi que se agrupan por parecido.
  for (const f of filas) {
    if (f.batch_id && esBorrado(f.action)) {
      const previas = porLote.get(f.batch_id)
      if (previas) previas.push(f)
      else porLote.set(f.batch_id, [f])
    } else {
      sueltas.push(f)
    }
  }

  const grupos: FilaAudit[][] = [...porLote.values()]

  const ordenadas = [...sueltas].sort((a, b) => ts(b) - ts(a))
  let actual: FilaAudit[] = []

  const mismaTanda = (a: FilaAudit, b: FilaAudit) =>
    a.user_id === b.user_id &&
    a.action === b.action &&
    a.modulo === b.modulo &&
    Math.abs(ts(a) - ts(b)) <= VENTANA_MS

  for (const f of ordenadas) {
    // Se compara contra la ultima de la tanda, no contra la primera: asi una
    // captura larga se mantiene junta mientras no haya un hueco real.
    if (actual.length > 0 && mismaTanda(actual[actual.length - 1], f)) {
      actual.push(f)
    } else {
      if (actual.length > 0) grupos.push(actual)
      actual = [f]
    }
  }
  if (actual.length > 0) grupos.push(actual)

  return grupos
    .map(g => armar(g, restaurados))
    .sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime())
}
