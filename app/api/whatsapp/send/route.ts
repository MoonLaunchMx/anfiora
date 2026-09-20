// app/api/whatsapp/send/route.ts
//
// Manda un WhatsApp desde el numero de Anfiora. Sin candado era un cañon
// abierto: cualquiera en internet podia mandar mensajes con nuestro numero,
// a cualquier telefono, y ademas ensuciar la conversacion de un evento.
//
// Ahora pide sesion con acceso a ESE evento y el telefono no viene del
// cuerpo: se saca del invitado, que tiene que ser de ese mismo evento.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyEventAccess } from '@/lib/omnichannel/access'

export async function POST(request: NextRequest) {
  let body: { guestId: string; eventId: string; message: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { guestId, eventId, message } = body
  if (!guestId || !eventId || !message?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const acceso = await verifyEventAccess(request.headers.get('authorization'), eventId)
  if (!acceso) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invitado } = await supabaseAdmin
    .from('guests').select('id, phone').eq('id', guestId).eq('event_id', eventId).maybeSingle()
  if (!invitado?.phone) {
    return NextResponse.json({ error: 'Ese invitado no es de este evento o no tiene teléfono' }, { status: 404 })
  }

  // ── Enviar vía Twilio ────────────────────────────────────────────────────
  const accountSid  = process.env.TWILIO_ACCOUNT_SID!
  const authToken   = process.env.TWILIO_AUTH_TOKEN!
  const from        = process.env.TWILIO_WHATSAPP_FROM!
  const to          = invitado.phone.startsWith('whatsapp:') ? invitado.phone : `whatsapp:${invitado.phone}`

  const url         = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const params      = new URLSearchParams({ To: to, From: from, Body: message.trim() })

  const twilioRes = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!twilioRes.ok) {
    const err = await twilioRes.text()
    console.error('[Send] Twilio error:', err)
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 502 })
  }

  // ── Guardar en wa_messages ───────────────────────────────────────────────
  const { error: insertError } = await supabaseAdmin.from('wa_messages').insert({
    guest_id:   guestId,
    event_id:   eventId,
    direction:  'sent',
    content:    message.trim(),
    created_at: new Date().toISOString(),
  })

  if (insertError) {
    console.error('[Send] DB insert error:', insertError)
  }

  // ── Marcar como mensaje_enviado si estaba en pending ────────────────────
  await supabaseAdmin
    .from('guests')
    .update({ rsvp_status: 'mensaje_enviado' })
    .eq('id', guestId)
    .eq('rsvp_status', 'pending')

  return NextResponse.json({ ok: true })
}