import type { EventMetrics, Tono } from './types'

export type SaludBarras = {
  invitados: Tono
  dinero: Tono
  logistica: Tono
  tareas: Tono
}

export type ChipDeuda = { tono: Tono; texto: string }

// Orden fijo de las barras en la UI: invitados, dinero, logistica, tareas.
// No reordenar: la lectura de un vistazo depende de que la posicion sea estable.
export const ORDEN_BARRAS = ['invitados', 'dinero', 'logistica', 'tareas'] as const

function saludInvitados(m: EventMetrics): Tono {
  if (m.invitados.total === 0) return 'vacio'
  if (m.invitados.pctConfirmado >= 70) return 'ok'
  if (m.invitados.pctConfirmado >= 40) return 'aviso'
  return 'alerta'
}

function saludDinero(m: EventMetrics): Tono {
  if (m.dinero.estimado === 0 && m.dinero.contratado === 0) return 'vacio'
  if (m.dinero.excedido) return 'alerta'
  if (m.dinero.pctContratado > 90) return 'aviso'
  return 'ok'
}

function saludLogistica(m: EventMetrics): Tono {
  if (m.mesas.mesas === 0) return 'vacio'
  const cabezas = m.mesas.conLugar + m.mesas.sinLugar
  if (cabezas === 0) return 'vacio'
  const pctSinLugar = (m.mesas.sinLugar / cabezas) * 100
  if (pctSinLugar >= 25) return 'alerta'
  if (pctSinLugar > 0) return 'aviso'
  return 'ok'
}

function saludTareas(m: EventMetrics): Tono {
  const { vencidas, hoy, proximas } = m.tareas
  if (vencidas === 0 && hoy === 0 && proximas === 0) return 'vacio'
  if (vencidas > 0) return 'alerta'
  if (hoy > 0) return 'aviso'
  return 'ok'
}

export function computeSalud(m: EventMetrics): SaludBarras {
  return {
    invitados: saludInvitados(m),
    dinero: saludDinero(m),
    logistica: saludLogistica(m),
    tareas: saludTareas(m),
  }
}

export function computeChipDeuda(m: EventMetrics): ChipDeuda {
  if (m.tareas.vencidas > 0) return { tono: 'alerta', texto: String(m.tareas.vencidas) }
  if (m.tareas.hoy > 0) return { tono: 'aviso', texto: String(m.tareas.hoy) }
  if (m.invitacion === 'borrador') return { tono: 'vacio', texto: 'Borrador' }
  if (m.invitacion === 'cambios') return { tono: 'aviso', texto: 'Sin publicar' }
  return { tono: 'ok', texto: 'OK' }
}
