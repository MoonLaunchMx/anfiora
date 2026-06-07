import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentConfig, FaqEntry } from '@/lib/types'

export type ContextPack = {
  eventName: string
  eventType: string | null
  date: string | null
  time: string | null
  venue: string | null
  address: string | null
  hosts: string | null
  guestName: string
  rsvpStatus: string | null
  partySize: number | null
  table: string | null
  allergies: string[]
  faq: FaqEntry[]
}

function hostsOf(event: any): string | null {
  const parts = [event?.host_name, event?.host_name_2].filter(Boolean)
  return parts.length ? parts.join(' y ') : null
}

export async function buildContextPack(
  supabase: SupabaseClient,
  guestId: string,
  config: AgentConfig,
): Promise<ContextPack | null> {
  const { data: guest } = await supabase
    .from('guests')
    .select('id, name, event_id, rsvp_status, party_size, allergies')
    .eq('id', guestId)
    .maybeSingle()
  if (!guest) return null

  const [{ data: event }, { data: seat }] = await Promise.all([
    supabase
      .from('events')
      .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
      .eq('id', guest.event_id)
      .maybeSingle(),
    supabase
      .from('table_seats')
      .select('tables(name, number)')
      .eq('guest_id', guestId)
      .maybeSingle(),
  ])
  const rawTables = seat?.tables as any
  const t = Array.isArray(rawTables) ? rawTables[0] : rawTables
  const table = t ? (t.name ?? (t.number != null ? `Mesa ${t.number}` : null)) : null

  return {
    eventName: event?.name ?? 'el evento',
    eventType: event?.event_type ?? null,
    date: event?.event_date ?? null,
    time: event?.event_time ?? null,
    venue: event?.venue ?? null,
    address: event?.address ?? null,
    hosts: hostsOf(event),
    guestName: guest.name?.trim() || 'Invitado',
    rsvpStatus: guest.rsvp_status ?? null,
    partySize: guest.party_size ?? null,
    table,
    allergies: Array.isArray(guest.allergies) ? guest.allergies : [],
    faq: config.faq ?? [],
  }
}

export async function buildPreviewPack(
  supabase: SupabaseClient,
  eventId: string,
  config: AgentConfig,
): Promise<ContextPack | null> {
  const { data: event } = await supabase
    .from('events')
    .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return null
  return {
    eventName: event.name ?? 'el evento',
    eventType: event.event_type ?? null,
    date: event.event_date ?? null,
    time: event.event_time ?? null,
    venue: event.venue ?? null,
    address: event.address ?? null,
    hosts: hostsOf(event),
    guestName: 'Invitado de prueba',
    rsvpStatus: null,
    partySize: null,
    table: null,
    allergies: [],
    faq: config.faq ?? [],
  }
}

export function renderContextPackText(pack: ContextPack): string {
  const fecha = pack.date
    ? new Date(pack.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const lines = [
    `Evento: ${pack.eventName}`,
    pack.eventType ? `Tipo: ${pack.eventType}` : null,
    fecha ? `Fecha: ${fecha}` : null,
    pack.time ? `Hora: ${pack.time}` : null,
    pack.venue ? `Lugar: ${pack.venue}` : null,
    pack.address ? `Direccion: ${pack.address}` : null,
    pack.hosts ? `Anfitriones: ${pack.hosts}` : null,
    `--- Invitado ---`,
    `Nombre: ${pack.guestName}`,
    pack.table ? `Mesa asignada: ${pack.table}` : null,
    pack.partySize ? `Personas en su grupo: ${pack.partySize}` : null,
    pack.allergies.length ? `Alergias registradas: ${pack.allergies.join(', ')}` : null,
  ].filter(Boolean)

  const faq = pack.faq.length
    ? `\n--- Preguntas frecuentes (respuestas oficiales) ---\n` +
      pack.faq.map(f => `P: ${f.q}\nR: ${f.a}`).join('\n')
    : ''

  return lines.join('\n') + faq
}
