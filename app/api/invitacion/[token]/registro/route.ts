import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveDoc } from '@/lib/invite/doc'
import { isInviteOpen, randomToken } from '@/lib/invite'
import { resolveAccessMode, resolveMaxCompanions } from '@/lib/features'
import { parseRegistration, occupiedSeats, canFit } from '@/lib/puerta'

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
    .select('event_type, guest_cap')
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
    .select('id, rsvp_token')
    .eq('event_id', settings.event_id)
    .eq('phone', reg.phone)
    .maybeSingle()

  // Ya se habia registrado: se le devuelve SU invitacion. No se pisa el nombre
  // (el planner pudo haberlo curado) ni se le cobra otro lugar del cupo.
  if (existing) {
    let rsvpToken = existing.rsvp_token as string | null
    if (!rsvpToken) {
      rsvpToken = randomToken()
      await db.from('guests').update({ rsvp_token: rsvpToken }).eq('id', existing.id)
    }
    return NextResponse.json({ rsvp_token: rsvpToken, ya_estaba: true })
  }

  const { data: all } = await db
    .from('guests')
    .select('party_size')
    .eq('event_id', settings.event_id)
  if (!canFit(event.guest_cap ?? null, occupiedSeats(all || []), reg.partySize)) {
    return NextResponse.json({ error: 'agotado' }, { status: 409 })
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

  return NextResponse.json({ rsvp_token: rsvpToken, ya_estaba: false })
}
