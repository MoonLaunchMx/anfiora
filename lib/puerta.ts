import { toE164 } from '@/lib/phone'

export type Registration = {
  name: string
  phone: string
  companions: number
  partySize: number
}

// El aforo se cuenta por cabeza, no por fila: un invitado con 2 acompanantes
// ocupa 3 lugares. party_size es el espejo de 1 + party_members.
export function occupiedSeats(guests: { party_size: number | null }[]): number {
  return guests.reduce((sum, g) => {
    const n = Number(g.party_size)
    return sum + (Number.isFinite(n) && n > 0 ? n : 1)
  }, 0)
}

// null = el evento no declaro cupo, o sea sin limite.
export function seatsLeft(guestCap: number | null, occupied: number): number | null {
  if (guestCap === null || guestCap === undefined) return null
  return Math.max(0, guestCap - occupied)
}

export function canFit(guestCap: number | null, occupied: number, partySize: number): boolean {
  const left = seatsLeft(guestCap, occupied)
  if (left === null) return true
  return partySize <= left
}

// El telefono es la llave del dedupe: sin el no hay registro, y se guarda
// siempre en E.164 para que dos formatos del mismo numero no creen dos filas.
export function parseRegistration(body: unknown, maxCompanions: number): Registration | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name) return null

  const rawPhone = typeof b.phone === 'string' ? b.phone.trim() : ''
  if (!rawPhone) return null
  const phone = toE164(rawPhone)
  if (!phone) return null

  const raw = Number(b.companions)
  const asked = Number.isFinite(raw) ? Math.floor(raw) : 0
  const companions = Math.min(Math.max(0, asked), Math.max(0, maxCompanions))

  return { name, phone, companions, partySize: 1 + companions }
}

// El precio se congela al registrarse: ticket_price x party_size (cabezas).
// Si manana sube el boleto, la deuda de quien ya se registro no cambia hacia atras.
export function montoAPagar(ticketPrice: number | null | undefined, partySize: number): number {
  if (!ticketPrice || ticketPrice <= 0) return 0
  return ticketPrice * partySize
}

// El estado se DERIVA, no hay columna access_status. "dentro" = no debe nada o
// ya pago; "pendiente_pago" = debe y no ha pagado.
export function estadoAcceso(guest: { amount_due?: number | null; paid_at?: string | null }): 'dentro' | 'pendiente_pago' {
  const debe = Number(guest.amount_due) > 0
  if (!debe) return 'dentro'
  return guest.paid_at ? 'dentro' : 'pendiente_pago'
}

// El cupo cuenta cabezas de los que estan dentro. En evento gratis cuenta a
// todos (como fase 2); con precio, solo a los dentro (los pendientes no ocupan).
export function ocupaLugar(guest: { amount_due?: number | null; paid_at?: string | null }, tienePrecio: boolean): boolean {
  if (!tienePrecio) return true
  return estadoAcceso(guest) === 'dentro'
}

// Limite para pagar: 24h desde el registro, nunca despues de que empiece el evento.
// null-safe: sin fecha de evento no hay tope (solo las 24h).
export function plazoPago(desde: Date, eventDate: string | null, eventTime: string | null): Date | null {
  const limite24 = new Date(desde.getTime() + 24 * 60 * 60 * 1000)
  if (!eventDate) return limite24
  const inicio = new Date(`${eventDate}T${eventTime || '23:59'}`)
  if (isNaN(inicio.getTime())) return limite24
  return inicio.getTime() < limite24.getTime() ? inicio : limite24
}
