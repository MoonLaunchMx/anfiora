export type FeedbackType = 'sugerencia' | 'nota' | 'error'

export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'nota', label: 'Nota' },
  { value: 'error', label: 'Error' },
]

export type FeedbackUser = { name: string; email: string; plan: string }

export type FeedbackPayload = {
  type: FeedbackType
  message: string
  page: string
  user: FeedbackUser
  eventName?: string
}

const TYPE_PREFIX: Record<FeedbackType, string> = {
  sugerencia: 'SUGERENCIA',
  nota: 'NOTA',
  error: 'ERROR',
}

export function isFeedbackType(v: unknown): v is FeedbackType {
  return v === 'sugerencia' || v === 'nota' || v === 'error'
}

export function formatFeedbackMessage(p: FeedbackPayload): string {
  const lines = [
    `[${TYPE_PREFIX[p.type]}] Anfiora feedback`,
    '',
    p.message.trim(),
    '',
    `De: ${p.user.name || 'Sin nombre'} (${p.user.email})`,
    `Plan: ${p.user.plan}`,
    `Pagina: ${p.page}`,
  ]
  if (p.eventName) lines.push(`Evento: ${p.eventName}`)
  return lines.join('\n')
}
