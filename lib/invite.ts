export type InviteConfig = {
  publicada: boolean
  mensaje_bienvenida: string
  fecha_limite: string | null
  mostrar_playlist: boolean
  mostrar_mesa: boolean
}

export function defaultInviteConfig(): InviteConfig {
  return {
    publicada: false,
    mensaje_bienvenida: 'Nos encantaría que nos acompañes en este día tan especial.',
    fecha_limite: null,
    mostrar_playlist: true,
    mostrar_mesa: true,
  }
}

export function mergeInviteConfig(raw: unknown): InviteConfig {
  const d = defaultInviteConfig()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  return {
    publicada: typeof r.publicada === 'boolean' ? r.publicada : d.publicada,
    mensaje_bienvenida: typeof r.mensaje_bienvenida === 'string' ? r.mensaje_bienvenida : d.mensaje_bienvenida,
    fecha_limite: typeof r.fecha_limite === 'string' && r.fecha_limite ? r.fecha_limite : d.fecha_limite,
    mostrar_playlist: typeof r.mostrar_playlist === 'boolean' ? r.mostrar_playlist : d.mostrar_playlist,
    mostrar_mesa: typeof r.mostrar_mesa === 'boolean' ? r.mostrar_mesa : d.mostrar_mesa,
  }
}

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
  const base = event.host_name && event.host_name_2
    ? `${event.host_name} y ${event.host_name_2}`
    : event.host_name || event.name || 'evento'
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

export function isInviteOpen(config: InviteConfig, todayISO: string): boolean {
  if (!config.publicada) return false
  if (!config.fecha_limite) return true
  return todayISO <= config.fecha_limite
}

export type RsvpSubmission = {
  guestAttends: boolean
  guestAllergies: string[]
  guestNotes: string | null
  companions: { id?: string; name: string; attends: boolean; allergies: string[] }[]
}

export type RsvpUpdate = {
  guest: { rsvp_status: 'confirmed' | 'declined'; allergies: string[]; notes: string | null }
  companions: { id?: string; name: string; rsvp_status: 'confirmed' | 'declined'; allergies: string[] }[]
}

export function buildRsvpUpdate(sub: RsvpSubmission, opts: { deadlinePassed: boolean }): RsvpUpdate {
  if (opts.deadlinePassed) throw new Error('deadline_passed')
  return {
    guest: {
      rsvp_status: sub.guestAttends ? 'confirmed' : 'declined',
      allergies: sub.guestAllergies,
      notes: sub.guestNotes,
    },
    companions: sub.companions.map(c => ({
      id: c.id,
      name: c.name,
      rsvp_status: c.attends ? 'confirmed' : 'declined',
      allergies: c.allergies,
    })),
  }
}
