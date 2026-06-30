import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateRequest } from 'twilio'
import { interpretRSVPMessage, generateAgentReply } from '@/lib/ai-rsvp'
import { after } from 'next/server'
import { mirrorInbound, mirrorOutbound } from '@/lib/whatsapp/canonical-mirror'
import { notifyInboundRsvp } from '@/lib/omnichannel/notify'

const TWIML_EMPTY = '<Response/>'

async function isTwilioRequest(request: Request): Promise<{ valid: boolean; params: Record<string, string> }> {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })

  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL!
  const signature  = request.headers.get('x-twilio-signature') ?? ''
  const valid = validateRequest(authToken, signature, webhookUrl, params)
  if (!valid) console.warn('[Webhook] Firma Twilio invalida — request rechazado')
  return { valid, params }
}

export async function POST(request: NextRequest) {
  const { valid, params } = await isTwilioRequest(request)
  if (!valid) return new NextResponse('Unauthorized', { status: 403 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const text  = (params['Body'] ?? '').trim()
    const from  = params['From'] ?? ''
    const phone = from.replace(/^whatsapp:/i, '')

    console.log('[Webhook] from:', phone, 'text:', text)

    if (!text || !phone) return twimlResponse()

    const { data: guests, error: guestError } = await supabase
      .from('guests')
      .select('id, name, event_id, rsvp_status')
      .eq('phone', phone)
      .limit(1)

    if (guestError || !guests || guests.length === 0) {
      console.log('[Webhook] Numero no registrado:', phone)
      return twimlResponse()
    }

    const guest     = guests[0]
    const guestName = guest.name?.trim() || 'Invitado'

    const { data: event } = await supabase
      .from('events')
      .select('name, event_date, event_time, venue, address, event_type, event_status')
      .eq('id', guest.event_id)
      .single()

    if (event?.event_status === 'cancelled' || event?.event_status === 'completed') {
      console.log('[Webhook] Evento no activo, se ignora:', guest.event_id, event.event_status)
      return twimlResponse()
    }

    const eventContext = {
      name:       event?.name       ?? 'tu evento',
      date:       event?.event_date ?? null,
      time:       event?.event_time ?? null,
      venue:      event?.venue      ?? null,
      address:    event?.address    ?? null,
      event_type: event?.event_type ?? null,
    }

    const { data: historial } = await supabase
      .from('wa_messages')
      .select('direction, content')
      .eq('guest_id', guest.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const history = (historial ?? []).reverse() as { direction: 'sent' | 'received'; content: string }[]

    const inboundAt = new Date().toISOString()
    const { data: inboundRow, error: insertInboundError } = await supabase
      .from('wa_messages')
      .insert({
        guest_id:   guest.id,
        event_id:   guest.event_id,
        direction:  'received',
        content:    text,
        created_at: inboundAt,
      })
      .select('id')
      .maybeSingle()
    console.log('[DB] Insert inbound:', insertInboundError ? JSON.stringify(insertInboundError) : 'OK')

    if (inboundRow?.id) {
      after(() =>
        mirrorInbound(supabase, {
          guest: { id: guest.id, name: guestName, event_id: guest.event_id },
          phone,
          text,
          sid: null,
          waMessageId: inboundRow.id,
          createdAt: inboundAt,
        })
      )
    }

    const interpretation = await interpretRSVPMessage(text, guestName, eventContext.name)
    console.log(`[AI] ${guestName}: "${text}" -> ${interpretation.intent} (${interpretation.confidence})`)

    if (interpretation.intent !== 'ambiguous' && interpretation.confidence !== 'low') {
      if (guest.rsvp_status !== interpretation.intent) {
        await supabase
          .from('guests')
          .update({ rsvp_status: interpretation.intent })
          .eq('id', guest.id)
        console.log(`[RSVP] ${guestName}: ${guest.rsvp_status} -> ${interpretation.intent}`)
      }

      const replyText = await generateAgentReply(
        interpretation.intent,
        guestName,
        eventContext,
        history,
        text
      )

      console.log(`[AI Reply] ${guestName}: "${replyText}"`)

      const outboundAt = new Date().toISOString()
      const { data: outboundRow, error: insertOutboundError } = await supabase
        .from('wa_messages')
        .insert({
          guest_id:   guest.id,
          event_id:   guest.event_id,
          direction:  'sent',
          content:    replyText,
          created_at: outboundAt,
        })
        .select('id')
        .maybeSingle()
      console.log('[DB] Insert outbound:', insertOutboundError ? JSON.stringify(insertOutboundError) : 'OK')

      if (outboundRow?.id) {
        after(() =>
          mirrorOutbound(supabase, {
            to: from,
            guestId: guest.id,
            eventId: guest.event_id,
            text: replyText,
            author: 'ia',
            status: 'sent',
            sid: null,
            waMessageId: outboundRow.id,
            createdAt: outboundAt,
          })
        )
      }

      await sendWhatsAppReply(from, replyText)

      after(() =>
        notifyInboundRsvp(supabase, {
          eventId: guest.event_id,
          guestId: guest.id,
          guestName,
          eventName: eventContext.name,
          intent: interpretation.intent,
        })
      )
    }

    return twimlResponse()
  } catch (err) {
    console.error('[Webhook Error]', err instanceof Error ? err.message : err)
    return twimlResponse()
  }
}

function twimlResponse() {
  return new NextResponse(TWIML_EMPTY, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

async function sendWhatsAppReply(to: string, body: string): Promise<void> {
  const accountSid  = process.env.TWILIO_ACCOUNT_SID!
  const authToken   = process.env.TWILIO_AUTH_TOKEN!
  const from        = process.env.TWILIO_WHATSAPP_FROM!
  const url         = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const params      = new URLSearchParams({ To: to, From: from, Body: body })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[Twilio] Error al enviar:', err)
  } else {
    console.log('[Twilio] Respuesta enviada a', to)
  }
}