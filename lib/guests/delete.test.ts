import { describe, it, expect } from 'vitest'
import { buildGuestDeletionOps } from './delete'

describe('buildGuestDeletionOps', () => {
  it('unlink: borra hijos propios, desvincula la conversacion y borra al invitado AL FINAL', () => {
    const ops = buildGuestDeletionOps('g1', ['c1'], 'unlink')
    expect(ops.map(o => `${o.kind}:${o.table}`)).toEqual([
      'deleteEq:party_members', 'deleteEq:table_seats', 'deleteEq:wa_messages', 'deleteEq:song_recommendations',
      'unlinkEq:conversations',
      'deleteEq:guests',
    ])
    expect(ops[ops.length - 1]).toEqual({ kind: 'deleteEq', table: 'guests', column: 'id', value: 'g1' })
  })
  it('purge: borra mensajes ANTES que las conversaciones, e invitado al final', () => {
    const ops = buildGuestDeletionOps('g1', ['c1', 'c2'], 'purge')
    const kinds = ops.map(o => `${o.kind}:${o.table}`)
    expect(kinds).toEqual([
      'deleteEq:party_members', 'deleteEq:table_seats', 'deleteEq:wa_messages', 'deleteEq:song_recommendations',
      'deleteIn:messages', 'deleteIn:conversations',
      'deleteEq:guests',
    ])
    const msgs = ops.find(o => o.table === 'messages')
    expect(msgs).toEqual({ kind: 'deleteIn', table: 'messages', column: 'conversation_id', values: ['c1', 'c2'] })
  })
  it('purge sin conversaciones: no incluye ops de messages/conversations', () => {
    const ops = buildGuestDeletionOps('g1', [], 'purge')
    expect(ops.some(o => o.table === 'messages' || o.table === 'conversations')).toBe(false)
    expect(ops[ops.length - 1].table).toBe('guests')
  })
})
