import type { SupabaseClient } from '@supabase/supabase-js'

export type ConversationMode = 'unlink' | 'purge'

export type DeleteOp =
  | { kind: 'deleteEq'; table: string; column: string; value: string }
  | { kind: 'deleteIn'; table: string; column: string; values: string[] }
  | { kind: 'unlinkEq'; table: string; column: string; value: string }
  | { kind: 'unlinkIn'; table: string; column: string; values: string[] }

const OWNED_TABLES = ['party_members', 'table_seats', 'wa_messages', 'song_recommendations']

// PostgREST manda los .in(...) en la URL, asi que lotes muy grandes la revientan.
// 100 UUIDs (~3.7KB) queda holgado bajo el limite tipico de ~8KB.
const BULK_CHUNK = 100

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

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

// Version por lote del borrado: en vez de 6 ops por invitado (8N llamadas
// secuenciales en total), colapsa todo a unas pocas ops con .in(...). Cada op
// se parte en trozos de chunkSize para no pasarnos del limite de URL de PostgREST.
export function buildBulkGuestDeletionOps(guestIds: string[], conversationIds: string[], mode: ConversationMode, chunkSize: number = BULK_CHUNK): DeleteOp[] {
  const ops: DeleteOp[] = []
  if (guestIds.length === 0) return ops
  const guestChunks = chunk(guestIds, chunkSize)
  for (const table of OWNED_TABLES) {
    for (const c of guestChunks) ops.push({ kind: 'deleteIn', table, column: 'guest_id', values: c })
  }
  if (mode === 'purge') {
    for (const c of chunk(conversationIds, chunkSize)) ops.push({ kind: 'deleteIn', table: 'messages', column: 'conversation_id', values: c })
    for (const c of chunk(conversationIds, chunkSize)) ops.push({ kind: 'deleteIn', table: 'conversations', column: 'id', values: c })
  } else {
    for (const c of guestChunks) ops.push({ kind: 'unlinkIn', table: 'conversations', column: 'contact_guest_id', values: c })
  }
  for (const c of guestChunks) ops.push({ kind: 'deleteIn', table: 'guests', column: 'id', values: c })
  return ops
}

export async function guestConversationIds(supabase: SupabaseClient, guestId: string): Promise<string[]> {
  const { data } = await supabase.from('conversations').select('id').eq('contact_guest_id', guestId)
  return (data ?? []).map((c) => c.id as string)
}

// Una sola pasada (chunked) para todo un lote: devuelve las conversaciones con su
// invitado, para armar la nota "N con conversacion" y la lista de ids a desvincular.
export async function guestConversationRowsForMany(supabase: SupabaseClient, guestIds: string[], chunkSize: number = BULK_CHUNK): Promise<{ id: string; contactGuestId: string }[]> {
  const rows: { id: string; contactGuestId: string }[] = []
  for (const c of chunk(guestIds, chunkSize)) {
    const { data } = await supabase.from('conversations').select('id, contact_guest_id').in('contact_guest_id', c)
    for (const r of (data ?? [])) rows.push({ id: r.id as string, contactGuestId: r.contact_guest_id as string })
  }
  return rows
}

// Tras un borrado por lote, la verdad la tiene la DB: consulta quien sigue vivo
// para saber exactamente que invitados SI se borraron (contador y estado local).
export async function survivingGuestIds(supabase: SupabaseClient, guestIds: string[], chunkSize: number = BULK_CHUNK): Promise<string[]> {
  const alive: string[] = []
  for (const c of chunk(guestIds, chunkSize)) {
    const { data } = await supabase.from('guests').select('id').in('id', c)
    for (const r of (data ?? [])) alive.push(r.id as string)
  }
  return alive
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
    } else if (op.kind === 'unlinkIn') {
      if (op.values.length === 0) continue
      ({ error } = await supabase.from(op.table).update({ [op.column]: null }).in(op.column, op.values))
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
