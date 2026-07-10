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
  it('trae los 9 bloques por defecto en orden', () => {
    const d = defaultDoc(makeId)
    expect(d.v).toBe(2)
    expect(d.meta).toEqual({ publicada: false, fecha_limite: null })
    expect(d.sections.map(s => s.type)).toEqual(
      ['portada', 'saludo', 'detalles', 'itinerario', 'dress_code', 'rsvp', 'playlist', 'mesa', 'cierre'],
    )
  })
})

describe('resolveDoc', () => {
  it('null/basura -> doc por defecto', () => {
    expect(resolveDoc(null, makeId).sections.length).toBe(9)
    expect(resolveDoc('x', makeId).sections.length).toBe(9)
  })
  it('migra bloque enganche viejo a playlist + mesa segun toggles', () => {
    const raw = {
      sections: [
        { id: 'a', type: 'portada', content: {} },
        { id: 'b', type: 'enganche', content: { mostrar_playlist: true, mostrar_mesa: true } },
        { id: 'c', type: 'cierre', content: {} },
      ],
    }
    expect(resolveDoc(raw, makeId).sections.map(s => s.type)).toEqual(['portada', 'playlist', 'mesa', 'cierre'])

    const soloPlaylist = {
      sections: [{ id: 'b', type: 'enganche', content: { mostrar_playlist: true, mostrar_mesa: false } }],
    }
    expect(resolveDoc(soloPlaylist, makeId).sections.map(s => s.type)).toEqual(['playlist'])
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

const base = () => defaultDoc(makeId)

describe('resolveDoc theme migration', () => {
  let n = 0
  const makeId = () => `id-${n++}`

  it('defaultDoc includes the default theme and v2', () => {
    const d = defaultDoc(makeId)
    expect(d.v).toBe(2)
    expect(d.theme.vibeId).toBe('anfiora-claro')
  })

  it('a v1 doc without theme resolves to the default theme, keeping sections', () => {
    const v1 = { v: 1, meta: { publicada: true, fecha_limite: null }, sections: [
      { id: 'a', type: 'portada', content: { kicker: '', titulo: 'Ana', subtitulo: '' } },
    ] }
    const d = resolveDoc(v1, makeId)
    expect(d.theme.vibeId).toBe('anfiora-claro')
    expect(d.sections.find(s => s.type === 'portada')).toBeTruthy()
    expect(d.meta.publicada).toBe(true)
  })

  it('preserves a valid custom theme', () => {
    const doc = { v: 2, meta: { publicada: false, fecha_limite: null }, theme: { vibeId: 'fiesta', colores: { fondo: '#000000', texto: '#fff', acento: '#ffe600', botonBg: '#ffe600', botonTexto: '#000' }, boton: { forma: 'pill', estilo: 'elevado' } }, sections: [
      { id: 'a', type: 'portada', content: { kicker: '', titulo: 'X', subtitulo: '' } },
    ] }
    const d = resolveDoc(doc, makeId)
    expect(d.theme.vibeId).toBe('fiesta')
    expect(d.theme.colores.fondo).toBe('#000000')
  })
})

describe('ops de array', () => {
  it('addSection agrega al final sin mutar', () => {
    const d0 = base()
    const len = d0.sections.length
    const d1 = addSection(d0, 'texto', makeId)
    expect(d1.sections.length).toBe(len + 1)
    expect(d1.sections.at(-1)!.type).toBe('texto')
    expect(d0.sections.length).toBe(len) // no mutado
  })
  it('removeSection quita por id', () => {
    const d0 = base()
    const id = d0.sections[0].id
    const d1 = removeSection(d0, id)
    expect(d1.sections.find(s => s.id === id)).toBeUndefined()
  })
  it('moveSection reubica por indice y hace clamp', () => {
    const d0 = base()
    const id = d0.sections[0].id
    const d1 = moveSection(d0, id, 3)
    expect(d1.sections[3].id).toBe(id)
    const d2 = moveSection(d0, id, 999)
    expect(d2.sections.at(-1)!.id).toBe(id)
  })
  it('updateSectionContent hace merge del patch', () => {
    const d0 = base()
    const s = d0.sections.find(x => x.type === 'saludo')!
    const d1 = updateSectionContent(d0, s.id, { mensaje: 'Nuevo' })
    const s1 = d1.sections.find(x => x.id === s.id)!
    expect((s1.content as any).mensaje).toBe('Nuevo')
    expect((s1.content as any).titulo).toBeDefined()
  })
  it('setMeta hace merge', () => {
    const d1 = setMeta(base(), { publicada: true })
    expect(d1.meta.publicada).toBe(true)
    expect(d1.meta.fecha_limite).toBeNull()
  })
})
