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
