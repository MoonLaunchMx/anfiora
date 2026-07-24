import { describe, it, expect } from 'vitest'
import { buildGuestDeletionOps, buildBulkGuestDeletionOps } from './delete'

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

describe('buildBulkGuestDeletionOps', () => {
  it('unlink: una op por tabla (no una por invitado) y guests AL FINAL', () => {
    const ops = buildBulkGuestDeletionOps(['g1', 'g2', 'g3'], ['c1'], 'unlink')
    expect(ops.map(o => `${o.kind}:${o.table}`)).toEqual([
      'deleteIn:party_members', 'deleteIn:table_seats', 'deleteIn:wa_messages', 'deleteIn:song_recommendations',
      'unlinkIn:conversations',
      'deleteIn:guests',
    ])
    const owned = ops.find(o => o.table === 'party_members')
    expect(owned).toEqual({ kind: 'deleteIn', table: 'party_members', column: 'guest_id', values: ['g1', 'g2', 'g3'] })
    expect(ops[ops.length - 1]).toEqual({ kind: 'deleteIn', table: 'guests', column: 'id', values: ['g1', 'g2', 'g3'] })
  })

  it('chunk: parte los ids grandes en varias ops, con guests siempre al final', () => {
    const ids = Array.from({ length: 250 }, (_, i) => `g${i}`)
    const ops = buildBulkGuestDeletionOps(ids, [], 'unlink', 100)
    const guestOps = ops.filter(o => o.table === 'guests')
    expect(guestOps).toHaveLength(3)
    expect(guestOps.every(o => o.kind === 'deleteIn' && o.values.length <= 100)).toBe(true)
    const partyOps = ops.filter(o => o.table === 'party_members')
    expect(partyOps).toHaveLength(3)
    const lastFour = ops.slice(-3)
    expect(lastFour.every(o => o.table === 'guests')).toBe(true)
  })

  it('purge: mensajes ANTES que conversaciones, guests al final', () => {
    const ops = buildBulkGuestDeletionOps(['g1'], ['c1', 'c2'], 'purge')
    const kinds = ops.map(o => `${o.kind}:${o.table}`)
    expect(kinds).toEqual([
      'deleteIn:party_members', 'deleteIn:table_seats', 'deleteIn:wa_messages', 'deleteIn:song_recommendations',
      'deleteIn:messages', 'deleteIn:conversations',
      'deleteIn:guests',
    ])
  })

  it('sin invitados: no genera ninguna op', () => {
    expect(buildBulkGuestDeletionOps([], [], 'unlink')).toEqual([])
  })
})
