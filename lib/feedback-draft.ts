import { isFeedbackType, type FeedbackType } from '@/lib/feedback'

export const FEEDBACK_DRAFT_KEY = 'anfiora_feedback_draft'
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type FeedbackDraft = { type: FeedbackType; message: string }

export function serializeDraft(draft: FeedbackDraft, now: number): string {
  return JSON.stringify({ type: draft.type, message: draft.message, savedAt: now })
}

// Un tipo corrupto no justifica tirar el mensaje: lo que duele perder es el texto.
export function parseDraft(raw: string | null, now: number): FeedbackDraft | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null

  const { type, message, savedAt } = data as Record<string, unknown>
  if (typeof message !== 'string' || !message.trim()) return null
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
  if (now - savedAt > DRAFT_MAX_AGE_MS) return null

  return { type: isFeedbackType(type) ? type : 'sugerencia', message }
}
