import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// API publica de la mesa de regalos, acotada por token. Usa service role para
// no abrir RLS anon en las tablas: solo expone los datos de ESE evento, y nunca
// nombres/telefonos/mensajes de reservaciones (solo agregados por regalo).

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function eventIdFromToken(db: ReturnType<typeof admin>, token: string): Promise<string | null> {
  if (!token) return null
  const { data } = await db.from('event_settings').select('event_id').eq('registry_token', token).maybeSingle()
  return data?.event_id || null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = admin()
  const eventId = await eventIdFromToken(db, token)
  if (!eventId) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: event }, { data: items }, { data: res }, { data: settings }] = await Promise.all([
    db.from('events').select('id, name, host_name, host_name_2, event_date, venue, event_type').eq('id', eventId).maybeSingle(),
    db.from('gift_registry_items').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
    db.from('gift_reservations').select('item_id, amount').eq('event_id', eventId),
    db.from('event_settings').select('registry_payment_info').eq('event_id', eventId).maybeSingle(),
  ])
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Agregados por regalo (sin nombres, telefonos ni mensajes)
  const aggregates: Record<string, { count: number; sum: number }> = {}
  for (const r of res || []) {
    const a = aggregates[r.item_id] || { count: 0, sum: 0 }
    a.count += 1
    a.sum += r.amount || 0
    aggregates[r.item_id] = a
  }

  return NextResponse.json({
    event,
    items: items || [],
    aggregates,
    payment_info: settings?.registry_payment_info || null,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let body: { item_id?: string; guest_name?: string; guest_phone?: string; amount?: number; message?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_body' }, { status: 400 }) }

  const { item_id, guest_name, guest_phone, amount, message } = body
  if (!item_id || !guest_name?.trim()) {
    return NextResponse.json({ error: 'faltan_datos' }, { status: 400 })
  }

  const db = admin()
  const eventId = await eventIdFromToken(db, token)
  if (!eventId) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: item } = await db
    .from('gift_registry_items')
    .select('id')
    .eq('id', item_id)
    .eq('event_id', eventId)
    .maybeSingle()
  if (!item) return NextResponse.json({ error: 'regalo_invalido' }, { status: 400 })

  const amt = amount != null && !isNaN(Number(amount)) && Number(amount) > 0 ? Number(amount) : null

  const { error } = await db.from('gift_reservations').insert({
    item_id,
    event_id: eventId,
    guest_name: guest_name.trim().slice(0, 120),
    guest_phone: guest_phone?.trim().slice(0, 40) || null,
    amount: amt,
    message: message?.trim().slice(0, 500) || null,
  })
  if (error) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
