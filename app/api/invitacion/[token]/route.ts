import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isInviteOpen, buildRsvpUpdate, type RsvpSubmission } from '@/lib/invite'
import { resolveDoc } from '@/lib/invite/doc'
import { parseDressCode } from '@/lib/dresscode'
import { logAction } from '@/lib/audit'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// isInviteOpen sigue tipado sobre InviteConfig (config plana vieja); el doc de bloques
// solo trae publicada+fecha_limite en meta, que es justo lo que la funcion usa.
function metaIsOpen(meta: { publicada: boolean; fecha_limite: string | null }, today: string): boolean {
  return isInviteOpen({ ...meta, mensaje_bienvenida: '', mostrar_playlist: true, mostrar_mesa: true }, today)
}

// Lectura best-effort: si la columna/tabla aun no existe (otro agente/SQL pendiente), regresa null/[] sin romper.
async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try { const { data, error } = await p; return error ? null : data } catch { return null }
}

async function safeList<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try { const { data, error } = await p; return error ? [] : (data || []) } catch { return [] }
}

type GuestRow = { id: string; event_id: string; name: string; party_size: number; rsvp_status: string; allergies: string[] | null }

async function fetchGuestAndDoc(db: ReturnType<typeof admin>, token: string) {
  const { data: guest } = await db
    .from('guests')
    .select('id, event_id, name, party_size, rsvp_status, allergies')
    .eq('rsvp_token', token)
    .maybeSingle<GuestRow>()
  if (!guest) return null

  const settings = await safeSingle<{ invite_config: unknown; playlist_token: string | null; registry_token: string | null }>(
    db.from('event_settings').select('invite_config, playlist_token, registry_token').eq('event_id', guest.event_id).maybeSingle(),
  )
  const doc = resolveDoc(settings?.invite_config, () => crypto.randomUUID())
  return { guest, settings, doc }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const found = await fetchGuestAndDoc(db, token)
  if (!found || !found.doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { guest, settings, doc } = found

  const [event, members, dressRow, itin] = await Promise.all([
    safeSingle<{ name: string; event_type: string | null; event_date: string | null; event_time: string | null; venue: string | null; address: string | null; host_name: string | null; host_name_2: string | null }>(
      db.from('events').select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2').eq('id', guest.event_id).maybeSingle(),
    ),
    safeList<{ id: string; name: string; rsvp_status: string; allergies: string[] | null }>(
      db.from('party_members').select('id, name, rsvp_status, allergies').eq('guest_id', guest.id).order('created_at', { ascending: true }),
    ),
    safeSingle<{ dress_code: unknown }>(
      db.from('event_settings').select('dress_code').eq('event_id', guest.event_id).maybeSingle(),
    ),
    safeList<{ start_time: string; title: string; location: string | null }>(
      db.from('event_itinerary_moments').select('start_time, title, location').eq('event_id', guest.event_id).eq('visible_to_guests', true).order('start_time', { ascending: true }),
    ),
  ])
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({
    event,
    guest: { name: guest.name, party_size: guest.party_size, rsvp_status: guest.rsvp_status, allergies: guest.allergies || [] },
    companions: members.map(m => ({ id: m.id, name: m.name, rsvp_status: m.rsvp_status, allergies: m.allergies || [] })),
    doc,
    dressCode: parseDressCode(dressRow?.dress_code),
    itinerary: itin,
    tokens: { playlist: settings?.playlist_token ?? null, registry: settings?.registry_token ?? null },
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

  const found = await fetchGuestAndDoc(db, token)
  if (!found || !found.doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { guest, doc } = found

  const deadlinePassed = !metaIsOpen(doc.meta, todayISO())
  const sub = parseSubmission(await req.json().catch(() => null))

  let update
  try {
    update = buildRsvpUpdate(sub, { deadlinePassed })
  } catch {
    return NextResponse.json({ error: 'closed' }, { status: 410 })
  }

  await db.from('guests').update({ rsvp_status: update.guest.rsvp_status, allergies: update.guest.allergies }).eq('id', guest.id)

  const existingUpdates = update.companions.filter(c => c.id)
  const newInserts = update.companions.filter(c => !c.id)

  await Promise.all(
    existingUpdates.map(c =>
      db.from('party_members')
        .update({ rsvp_status: c.rsvp_status, allergies: c.allergies })
        .eq('id', c.id as string)
        .eq('guest_id', guest.id),
    ),
  )

  let insertedIds: string[] = []
  if (newInserts.length > 0) {
    const { data: inserted } = await db
      .from('party_members')
      .insert(newInserts.map(c => ({
        event_id: guest.event_id,
        guest_id: guest.id,
        name: c.name,
        rsvp_status: c.rsvp_status,
        allergies: c.allergies,
      })))
      .select('id')
    insertedIds = (inserted || []).map((r: { id: string }) => r.id)
  }

  let insertIdx = 0
  const companionsResponse = update.companions.map(c => ({
    id: c.id ?? insertedIds[insertIdx++],
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
