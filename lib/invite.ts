const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'

export function randomToken(len = 10, rand: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += TOKEN_ALPHABET[Math.floor(rand() * TOKEN_ALPHABET.length)]
  }
  return out
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function slugifyEvent(event: { name: string; host_name?: string | null; host_name_2?: string | null }): string {
  const hosts = event.host_name && event.host_name_2
    ? `${event.host_name} y ${event.host_name_2}`
    : event.host_name
  const base = event.name || hosts || 'evento'
  return stripAccents(base)
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'evento'
}

export function resolveInviteHeading(event: { name: string; host_name?: string | null; host_name_2?: string | null }): string {
  if (event.host_name && event.host_name_2) return `${event.host_name} & ${event.host_name_2}`
  if (event.host_name) return event.host_name
  return event.name
}

const KICKERS: Record<string, string> = {
  boda: 'Nuestra boda',
  cumpleanos: 'Mi cumpleaños',
  bautizo: 'Nuestro bautizo',
  corporativo: 'Te invitamos',
  fiesta: 'Nos vamos de fiesta',
}

export function resolveEventKicker(eventType: string | null | undefined): string {
  if (eventType && KICKERS[eventType]) return KICKERS[eventType]
  return 'Te invitamos'
}

export function isInviteOpen(config: { publicada: boolean; fecha_limite: string | null }, todayISO: string): boolean {
  if (!config.publicada) return false
  if (!config.fecha_limite) return true
  return todayISO <= config.fecha_limite
}

export type RsvpSubmission = {
  guestAttends: boolean
  guestAllergies: string[]
  companions: { id?: string; name: string; attends: boolean; allergies: string[] }[]
}

export type RsvpUpdate = {
  guest: { rsvp_status: 'confirmed' | 'declined'; allergies: string[] }
  companions: { id?: string; name: string; rsvp_status: 'confirmed' | 'declined'; allergies: string[] }[]
}

export function buildRsvpUpdate(sub: RsvpSubmission, opts: { deadlinePassed: boolean }): RsvpUpdate {
  if (opts.deadlinePassed) throw new Error('deadline_passed')
  return {
    guest: {
      rsvp_status: sub.guestAttends ? 'confirmed' : 'declined',
      allergies: sub.guestAllergies,
    },
    companions: sub.companions.map(c => ({
      id: c.id,
      name: c.name,
      rsvp_status: c.attends ? 'confirmed' : 'declined',
      allergies: c.allergies,
    })),
  }
}
