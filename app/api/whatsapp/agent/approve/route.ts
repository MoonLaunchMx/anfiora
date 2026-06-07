import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueOutbound } from '@/lib/whatsapp/reliability'

export async function POST(request: NextRequest) {
  let body: { messageId: string; editedText?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  if (!body.messageId) return NextResponse.json({ error: 'Falta messageId' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: draft } = await supabase
    .from('wa_messages')
    .select('id, guest_id, event_id, content, status')
    .eq('id', body.messageId)
    .maybeSingle()
  if (!draft || draft.status !== 'draft') return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 })

  const { data: guest } = await supabase.from('guests').select('phone').eq('id', draft.guest_id).maybeSingle()
  if (!guest?.phone) return NextResponse.json({ error: 'Invitado sin telefono' }, { status: 400 })

  const text = body.editedText?.trim() || draft.content
  const to = guest.phone.startsWith('whatsapp:') ? guest.phone : `whatsapp:${guest.phone}`

  const result = await enqueueOutbound(supabase, { to, body: text, guestId: draft.guest_id, eventId: draft.event_id, author: 'human' })
  if (!result.ok) return NextResponse.json({ error: 'No se pudo enviar el mensaje' }, { status: 502 })

  await supabase.from('wa_messages').update({ status: 'sent_from_draft' }).eq('id', draft.id)
  await supabase.from('guests').update({ wa_needs_human: false, wa_needs_human_reason: null }).eq('id', draft.guest_id)

  return NextResponse.json({ ok: true })
}
