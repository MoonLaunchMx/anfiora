import type { SupabaseClient } from '@supabase/supabase-js'

export type ConversationMode = 'unlink' | 'purge'

export type DeleteOp =
  | { kind: 'deleteEq'; table: string; column: string; value: string }
  | { kind: 'deleteIn'; table: string; column: string; values: string[] }
  | { kind: 'unlinkEq'; table: string; column: string; value: string }

const OWNED_TABLES = ['party_members', 'table_seats', 'wa_messages', 'song_recommendations']

export function buildGuestDeletionOps(guestId: string, conversationIds: string[], mode: ConversationMode): DeleteOp[] {
  const ops: DeleteOp[] = []
  for (const table of OWNED_TABLES) ops.push({ kind: 'deleteEq', table, column: 'guest_id', value: guestId })
  if (mode === 'purge') {
    if (conversationIds.length > 0) {
      ops.push({ kind: 'deleteIn', table: 'messages', column: 'conversation_id', values: conversationIds })
      ops.push({ kind: 'deleteIn', table: 'conversations', column: 'id', values: conversationIds })
    }
  } else {
    ops.push({ kind: 'unlinkEq', table: 'conversations', column: 'contact_guest_id', value: guestId })
  }
  ops.push({ kind: 'deleteEq', table: 'guests', column: 'id', value: guestId })
  return ops
}

export async function guestConversationIds(supabase: SupabaseClient, guestId: string): Promise<string[]> {
  const { data } = await supabase.from('conversations').select('id').eq('contact_guest_id', guestId)
  return (data ?? []).map((c) => c.id as string)
}

export async function guestHasChat(supabase: SupabaseClient, guestId: string): Promise<boolean> {
  const ids = await guestConversationIds(supabase, guestId)
  if (ids.length === 0) return false
  const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', ids)
  return (count ?? 0) > 0
}

export async function executeGuestDeletion(supabase: SupabaseClient, ops: DeleteOp[]): Promise<{ ok: boolean; error: string | null }> {
  for (const op of ops) {
    let error: { message: string } | null = null
    if (op.kind === 'deleteEq') {
      ({ error } = await supabase.from(op.table).delete().eq(op.column, op.value))
    } else if (op.kind === 'deleteIn') {
      if (op.values.length === 0) continue
      ({ error } = await supabase.from(op.table).delete().in(op.column, op.values))
    } else {
      ({ error } = await supabase.from(op.table).update({ [op.column]: null }).eq(op.column, op.value))
    }
    if (error) {
      console.error('[deleteGuest] fallo en', op.table, JSON.stringify(error))
      return { ok: false, error: error.message }
    }
  }
  return { ok: true, error: null }
}
