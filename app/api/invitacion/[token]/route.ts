import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isInviteOpen, buildRsvpUpdate, type RsvpSubmission } from '@/lib/invite'
import { resolveDoc } from '@/lib/invite/doc'
import { parseDressCode } from '@/lib/dresscode'
import { curateForGuests } from '@/lib/itinerary'
import { logAction } from '@/lib/audit'
import { resolveAccessMode, resolveMaxCompanions } from '@/lib/features'
import { occupiedSeats, seatsLeft, ocupaLugar } from '@/lib/puerta'
import { resolverContacto } from '@/lib/invite/post-confirmacion'
import type { Currency, RegistryPaymentMethod } from '@/lib/types'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Lectura best-effort: si la columna/tabla aun no existe (otro agente/SQL pendiente), regresa null/[] sin romper.
async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try { const { data, error } = await p; return error ? null : data } catch { return null }
}

async function safeList<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try { const { data, error } = await p; return error ? [] : (data || []) } catch { return [] }
}

type GuestRow = {
  id: string; event_id: string; name: string; party_size: number; rsvp_status: string; allergies: string[] | null
  amount_due: number | null; paid_at: string | null; created_at: string | null
}

type SettingsRow = {
  invite_config: unknown
  playlist_token: string | null
  registry_token: string | null
  access_mode: string | null
  max_companions: number | null
}

type Resolved = {
  kind: 'guest' | 'compartida'
  guest: GuestRow | null
  eventId: string
  settings: SettingsRow | null
  doc: ReturnType<typeof resolveDoc>
}

async function fetchSettings(db: ReturnType<typeof admin>, eventId: string) {
  return safeSingle<SettingsRow>(
    db.from('event_settings')
      .select('invite_config, playlist_token, registry_token, access_mode, max_companions')
      .eq('event_id', eventId)
      .maybeSingle(),
  )
}

