import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { distillGuestMemory, type EventContext, type MessageHistory } from '@/lib/ai-rsvp'
import { ingestInbound, ingestOutbound, ensureBinding } from '@/lib/omnichannel/store'
import { notifyInboundRsvp } from '@/lib/omnichannel/notify'
import {
  TG_CHANNEL,
  parseTelegramUpdate,
  ensureTelegramAccount,
  telegramExternalAccountId,
  sendTelegramMessage,
  type TelegramUpdate,
} from '@/lib/telegram/adapter'
import { resolveStart, resolveByChat, type TelegramRoute } from '@/lib/telegram/routing'
import { applyExtraction, resolveEscalation } from '@/lib/agent/apply'
import { extractFromMessage, executeWritePlan } from '@/lib/agent/extraction'
import { getAgentConfig } from '@/lib/agent/config'
import { buildContextPack } from '@/lib/agent/context-pack'
import { runPipelineOnPack } from '@/lib/agent/pipeline'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const update = parseTelegramUpdate(body)
  if (!update) return NextResponse.json({ ok: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: rawRow } = await supabase
    .from('webhook_events')
    .upsert(
      { provider: TG_CHANNEL, provider_event_id: String(update.updateId), payload: body },
      { onConflict: 'provider,provider_event_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (!rawRow?.id) return NextResponse.json({ ok: true })

  after(() => processTelegramUpdate(supabase, update, rawRow.id))
  return NextResponse.json({ ok: true })
}

async function markProcessed(supabase: SupabaseClient, id: string, error?: string): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), process_error: error ?? null })
    .eq('id', id)
}

