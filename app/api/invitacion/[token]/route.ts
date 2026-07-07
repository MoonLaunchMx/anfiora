import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mergeInviteConfig, isInviteOpen, buildRsvpUpdate, type RsvpSubmission } from '@/lib/invite'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Lectura best-effort: si la columna/tabla aun no existe (otro agente), regresa null/[] sin romper.
async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try { const { data, error } = await p; return error ? null : data } catch { return null }
}

async function safeList<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try { const { data, error } = await p; return error ? [] : (data || []) } catch { return [] }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const { data: guest } = await db
    .from('guests')
    .select('id, event_id, name, party_size, rsvp_status, allergies, notes')
    .eq('rsvp_token', token)
    .maybeSingle()
  if (!guest) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: event }, { data: settings }, { data: members }] = await Promise.all([
    db.from('events').select('id, name, event_date, event_time, event_type, venue, address, host_name, host_name_2').eq('id', guest.event_id).maybeSingle(),
    db.from('event_settings').select('invite_config, playlist_token, registry_token').eq('event_id', guest.event_id).maybeSingle(),
    db.from('party_members').select('id, name, rsvp_status, allergies').eq('guest_id', guest.id).order('created_at', { ascending: true }),
  ])
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const config = mergeInviteConfig(settings?.invite_config)
  if (!config.publicada) return NextResponse.json({ error: 'no_publicada' }, { status: 404 })

  const dressRow = await safeSingle(db.from('event_settings').select('dress_code').eq('event_id', guest.event_id).maybeSingle())
  const itin = await safeList(db.from('event_itinerary_moments').select('start_time, title, location').eq('event_id', guest.event_id).eq('visible_to_guests', true).order('start_time', { ascending: true }))

  return NextResponse.json({
    event,
    guest: { id: guest.id, name: guest.name, party_size: guest.party_size, rsvp_status: guest.rsvp_status, allergies: guest.allergies || [], notes: guest.notes || null },
    party_members: members || [],
    config: { mensaje_bienvenida: config.mensaje_bienvenida, fecha_limite: config.fecha_limite, mostrar_playlist: config.mostrar_playlist, mostrar_mesa: config.mostrar_mesa },
    open: isInviteOpen(config, todayISO()),
    playlist_token: config.mostrar_playlist ? (settings?.playlist_token || null) : null,
    registry_token: config.mostrar_mesa ? (settings?.registry_token || null) : null,
    dress_code: (dressRow as { dress_code?: unknown } | null)?.dress_code ?? null,
    itinerary: itin.length ? itin : null,
  })
}
