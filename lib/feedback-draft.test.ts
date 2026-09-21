import { describe, it, expect } from 'vitest'
import { parseDraft, buildDraftRecord, DRAFT_MAX_AGE_MS } from './feedback-draft'

const now = 1_700_000_000_000
const img = (name: string) => ({ blob: new Blob(['x'], { type: 'image/png' }), name, type: 'image/png', compressed: false })

describe('parseDraft', () => {
  it('devuelve tipo, mensaje e imagenes', () => {
    const rec = buildDraftRecord({ type: 'error', message: 'la mesa no guarda', images: [img('a.png')] }, now)
    const out = parseDraft(rec, now)
    expect(out?.type).toBe('error')
    expect(out?.message).toBe('la mesa no guarda')
    expect(out?.images).toHaveLength(1)
    expect(out?.images[0].name).toBe('a.png')
  })

  it('conserva las tres imagenes', () => {
    const rec = buildDraftRecord({ type: 'nota', message: 'a', images: [img('1.png'), img('2.png'), img('3.png')] }, now)
    expect(parseDraft(rec, now)?.images).toHaveLength(3)
  })

  it('recupera un borrador de solo imagenes, sin texto', () => {
    const rec = buildDraftRecord({ type: 'error', message: '', images: [img('a.png')] }, now)
    expect(parseDraft(rec, now)?.images).toHaveLength(1)
  })

  it('no devuelve nada si no hay ni texto ni imagenes', () => {
    const rec = buildDraftRecord({ type: 'nota', message: '   ', images: [] }, now)
    expect(parseDraft(rec, now)).toBeNull()
  })

  it('no truena con basura en el almacenamiento', () => {
    expect(parseDraft(null, now)).toBeNull()
    expect(parseDraft(undefined, now)).toBeNull()
    expect(parseDraft('texto suelto', now)).toBeNull()
    expect(parseDraft([], now)).toBeNull()
  })

  it('olvida un borrador viejo en vez de resucitarlo', () => {
    const rec = buildDraftRecord({ type: 'nota', message: 'algo', images: [] }, now)
    expect(parseDraft(rec, now + DRAFT_MAX_AGE_MS + 1)).toBeNull()
  })

  it('conserva uno que apenas cabe en el limite', () => {
    const rec = buildDraftRecord({ type: 'nota', message: 'algo', images: [] }, now)
    expect(parseDraft(rec, now + DRAFT_MAX_AGE_MS)?.message).toBe('algo')
  })

  it('salva el mensaje aunque el tipo venga corrupto', () => {
    const rec = { ...buildDraftRecord({ type: 'nota', message: 'no perder esto', images: [] }, now), type: 'ninguno' }
    expect(parseDraft(rec, now)?.type).toBe('sugerencia')
  })

  it('ignora un borrador sin fecha en vez de confiar en el', () => {
    const rec = { type: 'nota', message: 'algo', images: [] }
    expect(parseDraft(rec, now)).toBeNull()
  })

  it('descarta entradas de imagen sin archivo y conserva las buenas', () => {
    const rec = buildDraftRecord({ type: 'nota', message: 'a', images: [img('ok.png')] }, now)
    const sucio = { ...rec, images: [...rec.images, { name: 'rota.png' }, null] }
    const out = parseDraft(sucio, now)
    expect(out?.images).toHaveLength(1)
    expect(out?.images[0].name).toBe('ok.png')
  })
})
