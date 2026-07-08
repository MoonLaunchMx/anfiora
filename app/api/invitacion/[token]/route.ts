import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveDoc } from '@/lib/invite/doc'
import { parseDressCode } from '@/lib/dresscode'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
