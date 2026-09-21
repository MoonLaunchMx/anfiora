import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

import { parseLimitError, esErrorDeCupo, esErrorDeArchivado } from './capacity'

describe('parseLimitError', () => {
  it('lee el error que levanta el trigger', () => {
    expect(parseLimitError('EVENT_LIMIT_EXCEEDED:2:1')).toEqual({ needed: 2, limit: 1 })
  })

  it('lo encuentra aunque venga envuelto por postgres', () => {
    expect(parseLimitError('P0001: EVENT_LIMIT_EXCEEDED:26:25')).toEqual({ needed: 26, limit: 25 })
  })

  it('devuelve null con cualquier otro error', () => {
    expect(parseLimitError('duplicate key value violates unique constraint')).toBeNull()
    expect(parseLimitError('')).toBeNull()
  })
})

describe('esErrorDeCupo', () => {
  it('distingue el error de cupo de los demas', () => {
    expect(esErrorDeCupo({ message: 'EVENT_LIMIT_EXCEEDED:2:1' })).toBe(true)
    expect(esErrorDeCupo({ message: 'EVENTO_ARCHIVADO' })).toBe(false)
    expect(esErrorDeCupo(null)).toBe(false)
  })
})

describe('esErrorDeArchivado', () => {
  it('distingue el error de archivado de los demas', () => {
    expect(esErrorDeArchivado({ message: 'EVENTO_ARCHIVADO' })).toBe(true)
    expect(esErrorDeArchivado({ message: 'EVENT_LIMIT_EXCEEDED:2:1' })).toBe(false)
    expect(esErrorDeArchivado(null)).toBe(false)
  })
})
