import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateRequest } from 'twilio'
import { interpretRSVPMessage, generateAgentReply } from '@/lib/ai-rsvp'

const TWIML_EMPTY = '<Response/>'

async function isTwilioRequest(request: Request): Promise<boolean> {
  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL!
  const signature  = request.headers.get('x-twilio-signature') ?? ''
  const formData   = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })
  const valid = validateRequest(authToken, signature, webhookUrl, params)
  if (!valid) console.warn('[Webhook] Firma Twilio inválida — request rechazado')
  return valid
}

export async function POST(request: NextRequest) {
  const cloned = request.clone()
  const valid  = await isTwilioRequest(cloned)
  if (!valid) return new NextResponse('Unauthorized', { status: 403 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const form  = await request.formData()
    const text  = (form.get('Body') as string | null)?.trim() ?? ''
    const from  = (form.get('From') as string | null) ?? ''
    const phone = from.replace(/^whatsapp:/i, '')

    console.log('[Webhook] from:', phone, 'text:', text)

    if (!text || !phone) return twimlResponse()

    // ── Buscar invitado ───────────────────────────────────────────────────
    const { data: guests, error: guestError } = await supabase
      .from('guests')
      .select('id, name, event_id, rsvp_status')
      .eq('phone', phone)
      .limit(1)

    if (guestError || !guests || guests.length === 0) {
      console.log('[Webhook] Número no registrado:', phone)
      return twimlResponse()
    }

    const guest     = guests[0]
    const guestName = guest.name?.trim() || 'Invitado'

    // ── Cargar contexto completo del evento ───────────────────────────────
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

    // ── Cargar historial reciente del invitado (últimos 10 mensajes) ──────
    const { data: historial } = await supabase
      .from('wa_messages')
      .select('direction, content')
      .eq('guest_id', guest.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const history = (historial ?? []).reverse() as { direction: 'sent' | 'received'; content: string }[]

    // ── Guardar mensaje entrante ──────────────────────────────────────────
    const { error: insertInboundError } = await supabase.from('wa_messages').insert({
      guest_id:   guest.id,
      event_id:   guest.event_id,
      direction:  'received',
      content:    text,
      created_at: new Date().toISOString(),
    })
    console.log('[DB] Insert inbound:', insertInboundError ? JSON.stringify(insertInboundError) : 'OK')

    // ── Clasificar intent ─────────────────────────────────────────────────
    const interpretation = await interpretRSVPMessage(text, guestName, eventContext.name)
    console.log(`[AI] ${guestName}: "${text}" → ${interpretation.intent} (${interpretation.confidence})`)

    if (interpretation.intent !== 'ambiguous' && interpretation.confidence !== 'low') {
      // ── Actualizar rsvp_status ──────────────────────────────────────────
      if (guest.rsvp_status !== interpretation.intent) {
        await supabase
          .from('guests')
          .update({ rsvp_status: interpretation.intent })
          .eq('id', guest.id)
        console.log(`[RSVP] ${guestName}: ${guest.rsvp_status} → ${interpretation.intent}`)
      }

      // ── Generar respuesta con contexto real ─────────────────────────────
      const replyText = await generateAgentReply(
        interpretation.intent,
        guestName,
        eventContext,
        history,
        text
      )

      console.log(`[AI Reply] ${guestName}: "${replyText}"`)

      // ── Guardar mensaje saliente ────────────────────────────────────────
      const { error: insertOutboundError } = await supabase.from('wa_messages').insert({
        guest_id:   guest.id,
        event_id:   guest.event_id,
        direction:  'sent',
        content:    replyText,
        created_at: new Date().toISOString(),
      })
      console.log('[DB] Insert outbound:', insertOutboundError ? JSON.stringify(insertOutboundError) : 'OK')

      await sendWhatsAppReply(from, replyText)
    }

    return twimlResponse()
  } catch (error) {
    console.error('[Webhook Error]', error)
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