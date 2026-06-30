export type AuthorType = 'contact' | 'ai' | 'human'

export interface RawConversation {
  id: string
  channel_account_id: string
  participant_id: string
  contact_guest_id: string | null
  ai_enabled: boolean
  last_message_at: string | null
}

export interface RawMessage {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  author_type: AuthorType
  content_text: string | null
  provider_timestamp: string
}

export interface InboxConversation {
  id: string
  channel: string
  participantName: string | null
  guestId: string | null
  guestName: string | null
  rsvpStatus: string | null
  lastMessageText: string | null
  lastMessageAt: string | null
  lastAuthorType: AuthorType | null
  aiEnabled: boolean
}

export interface InboxMessage {
  id: string
  direction: 'inbound' | 'outbound'
  authorType: AuthorType
  contentText: string
  providerTimestamp: string
}

export function buildInboxConversations(input: {
  conversations: RawConversation[]
  channelByAccountId: Map<string, string>
  nameByParticipantId: Map<string, string | null>
  guestById: Map<string, { name: string | null; rsvp_status: string | null }>
  messages: RawMessage[]
}): InboxConversation[] {
  const lastByConv = new Map<string, RawMessage>()
  for (const m of input.messages) lastByConv.set(m.conversation_id, m)

  return input.conversations.map((c) => {
    const guest = c.contact_guest_id ? input.guestById.get(c.contact_guest_id) : undefined
    const last = lastByConv.get(c.id)
    return {
      id: c.id,
      channel: input.channelByAccountId.get(c.channel_account_id) ?? 'whatsapp',
      participantName: input.nameByParticipantId.get(c.participant_id) ?? null,
      guestId: c.contact_guest_id ?? null,
      guestName: guest?.name ?? null,
      rsvpStatus: guest?.rsvp_status ?? null,
      lastMessageText: last?.content_text ?? null,
      lastMessageAt: c.last_message_at ?? null,
      lastAuthorType: last?.author_type ?? null,
      aiEnabled: c.ai_enabled,
    }
  })
}

export function messagesForConversation(
  messages: RawMessage[],
  conversationId: string,
): InboxMessage[] {
  return messages
    .filter((m) => m.conversation_id === conversationId)
    .map((m) => ({
      id: m.id,
      direction: m.direction,
      authorType: m.author_type,
      contentText: m.content_text ?? '',
      providerTimestamp: m.provider_timestamp,
    }))
}
