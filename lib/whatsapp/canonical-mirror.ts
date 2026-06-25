import type { SupabaseClient } from '@supabase/supabase-js'

// Espejo del flujo WhatsApp al modelo canonico omnicanal. Aditivo y de FALLO
// SILENCIOSO: nunca lanza, nunca rompe el webhook (mismo contrato que el audit log).
// El canal compartido de Anfiora se identifica por el numero de TWILIO_WHATSAPP_FROM.

const WA_CHANNEL = 'whatsapp'

function sharedAccountExternalId(): string {
  return (process.env.TWILIO_WHATSAPP_FROM ?? '').replace(/^whatsapp:/i, '')
}

async function eventOwner(supabase: SupabaseClient, eventId: string): Promise<string | null> {
  const { data } = await supabase.from('events').select('user_id').eq('id', eventId).maybeSingle()
  return data?.user_id ?? null
}

async function ensureChannelAccount(supabase: SupabaseClient): Promise<string | null> {
  const externalId = sharedAccountExternalId()
  if (!externalId) return null
  const { data: existing } = await supabase
    .from('channel_accounts').select('id')
    .eq('channel', WA_CHANNEL).eq('external_account_id', externalId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('channel_accounts')
    .insert({ channel: WA_CHANNEL, external_account_id: externalId, display_label: 'Anfiora WhatsApp (compartido)' })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('channel_accounts').select('id')
      .eq('channel', WA_CHANNEL).eq('external_account_id', externalId).maybeSingle()
    return again?.id ?? null
  }
  return data?.id ?? null
}

async function ensureParticipant(
  supabase: SupabaseClient,
  a: { channelAccountId: string; workspaceId: string; externalId: string; displayName: string | null },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('channel_participants').select('id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('workspace_id', a.workspaceId)
    .eq('external_id', a.externalId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('channel_participants')
    .insert({ channel_account_id: a.channelAccountId, workspace_id: a.workspaceId, external_id: a.externalId, display_name: a.displayName })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('channel_participants').select('id')
      .eq('channel_account_id', a.channelAccountId).eq('workspace_id', a.workspaceId).eq('external_id', a.externalId).maybeSingle()
    return again?.id ?? null
  }
  return data?.id ?? null
}

async function ensureConversation(
  supabase: SupabaseClient,
  a: { channelAccountId: string; participantId: string; workspaceId: string; tenantId: string | null; contactGuestId: string | null },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('conversations').select('id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('participant_id', a.participantId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      channel_account_id: a.channelAccountId,
      participant_id: a.participantId,
      workspace_id: a.workspaceId,
      tenant_id: a.tenantId,
      contact_guest_id: a.contactGuestId,
    })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('conversations').select('id')
      .eq('channel_account_id', a.channelAccountId).eq('participant_id', a.participantId).maybeSingle()
    return again?.id ?? null
  }
  return data?.id ?? null
}

async function insertCanonicalMessage(
  supabase: SupabaseClient,
  m: {
    workspaceId: string; conversationId: string; channelAccountId: string
    direction: 'inbound' | 'outbound'; authorType: 'contact' | 'ai' | 'human'
    contentText: string; status: string | null
    providerMessageId: string; providerTimestamp: string; receivedAt: string
  },
): Promise<void> {
  await supabase.from('messages').upsert(
    {
      workspace_id: m.workspaceId,
      conversation_id: m.conversationId,
      channel_account_id: m.channelAccountId,
      direction: m.direction,
      author_type: m.authorType,
      content_text: m.contentText,
      status: m.status,
      provider_message_id: m.providerMessageId,
      provider_timestamp: m.providerTimestamp,
      received_at: m.receivedAt,
    },
    { onConflict: 'channel_account_id,provider_message_id', ignoreDuplicates: true },
  )
  const patch: Record<string, string> = { last_message_at: m.providerTimestamp }
  if (m.direction === 'inbound') patch.last_inbound_at = m.providerTimestamp
  await supabase.from('conversations').update(patch).eq('id', m.conversationId)
}

export async function mirrorInbound(
  supabase: SupabaseClient,
  p: { guest: { id: string; name: string | null; event_id: string }; phone: string; text: string; sid: string | null; createdAt: string },
): Promise<void> {
  try {
    const workspaceId = await eventOwner(supabase, p.guest.event_id)
    if (!workspaceId) return
    const accountId = await ensureChannelAccount(supabase)
    if (!accountId) return
    const participantId = await ensureParticipant(supabase, { channelAccountId: accountId, workspaceId, externalId: p.phone, displayName: p.guest.name })
    if (!participantId) return
    const conversationId = await ensureConversation(supabase, { channelAccountId: accountId, participantId, workspaceId, tenantId: p.guest.event_id, contactGuestId: p.guest.id })
    if (!conversationId) return
    await insertCanonicalMessage(supabase, {
      workspaceId, conversationId, channelAccountId: accountId,
      direction: 'inbound', authorType: 'contact',
      contentText: p.text, status: null,
      providerMessageId: p.sid ?? `wa:in:${p.phone}:${p.createdAt}`,
      providerTimestamp: p.createdAt, receivedAt: p.createdAt,
    })
  } catch (e) {
    console.error('[mirror] inbound fallo:', e instanceof Error ? e.message : e)
  }
}

export async function mirrorOutbound(
  supabase: SupabaseClient,
  p: { to: string; guestId: string; eventId: string; text: string; author: 'ia' | 'human'; status: string; sid: string | null; createdAt: string },
): Promise<void> {
  try {
    const phone = p.to.replace(/^whatsapp:/i, '')
    const workspaceId = await eventOwner(supabase, p.eventId)
    if (!workspaceId) return
    const accountId = await ensureChannelAccount(supabase)
    if (!accountId) return
    const participantId = await ensureParticipant(supabase, { channelAccountId: accountId, workspaceId, externalId: phone, displayName: null })
    if (!participantId) return
    const conversationId = await ensureConversation(supabase, { channelAccountId: accountId, participantId, workspaceId, tenantId: p.eventId, contactGuestId: p.guestId })
    if (!conversationId) return
    await insertCanonicalMessage(supabase, {
      workspaceId, conversationId, channelAccountId: accountId,
      direction: 'outbound', authorType: p.author === 'human' ? 'human' : 'ai',
      contentText: p.text, status: p.status,
      providerMessageId: p.sid ?? `wa:out:${phone}:${p.createdAt}`,
      providerTimestamp: p.createdAt, receivedAt: p.createdAt,
    })
  } catch (e) {
    console.error('[mirror] outbound fallo:', e instanceof Error ? e.message : e)
  }
}
