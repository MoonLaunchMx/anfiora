import { formatCurrency } from '@/lib/types'
import type { EventMetrics, Tono } from './types'

export type TipoUrgencia =
  | 'tarea_bloqueante'
  | 'tarea_vencida'
  | 'presupuesto_excedido'
  | 'proveedor_saldo'
  | 'invitados_atencion'
  | 'tarea_hoy'
  | 'sin_lugar'
  | 'invitacion_borrador'

export type AccionUrgencia = {
  label: string
  href: string
}

export type Urgencia = {
  id: string
  tipo: TipoUrgencia
  tono: Tono
  titulo: string
  detalle: string
  eventId: string
  eventName: string
  accion: AccionUrgencia
  secundaria?: AccionUrgencia
}

// Menor es mas urgente. El orden es la unica fuente de verdad del ranking:
// no reordenar sin actualizar los tests.
const PESO: Record<TipoUrgencia, number> = {
  tarea_bloqueante: 0,
  tarea_vencida: 1,
  presupuesto_excedido: 2,
  proveedor_saldo: 3,
  invitados_atencion: 4,
  tarea_hoy: 5,
  sin_lugar: 6,
  invitacion_borrador: 7,
}

const TIPOS_DE_DINERO = new Set<TipoUrgencia>(['presupuesto_excedido', 'proveedor_saldo'])

// En el tablero de un evento, las tareas viven en su propia caja —donde se
// palomean— asi que el feed las suelta para no decir dos veces lo mismo. En la
// cartera no hay esa caja, y ahi si tienen que salir.
const TIPOS_DE_TAREA = new Set<TipoUrgencia>(['tarea_bloqueante', 'tarea_vencida', 'tarea_hoy'])

// Se exporta porque la cartera construye las urgencias evento por evento (cada
// uno con su propio permiso de dinero) y necesita reordenar el concatenado.
export function comparaUrgencias(a: Urgencia, b: Urgencia): number {
  return PESO[a.tipo] - PESO[b.tipo]
}

function urgenciasDeEvento(m: EventMetrics): Urgencia[] {
  const out: Urgencia[] = []
  const ev = m.event
  const base = `/events/${ev.id}`

  if (m.tareas.vencidas > 0 && m.proximaTarea) {
    const bloqueante = m.tareas.bloqueantesVencidas > 0
    out.push({
      id: `${ev.id}:tarea:${m.proximaTarea.id}`,
      tipo: bloqueante ? 'tarea_bloqueante' : 'tarea_vencida',
      tono: 'alerta',
      titulo: m.proximaTarea.title,
      detalle: bloqueante
        ? `Vencida y bloqueante${m.tareas.vencidas > 1 ? ` · ${m.tareas.vencidas} vencidas en total` : ''}`
        : `Vencida${m.tareas.vencidas > 1 ? ` · ${m.tareas.vencidas} vencidas en total` : ''}`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver tarea', href: `${base}/timeline?task=${m.proximaTarea.id}` },
    })
  }

  if (m.dinero.excedido) {
    out.push({
      id: `${ev.id}:excedido`,
      tipo: 'presupuesto_excedido',
      tono: 'alerta',
      titulo: `Presupuesto excedido en ${formatCurrency(m.dinero.contratado - m.dinero.estimado, ev.currency)}`,
      detalle: `Contratado ${formatCurrency(m.dinero.contratado, ev.currency)} contra ${formatCurrency(m.dinero.estimado, ev.currency)} estimado`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver presupuesto', href: `${base}/presupuesto` },
    })
  }

  if (m.proveedorConSaldo) {
    const p = m.proveedorConSaldo
    out.push({
      id: `${ev.id}:saldo`,
      tipo: 'proveedor_saldo',
      tono: 'aviso',
      titulo: `${formatCurrency(p.porPagar, ev.currency)} sin pagar`,
      detalle: `${p.nombre} · ${formatCurrency(p.pagado, ev.currency)} pagado de ${formatCurrency(p.contratado, ev.currency)} contratado`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Registrar pago', href: `${base}/pagos` },
    })
  }

  if (m.invitados.atencion > 0) {
    out.push({
      id: `${ev.id}:atencion`,
      tipo: 'invitados_atencion',
      tono: 'alerta',
      titulo: `${m.invitados.atencion} ${m.invitados.atencion === 1 ? 'invitado requiere' : 'invitados requieren'} atención`,
      detalle: 'Detectado por el agente en las conversaciones',
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver invitados', href: `${base}?filtro=atencion` },
    })
  }

  if (m.tareas.vencidas === 0 && m.tareas.hoy > 0 && m.proximaTarea) {
    out.push({
      id: `${ev.id}:hoy:${m.proximaTarea.id}`,
      tipo: 'tarea_hoy',
      tono: 'aviso',
      titulo: m.proximaTarea.title,
      detalle: m.tareas.hoy > 1 ? `Hoy · ${m.tareas.hoy} tareas para hoy` : 'Hoy',
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Ver tarea', href: `${base}/timeline?task=${m.proximaTarea.id}` },
    })
  }

  if (m.mesas.mesas > 0 && m.mesas.sinLugar > 0) {
    out.push({
      id: `${ev.id}:sinlugar`,
      tipo: 'sin_lugar',
      tono: 'vacio',
      titulo: `${m.mesas.sinLugar} confirmados sin lugar`,
      detalle: `${m.mesas.mesas} mesas creadas · ${m.mesas.sillasLibres} sillas libres`,
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Asignar mesas', href: `${base}/mesas` },
    })
  }

  if (m.invitacion === 'borrador') {
    out.push({
      id: `${ev.id}:borrador`,
      tipo: 'invitacion_borrador',
      tono: 'vacio',
      titulo: 'La invitación está en borrador',
      detalle: 'Sin publicar: tus invitados todavía no pueden verla',
      eventId: ev.id,
      eventName: ev.name,
      accion: { label: 'Publicar', href: `${base}/invitacion` },
    })
  }

  return out
}

export function buildUrgencias(
  metrics: EventMetrics[],
  opts: { puedeVerDinero: boolean; sinTareas?: boolean },
): Urgencia[] {
  return metrics
    .flatMap(urgenciasDeEvento)
    .filter(u => opts.puedeVerDinero || !TIPOS_DE_DINERO.has(u.tipo))
    .filter(u => !opts.sinTareas || !TIPOS_DE_TAREA.has(u.tipo))
    .sort(comparaUrgencias)
}
