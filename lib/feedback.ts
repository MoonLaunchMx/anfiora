export type FeedbackType = 'sugerencia' | 'nota' | 'error'

export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'nota', label: 'Nota' },
  { value: 'error', label: 'Error' },
]

export type FeedbackUser = { name: string; email: string; plan: string }

export type FeedbackClient = { browser: string; os: string; viewport: string }

export type FeedbackPayload = {
  type: FeedbackType
  message: string
  page: string
  user: FeedbackUser
  eventName?: string
  client?: FeedbackClient
  imageCount?: number
}

const TYPE_PREFIX: Record<FeedbackType, string> = {
  sugerencia: 'SUGERENCIA',
  nota: 'NOTA',
  error: 'ERROR',
}

export function isFeedbackType(v: unknown): v is FeedbackType {
  return v === 'sugerencia' || v === 'nota' || v === 'error'
}

export const MAX_IMAGES = 3
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

// La compresion es un extintor, no el default: una captura normal viaja intacta
// para que el texto de la interfaz se siga leyendo.
export const COMPRESS_MAX_EDGE = 1920
export const COMPRESS_SKIP_BYTES = 1.5 * 1024 * 1024
export const COMPRESS_QUALITY = 0.9

export type ImageCandidate = { type: string; size: number }
export type ImageDimensions = { size: number; width: number; height: number }
export type ValidationResult = { ok: true } | { ok: false; error: string }

function mb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

export function validateImages(files: ImageCandidate[]): ValidationResult {
  if (files.length > MAX_IMAGES) {
    return { ok: false, error: `Solo puedes adjuntar ${MAX_IMAGES} imágenes.` }
  }
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return { ok: false, error: 'Ese archivo no es una imagen. Adjunta PNG, JPG o WEBP.' }
    }
    if (file.size <= 0) {
      return { ok: false, error: 'Esa imagen llegó vacía. Intenta adjuntarla de nuevo.' }
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: `Esa imagen pesa más de ${mb(MAX_IMAGE_BYTES)}. Recórtala e intenta de nuevo.` }
    }
  }
  return { ok: true }
}

export function shouldCompress(img: ImageDimensions): boolean {
  return img.size > COMPRESS_SKIP_BYTES || Math.max(img.width, img.height) > COMPRESS_MAX_EDGE
}

const DESCONOCIDO = 'Desconocido'

// El orden importa: Edge y Android se anuncian como Chrome, iOS como Mac.
const BROWSERS: [RegExp, string][] = [
  [/\bEdg[A-Za-z]*\//, 'Edge'],
  [/\b(OPR|Opera)\//, 'Opera'],
  [/\bFirefox\//, 'Firefox'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bChrome\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/\b(iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bWindows\b/, 'Windows'],
  [/\b(Macintosh|Mac OS X)\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
]

function matchFirst(pairs: [RegExp, string][], ua: string): string {
  for (const [re, label] of pairs) {
    if (re.test(ua)) return label
  }
  return DESCONOCIDO
}

export function describeClient(userAgent: string, viewportWidth: number): FeedbackClient {
  const ua = typeof userAgent === 'string' ? userAgent : ''
  const width = Number(viewportWidth)
  return {
    browser: matchFirst(BROWSERS, ua),
    os: matchFirst(SYSTEMS, ua),
    viewport: Number.isFinite(width) && width > 0 ? `${Math.round(width)}px de ancho` : DESCONOCIDO,
  }
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
  if (p.client) lines.push(`Desde: ${p.client.browser} en ${p.client.os}, ${p.client.viewport}`)
  if (p.imageCount && p.imageCount > 0) {
    lines.push(`Adjuntos: ${p.imageCount} ${p.imageCount === 1 ? 'imagen' : 'imagenes'}`)
  }
  return lines.join('\n')
}
