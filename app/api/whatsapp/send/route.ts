// app/api/whatsapp/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  let body: { guestId: string; eventId: string; phone: string; message: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { guestId, eventId, phone, message } = body
  if (!guestId || !eventId || !phone || !message?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Enviar vía Twilio ────────────────────────────────────────────────────
  const accountSid  = process.env.TWILIO_ACCOUNT_SID!
  const authToken   = process.env.TWILIO_AUTH_TOKEN!
  const from        = process.env.TWILIO_WHATSAPP_FROM!
  const to          = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`

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