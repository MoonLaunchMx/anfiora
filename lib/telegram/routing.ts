import type { SupabaseClient } from '@supabase/supabase-js'

// Ruteo de DOMINIO de Telegram. Resuelve a que evento/invitado/workspace
// pertenece un mensaje. Es la pieza de dominio (no nucleo): traduce la
// identidad de Telegram (deep-link o chat existente) al contexto de Anfiora.

export type TelegramRoute = {
  workspaceId: string
  eventId: string
  guestId: string
  guestName: string
  eventName: string
}

// Primer contacto: el deep-link `/start <guest_id>` trae la identidad.
export async function resolveStart(
  supabase: SupabaseClient,
  guestId: string,
): Promise<TelegramRoute | null> {
  const { data: guest } = await supabase
    .from('guests').select('id, name, event_id').eq('id', guestId).maybeSingle()
  if (!guest) return null
  const { data: event } = await supabase
    .from('events').select('user_id, name').eq('id', guest.event_id).maybeSingle()
  if (!event?.user_id) return null
  return {
    workspaceId: event.user_id,
    eventId: guest.event_id,
    guestId: guest.id,
    guestName: guest.name?.trim() || 'Invitado',
    eventName: event.name ?? 'tu evento',
  }
}

// Mensajes siguientes: ya hay una conversacion atada a ese chat_id.
export async function resolveByChat(
  supabase: SupabaseClient,
  a: { channelAccountId: string; chatId: string },
): Promise<TelegramRoute | null> {
  // Bot compartido: ruteamos por chat_id ignorando workspace_id y tomamos la mas
  // reciente. Con varios planners para el mismo chat habria que desambiguar (deferido).
  const { data: participant } = await supabase
    .from('channel_participants').select('id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('external_id', a.chatId)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (!participant?.id) return null

  const { data: conversation } = await supabase
    .from('conversations').select('tenant_id, contact_guest_id, workspace_id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('participant_id', participant.id)
    .maybeSingle()
  if (!conversation?.contact_guest_id || !conversation.tenant_id) return null

  const { data: guest } = await supabase
    .from('guests').select('name').eq('id', conversation.contact_guest_id).maybeSingle()
  const { data: event } = await supabase
    .from('events').select('name').eq('id', conversation.tenant_id).maybeSingle()

  return {
    workspaceId: conversation.workspace_id,
    eventId: conversation.tenant_id,
    guestId: conversation.contact_guest_id,
    guestName: guest?.name?.trim() || 'Invitado',
    eventName: event?.name ?? 'tu evento',
  }
}
