import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveDoc } from '@/lib/invite/doc'
import { isInviteOpen, randomToken } from '@/lib/invite'
import { resolveAccessMode, resolveMaxCompanions } from '@/lib/features'
import { parseRegistration, occupiedSeats, seatsLeft, montoAPagar, ocupaLugar } from '@/lib/puerta'

// El alta de la puerta publica. Va por service role, igual que el resto de este
// endpoint: guests no tiene politica RLS para anon, asi que la llave del
// navegador no puede insertar invitados. La puerta no abre superficie nueva.
//
// No se llama logAction: usa el cliente de navegador y hace early return sin
// sesion, y aqui el visitante es anonimo por definicion. Seria codigo muerto.

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const db = admin()

  const { data: settings } = await db
    .from('event_settings')
    .select('event_id, invite_config, access_mode, max_companions')
    .eq('shared_token', token)
    .maybeSingle()
  if (!settings) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const doc = resolveDoc(settings.invite_config, () => crypto.randomUUID())
  if (!doc.meta.publicada) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!isInviteOpen(doc.meta, todayISO())) return NextResponse.json({ error: 'cerrada' }, { status: 403 })

  const { data: event } = await db
    .from('events')
    .select('event_type, guest_cap, ticket_price')
    .eq('id', settings.event_id)
    .maybeSingle()
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (resolveAccessMode(event.event_type, settings.access_mode) !== 'publica') {
    return NextResponse.json({ error: 'cerrada' }, { status: 403 })
  }

  const maxCompanions = resolveMaxCompanions(event.event_type, settings.max_companions)
  const body = await req.json().catch(() => null)
  const reg = parseRegistration(body, maxCompanions)
  if (!reg) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { data: existing } = await db
    .from('guests')
    .select('id')
    .eq('event_id', settings.event_id)
    .eq('phone', reg.phone)
    .maybeSingle()

  // Ya estaba en la lista: no duplicamos, no pisamos el nombre (el planner pudo
  // curarlo) ni cobramos otro lugar. Y NO devolvemos su token: el telefono no
  // es una llave. Quien lo teclee solo ve "ya estas dentro", igual que un alta
  // nueva — asi ni siquiera se puede sondear quien esta invitado.
  if (existing) {
    return NextResponse.json({ ok: true })
  }

  const tienePrecio = Number(event.ticket_price) > 0
  const { data: all } = await db
    .from('guests')
    .select('party_size, amount_due, paid_at')
    .eq('event_id', settings.event_id)
  const ocupantes = (all || []).filter(g => ocupaLugar(g, tienePrecio))
  const libres = seatsLeft(event.guest_cap ?? null, occupiedSeats(ocupantes))
  // Distingue "lleno" (0 libres) de "no alcanza para tu grupo" (quedan algunos
  // pero menos que party_size). El cliente decide el mensaje segun `quedan`.
  // Con precio, la puerta bloquea solo cuando ya no quedan lugares (agotado):
  // los pendientes de pago no ocupan, asi que no se bloquea por party_size.
  if (libres !== null && (tienePrecio ? libres <= 0 : reg.partySize > libres)) {
    return NextResponse.json({ error: 'sin_lugar', quedan: libres }, { status: 409 })
  }

  const rsvpToken = randomToken()
  const { data: created, error: insertError } = await db
    .from('guests')
    .insert({
      event_id: settings.event_id,
      name: reg.name,
      phone: reg.phone,
      party_size: reg.partySize,
      rsvp_status: 'confirmed',
      rsvp_token: rsvpToken,
      amount_due: montoAPagar(event.ticket_price, reg.partySize),
    })
    .select('id')
    .single()
  if (insertError || !created) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  // Los acompanantes son filas reales: mesas hace 1 + members.length e IGNORA
  // la columna. Guardar solo party_size haria que mesas cuente 1 donde se
  // registraron 3. Sin nombre, que es una forma que el modelo ya soporta.
  if (reg.companions > 0) {
    await db.from('party_members').insert(
      Array.from({ length: reg.companions }, () => ({
        guest_id: created.id,
        event_id: settings.event_id,
        name: '',
        rsvp_status: 'confirmed',
      })),
    )
  }

  // events.total_guests cuenta FILAS de invitados, no cabezas: la lista hace +1
  // por alta y el import CSV suma rowsToImport.length. El aforo (que si cuenta
  // cabezas) se calcula aparte con occupiedSeats. Sumar party_size aqui
  // inflaria el contador y lo desalinearia del resto de la app.
  await db.rpc('increment_guests', { event_id_input: settings.event_id })

  // Se crea con su rsvp_token (existe en la fila para que el planner pueda
  // mandarle su link despues), pero NO viaja al navegador anonimo.
  return NextResponse.json({ ok: true })
}
