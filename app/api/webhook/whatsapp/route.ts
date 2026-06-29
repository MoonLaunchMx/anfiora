import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateRequest } from 'twilio'
import { interpretRSVPMessage, generateAgentReply } from '@/lib/ai-rsvp'
import { sendPushToUsers, resolveEventRecipients } from '@/lib/push'

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
      .select('name, event_date, event_time, venue, address, event_type')
      .eq('id', guest.event_id)
      .single()

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

    const { error: insertInboundError } = await supabase.from('wa_messages').insert({
      guest_id:   guest.id,
      event_id:   guest.event_id,
      direction:  'received',
      content:    text,
      created_at: new Date().toISOString(),
    })
    console.log('[DB] Insert inbound:', insertInboundError ? JSON.stringify(insertInboundError) : 'OK')

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

      const { error: insertOutboundError } = await supabase.from('wa_messages').insert({
        guest_id:   guest.id,
        event_id:   guest.event_id,
        direction:  'sent',
        content:    replyText,
        created_at: new Date().toISOString(),
      })
      console.log('[DB] Insert outbound:', insertOutboundError ? JSON.stringify(insertOutboundError) : 'OK')

      await sendWhatsAppReply(from, replyText)

      try {
        const recipients = await resolveEventRecipients(guest.event_id)
        const statusLabel =
          interpretation.intent === 'confirmed' ? 'confirmó asistencia'
          : interpretation.intent === 'declined' ? 'no podrá asistir'
          : 'respondió por WhatsApp'
        await sendPushToUsers(recipients, {
          title: eventContext.name,
          body: `${guestName} ${statusLabel}.`,
          url: `/events/${guest.event_id}/mensajes`,
          tag: `wa-${guest.id}`,
        })
      } catch (pushErr: any) {
        console.error('[Webhook] push fallido', pushErr?.message ?? pushErr)
      }
    }

    return twimlResponse()
  } catch (err: any) {
    console.error('[Webhook Error]', err?.message ?? err)
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