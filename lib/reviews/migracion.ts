import type { SupplierMood, ResponseSpeed } from '@/lib/types'

const COMUNICACION_POR_VELOCIDAD: Record<ResponseSpeed, number> = {
  lentisimo: 2,
  normal:    3,
  bueno:     4,
  rapidos:   5,
}

const TRATO_HEREDADO: Record<SupplierMood, string> = {
  no:     'mal trato',
  normal: 'trato normal',
  love:   'trato excelente',
}

export function velocidadAComunicacion(velocidad: ResponseSpeed): number {
  return COMUNICACION_POR_VELOCIDAD[velocidad]
}

export function comentarioHeredado(
  rating: number | null,
  mood: SupplierMood | null,
  texto: string | null,
): string | null {
  const partes: string[] = []
  if (rating !== null) partes.push(`${rating} de 5`)
  if (mood !== null) partes.push(TRATO_HEREDADO[mood])

  const original = texto?.trim() || null
  if (partes.length === 0) return original

  const heredado = `Reseña anterior: ${partes.join(', ')}.`
  return original ? `${original}\n\n${heredado}` : heredado
}
