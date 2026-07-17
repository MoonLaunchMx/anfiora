import type { DressCode } from '@/lib/dresscode'
import type { RegistryPaymentMethod, Currency } from '@/lib/types'

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
  // registrarse ES confirmar: al terminar no rebota a ningun lado, el mismo
  // slot pasa a "ya estas dentro". Es el molde que despues dira "falta que te
  // aprueben" o "falta tu pago" segun los candados.
  puerta?: {
    token: string
    maxCompanions: number
    agotado: boolean
    registrado: boolean
    onRegistrado: (partySize: number) => void
    // Monto que acaba de congelarse tras el registro por liga (evento con
    // precio). Vive en sesion, nunca lo devuelve el endpoint al anonimo.
    montoRegistrado: number | null
  }
  deadlinePassed?: boolean
  botonClassName?: string
  forceMobile?: boolean
  // Cobro (fase 4): presentes en todo modo cuando el evento tiene precio.
  // amountDue/paidAt son el estado DURABLE del link personal (null en
  // compartida, donde el estado recien nacido vive en puerta.montoRegistrado).
  ticketPrice?: number | null
  currency?: Currency
  paymentMethods?: RegistryPaymentMethod[]
  waHref?: string
  amountDue?: number | null
  paidAt?: string | null
}
