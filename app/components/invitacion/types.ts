import type { DressCode } from '@/lib/dresscode'

export type InviteGuest = {
  name: string
  party_size: number
  rsvp_status: string
  allergies: string[]
}
export type InviteCompanion = { id?: string; name: string; rsvp_status: string; allergies: string[] }

export type InviteCtx = {
  event: {
    name: string; event_type: string | null; event_date: string | null; event_time: string | null
    venue: string | null; address: string | null; host_name: string | null; host_name_2: string | null
  }
  // null en modo compartida: la puerta publica se pinta sin invitado, porque
  // todavia no existe. Lo llena el registro.
  guest: InviteGuest | null
  companions: InviteCompanion[]
  dressCode: DressCode | null
  itinerary: { start_time: string; title: string; location: string | null }[]
  tokens: { playlist: string | null; registry: string | null }
  mode: 'preview' | 'public' | 'compartida'
  onSubmit?: (payload: import('@/lib/invite').RsvpSubmission) => Promise<void>
  // La puerta publica ocupa el slot del bloque RSVP: el anfitrion ya decidio
  // ahi donde va la confirmacion, y el registro respeta esa decision.
  puerta?: {
    token: string
    maxCompanions: number
    agotado: boolean
    onDone: (rsvpToken: string) => void
  }
  deadlinePassed?: boolean
  botonClassName?: string
  forceMobile?: boolean
}
