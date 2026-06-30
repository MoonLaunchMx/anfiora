import { describe, it, expect } from 'vitest'
import {
  buildInboxConversations,
  messagesForConversation,
  type RawConversation,
  type RawMessage,
} from './inbox-view'

const conv = (over: Partial<RawConversation> = {}): RawConversation => ({
  id: 'c1', channel_account_id: 'acc-tg', participant_id: 'p1',
  contact_guest_id: 'g1', ai_enabled: true, last_message_at: '2026-06-29T10:00:00Z',
  ...over,
})
const msg = (over: Partial<RawMessage> = {}): RawMessage => ({
  id: 'm1', conversation_id: 'c1', direction: 'inbound', author_type: 'contact',
  content_text: 'hola', provider_timestamp: '2026-06-29T09:00:00Z', ...over,
})

describe('buildInboxConversations', () => {
  it('toma el ultimo mensaje, el canal y el invitado', () => {
    const out = buildInboxConversations({
      conversations: [conv()],
      channelByAccountId: new Map([['acc-tg', 'telegram']]),
      nameByParticipantId: new Map([['p1', 'Diego en TG']]),
      guestById: new Map([['g1', { name: 'Diego Garza', rsvp_status: 'confirmed' }]]),
      messages: [
        msg({ id: 'm1', author_type: 'contact', content_text: 'si voy', provider_timestamp: '2026-06-29T09:00:00Z' }),
        msg({ id: 'm2', direction: 'outbound', author_type: 'ai', content_text: 'Perfecto, te esperamos', provider_timestamp: '2026-06-29T09:01:00Z' }),
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0].channel).toBe('telegram')
    expect(out[0].guestName).toBe('Diego Garza')
    expect(out[0].rsvpStatus).toBe('confirmed')
    expect(out[0].lastMessageText).toBe('Perfecto, te esperamos')
    expect(out[0].lastAuthorType).toBe('ai')
    expect(out[0].aiEnabled).toBe(true)
  })

  it('conversacion sin mensajes deja preview nulo', () => {
    const out = buildInboxConversations({
      conversations: [conv()],
      channelByAccountId: new Map([['acc-tg', 'telegram']]),
      nameByParticipantId: new Map(),
      guestById: new Map([['g1', { name: 'Diego', rsvp_status: 'pending' }]]),
      messages: [],
    })
    expect(out[0].lastMessageText).toBeNull()
    expect(out[0].lastAuthorType).toBeNull()
  })

  it('conversacion sin invitado ligado deja datos de invitado en null', () => {
    const out = buildInboxConversations({
      conversations: [conv({ contact_guest_id: null })],
      channelByAccountId: new Map([['acc-tg', 'telegram']]),
      nameByParticipantId: new Map([['p1', 'Desconocido']]),
      guestById: new Map(),
      messages: [],
    })
    expect(out[0].guestId).toBeNull()
    expect(out[0].guestName).toBeNull()
    expect(out[0].participantName).toBe('Desconocido')
  })

  it('canal desconocido cae a whatsapp por compatibilidad', () => {
    const out = buildInboxConversations({
      conversations: [conv({ channel_account_id: 'acc-x' })],
      channelByAccountId: new Map(),
      nameByParticipantId: new Map(),
      guestById: new Map(),
      messages: [],
    })
    expect(out[0].channel).toBe('whatsapp')
  })
})

describe('messagesForConversation', () => {
  it('filtra por conversacion y mapea campos en orden', () => {
    const msgs: RawMessage[] = [
      msg({ id: 'm1', conversation_id: 'c1', content_text: 'a' }),
      msg({ id: 'm2', conversation_id: 'c2', content_text: 'b' }),
      msg({ id: 'm3', conversation_id: 'c1', author_type: 'human', direction: 'outbound', content_text: 'c' }),
    ]
    const out = messagesForConversation(msgs, 'c1')
    expect(out.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(out[1].authorType).toBe('human')
    expect(out[1].contentText).toBe('c')
  })

  it('content_text nulo se vuelve string vacio', () => {
    const out = messagesForConversation([msg({ content_text: null })], 'c1')
    expect(out[0].contentText).toBe('')
  })
})
