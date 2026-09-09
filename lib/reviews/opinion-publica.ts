import { validarReview } from './validacion'
import type { BorradorReview } from './validacion'
import { EJES_DESEMPENO } from './ejes'
import { MAX_COMENTARIOS } from '@/lib/types'

export type RespuestaCliente = {
  event_supplier_id: string
  precio_valor: number | null
  calidad: number | null
  comunicacion: number | null
  servicio_trato: number | null
  manejo_imprevistos: number | null
  recontratacion: number | null
  cobros_extra: boolean | null
  monto_cobros_extra: number | null
  comentarios: string | null
}

function escala(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return undefined
  return v
}

// El cliente no tiene sesion: todo lo que llega es texto de un desconocido.
// Aqui se convierte a un borrador con la forma exacta de una review post
// evento y se valida con las mismas reglas que las del planner.
export function parseRespuestaCliente(body: unknown): { ok: true; datos: RespuestaCliente } | { ok: false; problemas: string[] } {
  if (!body || typeof body !== 'object') return { ok: false, problemas: ['Respuesta vacía.'] }
  const b = body as Record<string, unknown>

  const id = typeof b.event_supplier_id === 'string' ? b.event_supplier_id.trim() : ''
  if (!id) return { ok: false, problemas: ['Falta el proveedor.'] }

  const ejes: Record<string, number | null> = {}
  for (const eje of EJES_DESEMPENO) {
    const v = escala(b[eje])
    if (v === undefined) return { ok: false, problemas: ['Las calificaciones van del 1 al 5.'] }
    ejes[eje] = v
  }
  const recontratacion = escala(b.recontratacion)
  if (recontratacion === undefined) return { ok: false, problemas: ['La recomendación va del 1 al 5.'] }

  const cobros_extra = typeof b.cobros_extra === 'boolean' ? b.cobros_extra : null
  const montoCrudo = typeof b.monto_cobros_extra === 'number' && b.monto_cobros_extra > 0 ? b.monto_cobros_extra : null
  const comentarios = typeof b.comentarios === 'string' ? b.comentarios.trim().slice(0, MAX_COMENTARIOS) || null : null

  const borrador: BorradorReview = {
    review_type: 'post_evento',
    precio_valor: ejes.precio_valor, calidad: ejes.calidad, comunicacion: ejes.comunicacion,
    servicio_trato: ejes.servicio_trato, manejo_imprevistos: ejes.manejo_imprevistos,
    razones_seleccion: null, motivo_descarte: null,
    recontratacion, cobros_extra, comentarios,
  }
  const problemas = validarReview(borrador)
  if (problemas.length > 0) return { ok: false, problemas }

  return {
    ok: true,
    datos: {
      event_supplier_id: id,
      precio_valor: ejes.precio_valor, calidad: ejes.calidad, comunicacion: ejes.comunicacion,
      servicio_trato: ejes.servicio_trato, manejo_imprevistos: ejes.manejo_imprevistos,
      recontratacion, cobros_extra,
      monto_cobros_extra: cobros_extra ? montoCrudo : null,
      comentarios,
    },
  }
}
