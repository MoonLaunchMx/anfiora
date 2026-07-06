import { describe, it, expect } from 'vitest'
import {
  defaultDressCode,
  parseDressCode,
  isDressCodeConfigured,
  resolveNivelLabel,
  buildDressCodeText,
  type DressCode,
} from './dresscode'

describe('defaultDressCode', () => {
  it('devuelve un objeto vacio valido', () => {
    const dc = defaultDressCode()
    expect(dc.nivel).toBeNull()
    expect(dc.colores_sugeridos).toEqual([])
    expect(dc.recomendaciones).toEqual([])
    expect(dc.nota_libre).toBe('')
    expect(dc.fotos_ejemplo).toEqual([])
  })
})

describe('parseDressCode', () => {
  it('null o undefined -> default', () => {
    expect(parseDressCode(null)).toEqual(defaultDressCode())
    expect(parseDressCode(undefined)).toEqual(defaultDressCode())
  })

  it('normaliza campos faltantes', () => {
    const dc = parseDressCode({ nivel: 'coctel' })
    expect(dc.nivel).toBe('coctel')
    expect(dc.colores_sugeridos).toEqual([])
    expect(dc.nota_libre).toBe('')
  })

  it('descarta nivel invalido a null', () => {
    expect(parseDressCode({ nivel: 'space-suit' }).nivel).toBeNull()
  })

  it('filtra colores con hex invalido', () => {
    const dc = parseDressCode({
      colores_sugeridos: [
        { hex: '#3A5A40', nombre: 'Salvia' },
        { hex: 'nope', nombre: 'Malo' },
        { hex: '#FFF', nombre: 'Corto' },
      ],
    })
    expect(dc.colores_sugeridos.map(c => c.hex)).toEqual(['#3A5A40', '#FFF'])
  })

  it('recorta fotos_ejemplo a 3', () => {
    const dc = parseDressCode({ fotos_ejemplo: ['a', 'b', 'c', 'd', 'e'] })
    expect(dc.fotos_ejemplo).toHaveLength(3)
  })
})

describe('isDressCodeConfigured', () => {
  it('default -> false', () => {
    expect(isDressCodeConfigured(defaultDressCode())).toBe(false)
  })
  it('con nivel -> true', () => {
    expect(isDressCodeConfigured({ ...defaultDressCode(), nivel: 'formal' })).toBe(true)
  })
  it('solo nota libre con espacios -> false', () => {
    expect(isDressCodeConfigured({ ...defaultDressCode(), nota_libre: '   ' })).toBe(false)
  })
})

describe('resolveNivelLabel', () => {
  it('mapea id a etiqueta legible', () => {
    expect(resolveNivelLabel({ ...defaultDressCode(), nivel: 'coctel' })).toBe('Cóctel')
  })
  it('tematico usa nivel_custom', () => {
    expect(resolveNivelLabel({ ...defaultDressCode(), nivel: 'tematico', nivel_custom: 'Años 20' })).toBe('Años 20')
  })
  it('sin nivel -> null', () => {
    expect(resolveNivelLabel(defaultDressCode())).toBeNull()
  })
})

describe('buildDressCodeText', () => {
  it('arma texto con secciones presentes', () => {
    const dc: DressCode = {
      ...defaultDressCode(),
      nivel: 'coctel',
      colores_sugeridos: [{ hex: '#3A5A40', nombre: 'Salvia' }, { hex: '#DAD7CD', nombre: 'Arena' }],
      colores_evitar: [{ hex: '#FFFFFF', nombre: 'Blanco' }],
      recomendaciones: ['Tacón bajo, es jardín'],
    }
    const txt = buildDressCodeText(dc, { eventName: 'Boda Ana & Luis' })
    expect(txt).toContain('Boda Ana & Luis')
    expect(txt).toContain('Cóctel')
    expect(txt).toContain('Salvia')
    expect(txt).toContain('Arena')
    expect(txt).toContain('Blanco')
    expect(txt).toContain('Tacón bajo, es jardín')
  })

  it('omite secciones vacias', () => {
    const txt = buildDressCodeText({ ...defaultDressCode(), nivel: 'formal' })
    expect(txt).toContain('Formal')
    expect(txt).not.toContain('Colores sugeridos')
    expect(txt).not.toContain('Evita')
  })
})
