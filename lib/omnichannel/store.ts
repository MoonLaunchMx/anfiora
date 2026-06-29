import type { SupabaseClient } from '@supabase/supabase-js'
import type { InboundMessage, OutboundMessage } from './types'

// Normalizador/Store generico del nucleo omnicanal. Agnostico de canal: solo
// conoce el contrato canonico, ni una palabra de WhatsApp/Telegram. Fallo
// SILENCIOSO: nunca lanza, nunca rompe el webhook (mismo contrato que el mirror
// de WhatsApp y el audit log). Dedupe por (channel_account_id, provider_message_id).

export async function ensureChannelAccount(
  supabase: SupabaseClient,
  a: { channel: string; externalAccountId: string; displayLabel: string },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('channel_accounts').select('id')
    .eq('channel', a.channel).eq('external_account_id', a.externalAccountId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('channel_accounts')
    .insert({ channel: a.channel, external_account_id: a.externalAccountId, display_label: a.displayLabel })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('channel_accounts').select('id')
      .eq('channel', a.channel).eq('external_account_id', a.externalAccountId).maybeSingle()
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

export async function ensureBinding(
  supabase: SupabaseClient,
  b: {
    channel: string; externalAccountId: string
    participantExternalId: string; displayName: string | null
    workspaceId: string; tenantId: string | null; contactGuestId: string | null
  },
): Promise<string | null> {
  try {
    const accountId = await ensureChannelAccount(supabase, {
      channel: b.channel, externalAccountId: b.externalAccountId,
      displayLabel: `${b.channel} (compartido)`,
    })
    if (!accountId) return null
    const participantId = await ensureParticipant(supabase, {
      channelAccountId: accountId, workspaceId: b.workspaceId,
      externalId: b.participantExternalId, displayName: b.displayName,
    })
    if (!participantId) return null
    return ensureConversation(supabase, {
      channelAccountId: accountId, participantId, workspaceId: b.workspaceId,
      tenantId: b.tenantId, contactGuestId: b.contactGuestId,
    })
  } catch (e) {
    console.error('[store] ensureBinding fallo:', e instanceof Error ? e.message : e)
    return null
  }
}

async function insertCanonicalMessage(
  supabase: SupabaseClient,
  m: {
    workspaceId: string; conversationId: string; channelAccountId: string
    direction: 'inbound' | 'outbound'; authorType: 'contact' | 'ai' | 'human'
    contentText: string; status: string | null; payload: Record<string, unknown>
    providerMessageId: string; providerTimestamp: string
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
      payload: m.payload,
      provider_message_id: m.providerMessageId,
      provider_timestamp: m.providerTimestamp,
      received_at: m.providerTimestamp,
    },
    { onConflict: 'channel_account_id,provider_message_id', ignoreDuplicates: true },
  )
  const patch: Record<string, string> = { last_message_at: m.providerTimestamp }
  if (m.direction === 'inbound') patch.last_inbound_at = m.providerTimestamp
  await supabase.from('conversations').update(patch).eq('id', m.conversationId)
}

async function accountIdFor(
  supabase: SupabaseClient,
  m: { channel: string; externalAccountId: string },
): Promise<string | null> {
  return ensureChannelAccount(supabase, {
    channel: m.channel, externalAccountId: m.externalAccountId,
    displayLabel: `${m.channel} (compartido)`,
  })
}

export async function ingestInbound(supabase: SupabaseClient, m: InboundMessage): Promise<string | null> {
  try {
    if (!m.providerMessageId) return null
    const conversationId = await ensureBinding(supabase, {
      channel: m.channel, externalAccountId: m.externalAccountId,
      participantExternalId: m.participantExternalId, displayName: m.displayName,
      workspaceId: m.workspaceId, tenantId: m.tenantId, contactGuestId: m.contactGuestId,
    })
    if (!conversationId) return null
    const accountId = await accountIdFor(supabase, m)
    if (!accountId) return null
    await insertCanonicalMessage(supabase, {
      workspaceId: m.workspaceId, conversationId, channelAccountId: accountId,
      direction: 'inbound', authorType: 'contact',
      contentText: m.contentText, status: null, payload: m.payload ?? {},
      providerMessageId: m.providerMessageId, providerTimestamp: m.providerTimestamp,
    })
    return conversationId
  } catch (e) {
    console.error('[store] ingestInbound fallo:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function ingestOutbound(supabase: SupabaseClient, m: OutboundMessage): Promise<void> {
  try {
    if (!m.providerMessageId) return
    const conversationId = await ensureBinding(supabase, {
      channel: m.channel, externalAccountId: m.externalAccountId,
      participantExternalId: m.participantExternalId, displayName: null,
      workspaceId: m.workspaceId, tenantId: m.tenantId, contactGuestId: m.contactGuestId,
    })
    if (!conversationId) return
    const accountId = await accountIdFor(supabase, m)
    if (!accountId) return
    await insertCanonicalMessage(supabase, {
      workspaceId: m.workspaceId, conversationId, channelAccountId: accountId,
      direction: 'outbound', authorType: m.authorType,
      contentText: m.contentText, status: m.status, payload: {},
      providerMessageId: m.providerMessageId, providerTimestamp: m.providerTimestamp,
    })
  } catch (e) {
    console.error('[store] ingestOutbound fallo:', e instanceof Error ? e.message : e)
  }
}
