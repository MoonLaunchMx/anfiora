import type { ReviewType } from '@/lib/types'

// La review post-evento se cierra sola 15 dias despues del evento: pasado ese
// plazo solo el dueno de la cuenta o un admin del despacho pueden corregirla.
// Contratacion y descarte se capturan meses antes de la boda -- "15 dias
// despues del evento" no significa nada ahi, asi que se quedan siempre abiertas.
const DIAS_ABIERTO = 15

export type CandadoReview = {
  bloqueado: boolean
  razon: string | null
}

export const RAZON_CANDADO = 'Se cerró 15 días después del evento. Solo el dueño o un administrador puede editarla.'

export function evaluarCandado({
  reviewExiste,
  tipoReview,
  fechaEvento,
  puedeSaltarlo,
  ahora = new Date(),
}: {
  // El candado nunca frena crear una review nueva -- solo modificar una que
  // ya existe. Si nadie califico al proveedor, el planner debe poder hacerlo
  // el dia que se acuerde, aunque hayan pasado meses.
  reviewExiste: boolean
  tipoReview: ReviewType
  // 'YYYY-MM-DD', ya resuelto (event_end_date si hay rango, si no event_date).
  fechaEvento: string | null
  puedeSaltarlo: boolean
  ahora?: Date
}): CandadoReview {
  if (!reviewExiste) return { bloqueado: false, razon: null }
  if (tipoReview !== 'post_evento') return { bloqueado: false, razon: null }
  if (puedeSaltarlo) return { bloqueado: false, razon: null }
  if (!fechaEvento) return { bloqueado: false, razon: null }

  const cierre = new Date(`${fechaEvento}T00:00:00`)
  cierre.setDate(cierre.getDate() + DIAS_ABIERTO)
  cierre.setHours(23, 59, 59, 999)

  if (ahora.getTime() <= cierre.getTime()) return { bloqueado: false, razon: null }

  return { bloqueado: true, razon: RAZON_CANDADO }
}