async function processTelegramUpdate(
  supabase: SupabaseClient,
  update: TelegramUpdate,
  webhookEventId: string,
): Promise<void> {
  try {
    if (!update.text) return await markProcessed(supabase, webhookEventId, 'sin texto')

    const accountId = await ensureTelegramAccount(supabase)
    if (!accountId) return await markProcessed(supabase, webhookEventId, 'sin channel account')

    const route: TelegramRoute | null =
      update.isStart && update.startPayload
        ? await resolveStart(supabase, update.startPayload)
        : await resolveByChat(supabase, { channelAccountId: accountId, chatId: update.chatId })

    if (!route) return await markProcessed(supabase, webhookEventId, 'sin clasificar')

    if (route.eventStatus === 'cancelled' || route.eventStatus === 'completed') {
      return await markProcessed(supabase, webhookEventId, `evento ${route.eventStatus}`)
    }

    const externalAccountId = telegramExternalAccountId()

    if (update.isStart) {
      await ensureBinding(supabase, {
        channel: TG_CHANNEL,
        externalAccountId,
        participantExternalId: update.chatId,
        displayName: update.displayName,
        workspaceId: route.workspaceId,
        tenantId: route.eventId,
        contactGuestId: route.guestId,
      })
      const welcome = `Hola ${route.guestName}, soy el asistente de ${route.eventName} en Anfiora. Puedes confirmar tu asistencia respondiendo por aqui.`
      const sent = await sendTelegramMessage(update.chatId, welcome)
      if (sent.ok && sent.messageId) {
        await ingestOutbound(supabase, {
          channel: TG_CHANNEL,
          externalAccountId,
          participantExternalId: update.chatId,
          contentText: welcome,
          authorType: 'ai',
          providerMessageId: `${update.chatId}:${sent.messageId}`,
          providerTimestamp: sent.date,
          status: 'sent',
          workspaceId: route.workspaceId,
          tenantId: route.eventId,
          contactGuestId: route.guestId,
        })
      }
      return await markProcessed(supabase, webhookEventId)
    }

    const conversationId = await ingestInbound(supabase, {
      channel: TG_CHANNEL,
      externalAccountId,
      participantExternalId: update.chatId,
      displayName: update.displayName,
      providerMessageId: update.providerMessageId,
      providerTimestamp: update.date,
      contentText: update.text,
      workspaceId: route.workspaceId,
      tenantId: route.eventId,
      contactGuestId: route.guestId,
    })

    if (conversationId) {
      const { data: conv } = await supabase
        .from('conversations').select('ai_enabled').eq('id', conversationId).maybeSingle()
      if (conv && conv.ai_enabled === false) {
        return await markProcessed(supabase, webhookEventId)
      }
    }

    const { data: eventRow } = await supabase
      .from('events')
      .select('name, event_date, event_time, venue, address, event_type')
      .eq('id', route.eventId)
      .maybeSingle()

    const eventContext: EventContext = {
      name: eventRow?.name ?? route.eventName,
      date: eventRow?.event_date ?? null,
      time: eventRow?.event_time ?? null,
      venue: eventRow?.venue ?? null,
      address: eventRow?.address ?? null,
      event_type: eventRow?.event_type ?? null,
    }

    let history: MessageHistory[] = []
    if (conversationId) {
      const { data: hist } = await supabase
        .from('messages')
        .select('direction, content_text')
        .eq('conversation_id', conversationId)
        .neq('provider_message_id', update.providerMessageId)
        .order('provider_timestamp', { ascending: false })
        .limit(10)
      history = (hist ?? [])
        .reverse()
        .map((h) => ({
          direction: h.direction === 'inbound' ? 'received' : 'sent',
          content: h.content_text ?? '',
        })) as MessageHistory[]
    }

    const config = await getAgentConfig(supabase, route.eventId)

    const { data: guestRow } = await supabase
      .from('guests').select('rsvp_status, allergies').eq('id', route.guestId).maybeSingle()
    const { data: partyMembers } = await supabase
      .from('party_members')
      .select('id, guest_id, event_id, name, rsvp_status, allergies')
      .eq('guest_id', route.guestId)

    const extraction = await extractFromMessage(update.text, {
      guestName: route.guestName,
      eventName: eventContext.name,
      partyMembers: (partyMembers ?? []).map((m) => m.name),
    })
    console.log(`[Agent] ${route.guestName}: conf ${extraction.confidence}`)

    const plan = applyExtraction(
      extraction,
      { rsvp_status: guestRow?.rsvp_status ?? 'pending', allergies: guestRow?.allergies },
      partyMembers ?? [],
      update.text,
    )
    await executeWritePlan(supabase, plan, route.guestId)

    const escalate = resolveEscalation(plan, {
      complaint: extraction.complaint,
      escalateQuejas: config.escalate.quejas,
    })
    const intentForPipeline = {
      intent: extraction.attendance === 'none' ? 'respondio' : extraction.attendance,
      confidence: extraction.confidence,
    }

    // Cerebro: respuesta grounded con self-check
    const pack = await buildContextPack(supabase, route.guestId, config)
    if (pack) {
      const outcome = await runPipelineOnPack(pack, update.text, intentForPipeline, config, history, {
        applied: plan.appliedSummary,
        escalate,
      })
      let replyText: string | null = null
      if (outcome.action === 'reply') {
        replyText = outcome.text
      } else if (outcome.action === 'handoff') {
        replyText = outcome.message
        const { data: g2 } = await supabase.from('guests').select('needs_attention').eq('id', route.guestId).maybeSingle()
        if (!g2?.needs_attention) {
          await supabase.from('guests').update({ needs_attention: true, attention_reason: 'duda' }).eq('id', route.guestId)
        }
      } else {
        // draft (copiloto) fuera de alcance en Fase 1: se trata como atencion, no se envia
        await supabase.from('guests').update({ needs_attention: true, attention_reason: 'duda' }).eq('id', route.guestId)
      }

      if (replyText) {
        const sent = await sendTelegramMessage(update.chatId, replyText)
        if (sent.ok && sent.messageId) {
          await ingestOutbound(supabase, {
            channel: TG_CHANNEL, externalAccountId, participantExternalId: update.chatId,
            contentText: replyText, authorType: 'ai', providerMessageId: `${update.chatId}:${sent.messageId}`,
            providerTimestamp: sent.date, status: 'sent', workspaceId: route.workspaceId,
            tenantId: route.eventId, contactGuestId: route.guestId,
          })
          await notifyInboundRsvp(supabase, {
            eventId: route.eventId, guestId: route.guestId, guestName: route.guestName,
            eventName: eventContext.name, intent: intentForPipeline.intent,
          })

          // Memoria episodica
          const turn: MessageHistory[] = [...history, { direction: 'received', content: update.text }, { direction: 'sent', content: replyText }]
          const { data: gm } = await supabase.from('guests').select('agent_memory').eq('id', route.guestId).maybeSingle()
          const memory = await distillGuestMemory(gm?.agent_memory ?? null, turn, route.guestName)
          if (memory) await supabase.from('guests').update({ agent_memory: memory }).eq('id', route.guestId)
        }
      }
    }

    return await markProcessed(supabase, webhookEventId)
  } catch (e) {
    console.error('[Telegram Webhook] proceso fallo:', e instanceof Error ? e.message : e)
    await markProcessed(supabase, webhookEventId, e instanceof Error ? e.message : 'error')
  }
}
