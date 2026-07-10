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
  guest: InviteGuest
  companions: InviteCompanion[]
  dressCode: DressCode | null
  itinerary: { start_time: string; title: string; location: string | null }[]
  tokens: { playlist: string | null; registry: string | null }
  mode: 'preview' | 'public'
  onSubmit?: (payload: import('@/lib/invite').RsvpSubmission) => Promise<void>
  deadlinePassed?: boolean
  botonClassName?: string
}
