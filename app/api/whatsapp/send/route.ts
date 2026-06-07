import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueOutbound } from '@/lib/whatsapp/reliability'

export async function POST(request: NextRequest) {
  let body: { guestId: string; eventId: string; phone: string; message: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }

  const { guestId, eventId, phone, message } = body
  if (!guestId || !eventId || !phone || !message?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: guest } = await supabase.from('guests').select('wa_opt_out').eq('id', guestId).maybeSingle()
  if (guest?.wa_opt_out) return NextResponse.json({ error: 'Este invitado pidio no recibir mensajes' }, { status: 409 })

  const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
  await enqueueOutbound(supabase, { to, body: message.trim(), guestId, eventId, author: 'human' })

  await supabase.from('guests').update({ rsvp_status: 'mensaje_enviado' }).eq('id', guestId).eq('rsvp_status', 'pending')

  return NextResponse.json({ ok: true })
}
