import { isFeedbackType, MAX_IMAGES, type FeedbackType } from '@/lib/feedback'

export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type DraftImage = { blob: Blob; name: string; type: string; compressed: boolean }
export type FeedbackDraft = { type: FeedbackType; message: string; images: DraftImage[] }
export type DraftRecord = FeedbackDraft & { savedAt: number }

export function buildDraftRecord(draft: FeedbackDraft, now: number): DraftRecord {
  return {
    type: draft.type,
    message: draft.message,
    images: draft.images.slice(0, MAX_IMAGES),
    savedAt: now,
  }
}

function parseImages(value: unknown): DraftImage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is DraftImage =>
      typeof entry === 'object' && entry !== null && (entry as DraftImage).blob instanceof Blob
    )
    .slice(0, MAX_IMAGES)
    .map(entry => ({
      blob: entry.blob,
      name: typeof entry.name === 'string' && entry.name ? entry.name : 'captura.png',
      type: typeof entry.type === 'string' && entry.type ? entry.type : entry.blob.type || 'image/png',
      compressed: entry.compressed === true,
    }))
}

// Un tipo corrupto no justifica tirar el reporte: lo que duele perder es el
// contenido. Un borrador de solo imagenes tambien cuenta.
export function parseDraft(record: unknown, now: number): FeedbackDraft | null {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return null

  const { type, message, savedAt } = record as Record<string, unknown>
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
  if (now - savedAt > DRAFT_MAX_AGE_MS) return null

  const text = typeof message === 'string' ? message : ''
  const images = parseImages((record as Record<string, unknown>).images)
  if (!text.trim() && images.length === 0) return null

  return { type: isFeedbackType(type) ? type : 'sugerencia', message: text, images }
}
