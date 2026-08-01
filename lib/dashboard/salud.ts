import type { Currency } from '@/lib/types'
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

function soloDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function hora12(d: Date): string {
  const h = d.getHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`
}

export function haceCuanto(iso: string, ahora: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dias = Math.round((soloDia(ahora) - soloDia(d)) / 86400000)

  if (dias <= 0) {
    const min = Math.floor((ahora.getTime() - d.getTime()) / 60000)
    if (min < 1) return 'Hace un momento'
    if (min < 60) return `Hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`
    const horas = Math.floor(min / 60)
    return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }
  if (dias === 1) return `Ayer, ${hora12(d)}`
  if (dias < 7) return `Hace ${dias} días`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export type SumaMoneda = { total: number; currency: Currency; otras: number }

// Sumar montos de eventos en monedas distintas seria sumar peras con manzanas:
// se devuelve el total de la moneda dominante y cuantas monedas quedaron fuera.
export function sumaPorMoneda(
  metrics: EventMetrics[],
  pick: (m: EventMetrics) => number,
): SumaMoneda {
  if (metrics.length === 0) return { total: 0, currency: 'MXN', otras: 0 }

  const montos = new Map<Currency, number>()
  const conteo = new Map<Currency, number>()
  for (const m of metrics) {
    const c = m.event.currency
    montos.set(c, (montos.get(c) ?? 0) + pick(m))
    conteo.set(c, (conteo.get(c) ?? 0) + 1)
  }

  const orden = [...montos.entries()]
    .sort((a, b) => (conteo.get(b[0]) ?? 0) - (conteo.get(a[0]) ?? 0) || b[1] - a[1])

  return { total: orden[0][1], currency: orden[0][0], otras: orden.length - 1 }
}

export function computeChipDeuda(m: EventMetrics): ChipDeuda {
  if (m.tareas.vencidas > 0) return { tono: 'alerta', texto: String(m.tareas.vencidas) }
  if (m.tareas.hoy > 0) return { tono: 'aviso', texto: String(m.tareas.hoy) }
  if (m.invitacion === 'borrador') return { tono: 'vacio', texto: 'Borrador' }
  if (m.invitacion === 'cambios') return { tono: 'aviso', texto: 'Sin publicar' }
  return { tono: 'ok', texto: 'OK' }
}
