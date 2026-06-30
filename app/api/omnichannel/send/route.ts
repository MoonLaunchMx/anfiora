import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyEventAccess } from '@/lib/omnichannel/access'
import { ingestOutbound } from '@/lib/omnichannel/store'
import { sendTelegramMessage, telegramExternalAccountId } from '@/lib/telegram/adapter'

export async function POST(request: NextRequest) {
  let body: { conversationId: string; text: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  const { conversationId, text } = body
  if (!conversationId || !text?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: conv } = await admin
    .from('conversations')
    .select('id, channel_account_id, participant_id, workspace_id, tenant_id, contact_guest_id')
    .eq('id', conversationId).maybeSingle()
  if (!conv?.tenant_id) return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 })

  const access = await verifyEventAccess(request.headers.get('authorization'), conv.tenant_id)
  if (!access) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const [{ data: account }, { data: participant }] = await Promise.all([
    admin.from('channel_accounts').select('channel, external_account_id').eq('id', conv.channel_account_id).maybeSingle(),
    admin.from('channel_participants').select('external_id').eq('id', conv.participant_id).maybeSingle(),
  ])
  if (!account || !participant) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

  const clean = text.trim()
  const channel = account.channel
  const externalId: string = participant.external_id

  // ── Telegram ───────────────────────────────────────────────────────────────
  if (channel === 'telegram') {
    const sent = await sendTelegramMessage(externalId, clean)
    if (!sent.ok || !sent.messageId) {
      return NextResponse.json({ error: 'Error al enviar por Telegram' }, { status: 502 })
    }
    await ingestOutbound(admin, {
      channel: 'telegram',
      externalAccountId: telegramExternalAccountId(),
      participantExternalId: externalId,
      contentText: clean,
      authorType: 'human',
      providerMessageId: `${externalId}:${sent.messageId}`,
      providerTimestamp: sent.date,
      status: 'sent',
      workspaceId: conv.workspace_id,
      tenantId: conv.tenant_id,
      contactGuestId: conv.contact_guest_id,
    })
    return NextResponse.json({ ok: true })
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  if (channel === 'whatsapp') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken  = process.env.TWILIO_AUTH_TOKEN!
    const from       = process.env.TWILIO_WHATSAPP_FROM!
    const to         = externalId.startsWith('whatsapp:') ? externalId : `whatsapp:${externalId}`
    const url         = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const params      = new URLSearchParams({ To: to, From: from, Body: clean })

    const twilioRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!twilioRes.ok) {
      const err = await twilioRes.text()
      console.error('[omni-send] Twilio error:', err)
      return NextResponse.json({ error: 'Error al enviar por WhatsApp' }, { status: 502 })
    }
    const sentAt = new Date().toISOString()

    const { data: waRow } = await admin.from('wa_messages').insert({
      guest_id: conv.contact_guest_id,
      event_id: conv.tenant_id,
      direction: 'sent',
      content: clean,
      created_at: sentAt,
    }).select('id').maybeSingle()

    if (conv.contact_guest_id) {
      await admin.from('guests').update({ rsvp_status: 'mensaje_enviado' })
        .eq('id', conv.contact_guest_id).eq('rsvp_status', 'pending')
    }

    await ingestOutbound(admin, {
      channel: 'whatsapp',
      externalAccountId: account.external_account_id ?? from.replace(/^whatsapp:/, ''),
      participantExternalId: externalId,
      contentText: clean,
      authorType: 'human',
      providerMessageId: waRow?.id ? `wa:${waRow.id}` : `wa:${sentAt}`,
      providerTimestamp: sentAt,
      status: 'sent',
      workspaceId: conv.workspace_id,
      tenantId: conv.tenant_id,
      contactGuestId: conv.contact_guest_id,
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Canal no soportado' }, { status: 400 })
}
