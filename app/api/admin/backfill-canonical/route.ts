import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mirrorInbound, mirrorOutbound } from '@/lib/whatsapp/canonical-mirror'

// Backfill idempotente de wa_messages al modelo canonico. Recorre en orden
// cronologico para que conversations.last_message_at quede correcto. Re-ejecutable.
// Proteccion simple por secreto en header (solo uso manual de Diego).

const PAGE = 500

export async function POST(request: NextRequest) {
  if (request.headers.get('x-backfill-secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  let from = 0
  let processed = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from('wa_messages')
      .select('id, guest_id, event_id, body, content, direction, status, author, twilio_sid, created_at, sent_at')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message, processed }, { status: 500 })
    if (!rows || rows.length === 0) break

    for (const r of rows) {
      const { data: guest } = await supabase
        .from('guests').select('id, name, event_id, phone').eq('id', r.guest_id).maybeSingle()
      if (!guest || !guest.phone) continue

      const eventId = r.event_id ?? guest.event_id
      const ts = r.created_at ?? r.sent_at ?? new Date(0).toISOString()
      const textContent = (r.content ?? r.body ?? '').toString()
      const syntheticSid = r.twilio_sid ?? `wa:${r.id}`

      if (r.direction === 'received') {
        await mirrorInbound(supabase, {
          guest: { id: guest.id, name: guest.name, event_id: eventId },
          phone: guest.phone, text: textContent, sid: syntheticSid, createdAt: ts,
        })
      } else {
        const author = r.author === 'human' ? 'human' : 'ia'
        await mirrorOutbound(supabase, {
          to: `whatsapp:${guest.phone}`, guestId: guest.id, eventId, text: textContent,
          author, status: r.status ?? 'sent', sid: syntheticSid, createdAt: ts,
        })
      }
      processed++
    }

    from += PAGE
    if (rows.length < PAGE) break
  }

  return NextResponse.json({ ok: true, processed })
}
