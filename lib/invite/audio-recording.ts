// Candidatos de mimeType para MediaRecorder, en orden de preferencia.
// Chrome/Firefox suelen dar webm/opus; Safari iOS da audio/mp4.
export const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

// Elige el primer mimeType soportado. `isSupported` se inyecta (MediaRecorder.isTypeSupported)
// para que la funcion sea pura y testeable. Devuelve '' si ninguno matchea (usa el default del navegador).
export function pickAudioMime(isSupported: (mime: string) => boolean): string {
  for (const mime of AUDIO_MIME_CANDIDATES) {
    if (isSupported(mime)) return mime
  }
  return ''
}

export function extForMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase()
  switch (base) {
    case 'audio/webm': return 'webm'
    case 'audio/mp4': return 'm4a'
    case 'audio/ogg': return 'ogg'
    case 'audio/mpeg': return 'mp3'
    case 'audio/wav':
    case 'audio/x-wav': return 'wav'
    default: return 'webm'
  }
}

export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
