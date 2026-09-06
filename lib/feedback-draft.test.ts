import { describe, it, expect } from 'vitest'
import { parseDraft, serializeDraft, DRAFT_MAX_AGE_MS } from './feedback-draft'

const now = 1_700_000_000_000

describe('parseDraft', () => {
  it('devuelve el borrador guardado', () => {
    const raw = serializeDraft({ type: 'error', message: 'la mesa no guarda' }, now)
    expect(parseDraft(raw, now)).toEqual({ type: 'error', message: 'la mesa no guarda' })
  })

  it('no devuelve nada si no hay borrador', () => {
    expect(parseDraft(null, now)).toBeNull()
    expect(parseDraft('', now)).toBeNull()
  })

  it('no truena con basura en el almacenamiento', () => {
    expect(parseDraft('{no es json', now)).toBeNull()
    expect(parseDraft('[]', now)).toBeNull()
    expect(parseDraft('"texto suelto"', now)).toBeNull()
  })

  it('ignora un borrador sin mensaje: no hay nada que recuperar', () => {
    const raw = serializeDraft({ type: 'nota', message: '   ' }, now)
    expect(parseDraft(raw, now)).toBeNull()
  })

  it('olvida un borrador viejo en vez de resucitarlo', () => {
    const raw = serializeDraft({ type: 'nota', message: 'algo' }, now)
    expect(parseDraft(raw, now + DRAFT_MAX_AGE_MS + 1)).toBeNull()
  })

  it('conserva uno que apenas cabe en el limite', () => {
    const raw = serializeDraft({ type: 'nota', message: 'algo' }, now)
    expect(parseDraft(raw, now + DRAFT_MAX_AGE_MS)?.message).toBe('algo')
  })

  it('salva el mensaje aunque el tipo venga corrupto', () => {
    const raw = JSON.stringify({ type: 'ninguno', message: 'no perder esto', savedAt: now })
    expect(parseDraft(raw, now)).toEqual({ type: 'sugerencia', message: 'no perder esto' })
  })

  it('ignora un borrador sin fecha en vez de confiar en el', () => {
    const raw = JSON.stringify({ type: 'nota', message: 'algo' })
    expect(parseDraft(raw, now)).toBeNull()
  })
})
