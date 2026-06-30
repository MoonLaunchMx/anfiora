import type { RSVPIntent } from '@/lib/ai-rsvp'
import type { AttentionReason } from '@/lib/types'

export type RsvpResolution = {
  rsvp: 'confirmed' | 'declined' | null
  needsAttention: boolean
  attentionReason: AttentionReason | null
}

export function inferAttentionReason(text: string): AttentionReason {
  const t = text.toLowerCase()
  if (/alerg|celiac|vegano|vegetarian|intoleran|diabet|sin gluten|no como/.test(t)) return 'alergia'
  if (/queja|molest|pesim|terrible|mal organiz|enojad|inconform/.test(t)) return 'queja'
  if (/llevar|acompa[nñ]|somos \d|mas persona|agregar|sumar|invitad|ni[nñ]|hij|pareja/.test(t)) return 'peticion'
  if (/\?|donde|cuando|c[oó]mo|cu[aá]l|qu[eé] hora|a que hora|direcci[oó]n|estacionamiento/.test(t)) return 'duda'
  return 'otro'
}

export function resolveRsvpAndAttention(intent: RSVPIntent, text: string): RsvpResolution {
  switch (intent) {
    case 'confirmed':
      return { rsvp: 'confirmed', needsAttention: false, attentionReason: null }
    case 'declined':
      return { rsvp: 'declined', needsAttention: false, attentionReason: null }
    case 'accion_necesaria':
      return { rsvp: null, needsAttention: true, attentionReason: inferAttentionReason(text) }
    case 'respondio':
    case 'ambiguous':
    default:
      return { rsvp: null, needsAttention: false, attentionReason: null }
  }
}