// El token puede ser de un invitado (link personal) o del evento (puerta
// publica). Se prueba primero el personal: son los 971 links ya repartidos.
async function resolveToken(db: ReturnType<typeof admin>, token: string): Promise<Resolved | null> {
  const { data: guest } = await db
    .from('guests')
    .select('id, event_id, name, party_size, rsvp_status, allergies, amount_due, paid_at, created_at')
    .eq('rsvp_token', token)
    .maybeSingle<GuestRow>()

  if (guest) {
    const settings = await fetchSettings(db, guest.event_id)
    return {
      kind: 'guest',
      guest,
      eventId: guest.event_id,
      settings,
      doc: resolveDoc(settings?.invite_config, () => crypto.randomUUID()),
    }
  }

  const shared = await safeSingle<{ event_id: string }>(
    db.from('event_settings').select('event_id').eq('shared_token', token).maybeSingle(),
  )
  if (!shared) return null

  const settings = await fetchSettings(db, shared.event_id)
  return {
    kind: 'compartida',
    guest: null,
    eventId: shared.event_id,
    settings,
    doc: resolveDoc(settings?.invite_config, () => crypto.randomUUID()),
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const found = await resolveToken(db, token)
  if (!found || !found.doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { guest, settings, doc, eventId } = found

  const [event, members, settingsExtra, itin] = await Promise.all([
    safeSingle<{
      name: string; event_type: string | null; event_date: string | null; event_time: string | null
      venue: string | null; address: string | null; host_name: string | null; host_name_2: string | null
      guest_cap: number | null; ticket_price: number | null; currency: Currency | null; user_id: string
      planner_name: string | null; planner_phone: string | null; planner_email: string | null
    }>(
      db.from('events')
        .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2, guest_cap, ticket_price, currency, user_id, planner_name, planner_phone, planner_email')
        .eq('id', eventId).maybeSingle(),
    ),
    guest
      ? safeList<{ id: string; name: string; rsvp_status: string; allergies: string[] | null }>(
          db.from('party_members').select('id, name, rsvp_status, allergies').eq('guest_id', guest.id).order('created_at', { ascending: true }),
        )
      : Promise.resolve([]),
    safeSingle<{ dress_code: unknown }>(
      db.from('event_settings').select('dress_code').eq('event_id', eventId).maybeSingle(),
    ),
    safeList<{ start_time: string; title: string; location: string | null; visible_to_guests: boolean; position: number }>(
      db.from('event_itinerary_moments').select('start_time, title, location, visible_to_guests, position').eq('event_id', eventId).eq('visible_to_guests', true),
    ),
  ])
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // El contacto que ve el invitado sale de "Datos del planner" (events.planner_*).
  // El celular de la cuenta (users.phone) quedo como respaldo y SOLO en eventos
  // con precio, para no romper el boton "Ya pague" de quien no ha configurado el
  // numero de atencion. Se resuelve aqui, en el limite: asi un evento gratis sin
  // numero configurado nunca manda el celular personal del planner al navegador.
  const hostUser = await safeSingle<{ phone: string | null }>(
    db.from('users').select('phone').eq('id', event.user_id).maybeSingle(),
  )
  // La cuenta de cobro vive en el doc PUBLICADO (meta.access), separada de
  // registry_payment_info (Mesa de Regalos): son dos cuentas distintas.
  const paymentMethods: RegistryPaymentMethod[] = doc.meta.access.cobro_payment_methods

  // La puerta se honra solo si se cumplen las tres: token del evento (arriba),
  // invitacion publicada (arriba) y modo publica. Pasar el evento a privada la
  // cierra al instante sin tocar los links personales.
  const accessMode = resolveAccessMode(event.event_type, settings?.access_mode ?? null)
  if (found.kind === 'compartida' && accessMode !== 'publica') {
    return NextResponse.json({ error: 'cerrada' }, { status: 403 })
  }

  const tienePrecio = Number(event.ticket_price) > 0

  let puerta: { seatsLeft: number | null; maxCompanions: number; agotado: boolean } | null = null
  if (found.kind === 'compartida') {
    const all = await safeList<{ party_size: number | null; amount_due: number | null; paid_at: string | null }>(
      db.from('guests').select('party_size, amount_due, paid_at').eq('event_id', eventId),
    )
    // Con precio, un pendiente_pago no ocupa lugar: la puerta solo cuenta
    // agotado contra los que ya estan dentro (mismo criterio que el registro).
    const ocupantes = all.filter(g => ocupaLugar(g, tienePrecio))
    const left = seatsLeft(event.guest_cap ?? null, occupiedSeats(ocupantes))
    puerta = {
      seatsLeft: left,
      maxCompanions: resolveMaxCompanions(event.event_type, settings?.max_companions ?? null),
      agotado: left !== null && left < 1,
    }
  }

  return NextResponse.json({
    event: {
      name: event.name, event_type: event.event_type, event_date: event.event_date, event_time: event.event_time,
      venue: event.venue, address: event.address, host_name: event.host_name, host_name_2: event.host_name_2,
    },
    guest: guest
      ? { name: guest.name, party_size: guest.party_size, rsvp_status: guest.rsvp_status, allergies: guest.allergies || [] }
      : null,
    companions: members.map(m => ({ id: m.id, name: m.name, rsvp_status: m.rsvp_status, allergies: m.allergies || [] })),
    doc,
    dressCode: parseDressCode(settingsExtra?.dress_code),
    itinerary: curateForGuests(itin),
    tokens: { playlist: settings?.playlist_token ?? null, registry: settings?.registry_token ?? null },
    mode: found.kind === 'compartida' ? 'compartida' : 'personal',
    puerta,
    ticketPrice: event.ticket_price ?? null,
    currency: event.currency ?? 'MXN',
    paymentMethods,
    contacto: resolverContacto({
      plannerName: event.planner_name,
      plannerPhone: event.planner_phone,
      plannerEmail: event.planner_email,
      hostPhone: hostUser?.phone ?? null,
      tienePrecio,
    }),
    // Estado durable del link personal. En modo compartida (sin invitado
    // todavia) van null: la tarjeta de pago de esa sesion se arma con el
    // monto que acaba de calcular el cliente al registrarse, no con esto.
    amountDue: guest ? guest.amount_due ?? null : null,
    paidAt: guest ? guest.paid_at ?? null : null,
    // Momento del registro del invitado: base para el plazo de pago visible
    // (plazoPago). Solo aplica al link personal — en compartida el cliente
    // usa "ahora" porque el invitado se acaba de registrar en esta sesion.
    guestCreatedAt: guest ? guest.created_at ?? null : null,
  })
}

function parseSubmission(body: unknown): RsvpSubmission {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const companionsRaw = Array.isArray(b.companions) ? b.companions : []
  return {
    guestAttends: Boolean(b.guestAttends),
    guestAllergies: Array.isArray(b.guestAllergies) ? b.guestAllergies.filter((x): x is string => typeof x === 'string') : [],
    companions: companionsRaw.map(c => {
      const cc = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
      return {
        id: typeof cc.id === 'string' ? cc.id : undefined,
        name: typeof cc.name === 'string' ? cc.name : '',
        attends: Boolean(cc.attends),
        allergies: Array.isArray(cc.allergies) ? cc.allergies.filter((x): x is string => typeof x === 'string') : [],
      }
    }),
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const found = await resolveToken(db, token)
  if (!found || !found.doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // El RSVP confirma a UN invitado. Con el token compartido no hay a quien
  // confirmar: ese camino es el registro (/registro), no este.
  if (found.kind !== 'guest' || !found.guest) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { guest, doc } = found

  const deadlinePassed = !isInviteOpen(doc.meta, todayISO())
  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const sub = parseSubmission(rawBody)

  const existingMembers = await safeList<{ id: string }>(
    db.from('party_members').select('id').eq('guest_id', guest.id),
  )
  const existingIds = new Set(existingMembers.map(m => m.id))
  sub.companions = sub.companions.filter(c => c.id && existingIds.has(c.id))

  let update
  try {
    update = buildRsvpUpdate(sub, { deadlinePassed })
  } catch {
    return NextResponse.json({ error: 'closed' }, { status: 410 })
  }

  const { error: guestUpdateError } = await db
    .from('guests')
    .update({ rsvp_status: update.guest.rsvp_status, allergies: update.guest.allergies })
    .eq('id', guest.id)
  if (guestUpdateError) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  await Promise.all(
    update.companions.map(c =>
      db.from('party_members')
        .update({ rsvp_status: c.rsvp_status, allergies: c.allergies })
        .eq('id', c.id as string)
        .eq('guest_id', guest.id),
    ),
  )

  const companionsResponse = update.companions.map(c => ({
    id: c.id as string,
    name: c.name,
    rsvp_status: c.rsvp_status,
    allergies: c.allergies,
  }))

  try {
    await logAction({
      eventId: guest.event_id,
      action: 'guest.rsvp_updated',
      entityType: 'guest',
      entityId: guest.id,
      entityLabel: guest.name,
    })
  } catch {
    // silent fail — nunca debe romper la confirmacion del invitado
  }

  return NextResponse.json({
    guest: { rsvp_status: update.guest.rsvp_status, allergies: update.guest.allergies },
    companions: companionsResponse,
  })
}
