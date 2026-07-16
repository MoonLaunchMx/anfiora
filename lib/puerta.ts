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
