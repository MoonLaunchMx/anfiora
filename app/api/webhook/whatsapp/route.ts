import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateRequest } from 'twilio'
import { getAgentConfig } from '@/lib/whatsapp/config'
import { isDuplicate, detectOptOut, applyOptOut, claimInboundForReply, enqueueOutbound } from '@/lib/whatsapp/reliability'
import { mirrorInbound, mirrorOutbound } from '@/lib/whatsapp/canonical-mirror'
import { runAgentPipeline } from '@/lib/whatsapp/agent'
import { distillGuestMemory, type MessageHistory } from '@/lib/ai-rsvp'

const TWIML_EMPTY = '<Response/>'

function twiml() {
  return new NextResponse(TWIML_EMPTY, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

async function isTwilioRequest(request: Request): Promise<{ valid: boolean; params: Record<string, string> }> {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })
  const valid = validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    request.headers.get('x-twilio-signature') ?? '',
    process.env.TWILIO_WEBHOOK_URL!,
    params,
  )
  if (!valid) console.warn('[Webhook] Firma Twilio invalida')
  return { valid, params }
}

export async function POST(request: NextRequest) {
  const { valid, params } = await isTwilioRequest(request)
  if (!valid) return new NextResponse('Unauthorized', { status: 403 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    const text  = (params['Body'] ?? '').trim()
    const from  = params['From'] ?? ''
    const sid   = params['MessageSid'] ?? params['SmsMessageSid'] ?? null
    const phone = from.replace(/^whatsapp:/i, '')
    if (!text || !phone) return twiml()

    // Candado de idempotencia
    if (await isDuplicate(supabase, sid)) return twiml()

    // Invitado registrado?
    const { data: guests } = await supabase
      .from('guests')
      .select('id, name, event_id, rsvp_status, wa_opt_out')
      .eq('phone', phone)
      .limit(1)
    if (!guests || guests.length === 0) return twiml()
    const guest = guests[0]

    // Opt-out entrante
    if (detectOptOut(text)) {
      const optIso = new Date().toISOString()
      await applyOptOut(supabase, guest.id)
      const { data: optRow } = await supabase.from('wa_messages').insert({
        guest_id: guest.id, event_id: guest.event_id, direction: 'received',
        content: text, twilio_sid: sid, created_at: optIso,
      }).select('id').maybeSingle()
      await mirrorInbound(supabase, { guest, phone, text, sid, waMessageId: optRow?.id ?? '', createdAt: optIso })
      return twiml()
    }

    // Guardar entrante
    const nowIso = new Date().toISOString()
    const { data: inRow } = await supabase.from('wa_messages').insert({
      guest_id: guest.id, event_id: guest.event_id, direction: 'received',
      content: text, twilio_sid: sid, created_at: nowIso,
    }).select('id').maybeSingle()
    await mirrorInbound(supabase, { guest, phone, text, sid, waMessageId: inRow?.id ?? '', createdAt: nowIso })

    const config = await getAgentConfig(supabase, guest.event_id)

    // Agente apagado: no responde
    if (!config.enabled) return twiml()

    // Debounce: solo el ultimo mensaje de la rafaga responde
    if (!(await claimInboundForReply(supabase, guest.id, nowIso))) return twiml()

    // Historial para el pipeline
    const { data: hist } = await supabase
      .from('wa_messages')
      .select('direction, content')
      .eq('guest_id', guest.id)
      .order('created_at', { ascending: false })
      .limit(10)
    const history = ((hist ?? []).reverse()) as MessageHistory[]

    const outcome = await runAgentPipeline(supabase, { guestId: guest.id, incomingText: text, config, history })
    if (!outcome) return twiml()

    if (outcome.rsvp && outcome.rsvp !== guest.rsvp_status) {
      await supabase.from('guests').update({ rsvp_status: outcome.rsvp }).eq('id', guest.id)
    }

    if (outcome.action === 'reply') {
      await enqueueOutbound(supabase, { to: from, body: outcome.text, guestId: guest.id, eventId: guest.event_id, author: 'ia' })
    } else if (outcome.action === 'draft') {
      const draftIso = new Date().toISOString()
      const { data: draftRow } = await supabase.from('wa_messages').insert({
        guest_id: guest.id, event_id: guest.event_id, direction: 'sent',
        content: outcome.text, author: 'ia', status: 'draft', created_at: draftIso,
      }).select('id').maybeSingle()
      await mirrorOutbound(supabase, {
        to: from, guestId: guest.id, eventId: guest.event_id, text: outcome.text,
        author: 'ia', status: 'draft', sid: null, waMessageId: draftRow?.id ?? '', createdAt: draftIso,
      })
      await supabase.from('guests').update({ wa_needs_human: true, wa_needs_human_reason: 'copiloto' }).eq('id', guest.id)
    } else if (outcome.action === 'handoff') {
      await enqueueOutbound(supabase, { to: from, body: outcome.message, guestId: guest.id, eventId: guest.event_id, author: 'ia' })
      if (outcome.escalate) {
        await supabase.from('guests').update({ wa_needs_human: true, wa_needs_human_reason: outcome.reason }).eq('id', guest.id)
      }
    }

    // Memoria episodica: destila notas blandas tras un intercambio real (reply/draft).
    if (outcome.action === 'reply' || outcome.action === 'draft') {
      try {
        const { data: g } = await supabase
          .from('guests').select('agent_memory').eq('id', guest.id).maybeSingle()
        const turn: MessageHistory[] = [...history, { direction: 'sent', content: outcome.text }]
        const memory = await distillGuestMemory(g?.agent_memory ?? null, turn, guest.name)
        if (memory) await supabase.from('guests').update({ agent_memory: memory }).eq('id', guest.id)
      } catch (e) {
        console.error('[WA] destilacion de memoria fallo:', e instanceof Error ? e.message : e)
      }
    }

    return twiml()
  } catch (err: any) {
    console.error('[Webhook Error]', err?.message ?? err)
    return twiml()
  }
}
