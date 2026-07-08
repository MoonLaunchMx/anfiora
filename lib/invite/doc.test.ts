import { describe, it, expect } from 'vitest'
import { emptySection, defaultDoc, resolveDoc, addSection, removeSection, moveSection, updateSectionContent, setMeta } from './doc'
import { SECTION_TYPES } from './schema'

let n = 0
const makeId = () => `id-${++n}`

describe('emptySection', () => {
  it('crea un bloque con puros defaults y el id dado', () => {
    const s = emptySection('portada', 'abc')
    expect(s).toEqual({ id: 'abc', type: 'portada', content: { kicker: '', titulo: '', subtitulo: '' } })
  })
  it('funciona para todos los tipos sin lanzar', () => {
    for (const t of SECTION_TYPES) {
      const s = emptySection(t, 't')
      expect(s.type).toBe(t)
      expect(s.id).toBe('t')
    }
  })
})

describe('defaultDoc', () => {
  it('trae los 8 bloques por defecto en orden', () => {
    const d = defaultDoc(makeId)
    expect(d.v).toBe(1)
    expect(d.meta).toEqual({ publicada: false, fecha_limite: null })
    expect(d.sections.map(s => s.type)).toEqual(
      ['portada', 'saludo', 'detalles', 'itinerario', 'dress_code', 'rsvp', 'enganche', 'cierre'],
    )
  })
})

describe('resolveDoc', () => {
  it('null/basura -> doc por defecto', () => {
    expect(resolveDoc(null, makeId).sections.length).toBe(8)
    expect(resolveDoc('x', makeId).sections.length).toBe(8)
  })
  it('descarta secciones invalidas en silencio', () => {
    const raw = {
      meta: { publicada: true, fecha_limite: '2026-03-01' },
      sections: [
        { id: 'a', type: 'portada', content: {} },
        { id: 'b', type: 'no-existe', content: {} },
        { id: 'c', type: 'saludo', content: { mensaje: 'Hola' } },
      ],
    }
    const d = resolveDoc(raw, makeId)
    expect(d.sections.map(s => s.type)).toEqual(['portada', 'saludo'])
    expect(d.meta.publicada).toBe(true)
  })
  it('rellena content parcial con defaults', () => {
    const d = resolveDoc({ sections: [{ id: 'a', type: 'saludo', content: {} }] }, makeId)
    const saludo = d.sections[0]
    expect(saludo.content).toHaveProperty('titulo')
    expect(saludo.content).toHaveProperty('mensaje')
  })
  it('deduplica ids', () => {
    const d = resolveDoc({
      sections: [
        { id: 'x', type: 'portada', content: {} },
        { id: 'x', type: 'saludo', content: {} },
      ],
    }, makeId)
    expect(d.sections.length).toBe(1)
  })
  it('meta invalida -> defaults, conservando secciones', () => {
    const d = resolveDoc({ meta: 'malo', sections: [{ id: 'a', type: 'cierre', content: {} }] }, makeId)
    expect(d.meta).toEqual({ publicada: false, fecha_limite: null })
    expect(d.sections.length).toBe(1)
  })
})
