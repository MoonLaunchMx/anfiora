import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyEventAccess } from '@/lib/omnichannel/access'
import {
  buildInboxConversations,
  messagesForConversation,
  type RawConversation,
  type RawMessage,
} from '@/lib/omnichannel/inbox-view'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId') ?? ''
  const conversationId = searchParams.get('conversationId')
  if (!eventId) return NextResponse.json({ error: 'Falta eventId' }, { status: 400 })

  const access = await verifyEventAccess(request.headers.get('authorization'), eventId)
  if (!access) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: convs } = await admin
    .from('conversations')
    .select('id, channel_account_id, participant_id, contact_guest_id, ai_enabled, last_message_at')
    .eq('tenant_id', eventId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (!convs || convs.length === 0) return NextResponse.json({ conversations: [] })

  const accountIds = [...new Set(convs.map((c) => c.channel_account_id))]
  const participantIds = [...new Set(convs.map((c) => c.participant_id))]
  const guestIds = [...new Set(convs.map((c) => c.contact_guest_id).filter(Boolean))] as string[]
  const convIds = convs.map((c) => c.id)

  const [{ data: accounts }, { data: participants }, { data: guests }, { data: msgs }] = await Promise.all([
    admin.from('channel_accounts').select('id, channel').in('id', accountIds),
    admin.from('channel_participants').select('id, display_name').in('id', participantIds),
    guestIds.length
      ? admin.from('guests').select('id, name, rsvp_status').in('id', guestIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; rsvp_status: string | null }[] }),
    admin.from('messages')
      .select('id, conversation_id, direction, author_type, content_text, provider_timestamp')
      .in('conversation_id', convIds)
      .order('provider_timestamp', { ascending: true }),
  ])

  const messages = (msgs ?? []) as RawMessage[]

  const conversations = buildInboxConversations({
    conversations: convs as RawConversation[],
    channelByAccountId: new Map((accounts ?? []).map((a) => [a.id, a.channel])),
    nameByParticipantId: new Map((participants ?? []).map((p) => [p.id, p.display_name])),
    guestById: new Map((guests ?? []).map((g) => [g.id, { name: g.name, rsvp_status: g.rsvp_status }])),
    messages,
  })

  const thread = conversationId ? messagesForConversation(messages, conversationId) : undefined

  return NextResponse.json({ conversations, messages: thread })
}
