import { describe, it, expect } from 'vitest'
import { formatearInline, DOCUMENTOS_LEGALES, documentoLegal } from './legal-textos'
import { LEGAL_EMAIL } from './legal'

describe('formatearInline', () => {
  it('deja el texto plano en un solo trozo', () => {
    expect(formatearInline('hola mundo')).toEqual([{ negrita: false, texto: 'hola mundo' }])
  })

  it('separa una negrita en medio', () => {
    expect(formatearInline('antes **fuerte** despues')).toEqual([
      { negrita: false, texto: 'antes ' },
      { negrita: true, texto: 'fuerte' },
      { negrita: false, texto: ' despues' },
    ])
  })

  it('soporta varias negritas', () => {
    expect(formatearInline('**a** y **b**')).toEqual([
      { negrita: true, texto: 'a' },
      { negrita: false, texto: ' y ' },
      { negrita: true, texto: 'b' },
    ])
  })

  it('un asterisco sin cerrar se queda como texto', () => {
    expect(formatearInline('roto **sin cierre')).toEqual([{ negrita: false, texto: 'roto **sin cierre' }])
  })

  it('no inventa trozos vacios', () => {
    expect(formatearInline('**solo**')).toEqual([{ negrita: true, texto: 'solo' }])
  })

  it('el texto vacio no produce trozos', () => {
    expect(formatearInline('')).toEqual([])
  })
})

describe('documentos legales', () => {
  it('son tres y cada uno tiene ruta propia', () => {
    const rutas = DOCUMENTOS_LEGALES.map(d => d.ruta)
    expect(rutas).toEqual(['/privacidad', '/terminos', '/eliminar-datos'])
  })

  it('ninguna seccion se queda sin id ni repite id dentro del documento', () => {
    for (const doc of DOCUMENTOS_LEGALES) {
      const ids = doc.secciones.map(s => s.id)
      expect(ids.every(Boolean)).toBe(true)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('ninguna seccion se queda sin bloques', () => {
    for (const doc of DOCUMENTOS_LEGALES) {
      for (const sec of doc.secciones) {
        expect(sec.bloques.length).toBeGreaterThan(0)
      }
    }
  })

  it('las tablas traen el mismo numero de columnas que de encabezados', () => {
    for (const doc of DOCUMENTOS_LEGALES) {
      for (const sec of doc.secciones) {
        for (const bloque of sec.bloques) {
          if (bloque.tipo !== 'tabla') continue
          for (const fila of bloque.filas) {
            expect(fila.length).toBe(bloque.encabezados.length)
          }
        }
      }
    }
  })

  it('el unico correo que aparece en los textos es el buzon legal', () => {
    const correos = new Set<string>()
    for (const doc of DOCUMENTOS_LEGALES) {
      const crudo = JSON.stringify(doc)
      for (const m of crudo.matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)) correos.add(m[0])
    }
    expect([...correos]).toEqual([LEGAL_EMAIL])
  })

  it('las negritas siempre vienen en pares', () => {
    for (const doc of DOCUMENTOS_LEGALES) {
      const asteriscos = (JSON.stringify(doc).match(/\*\*/g) || []).length
      expect(asteriscos % 2).toBe(0)
    }
  })

  it('no hay comas antes de y, o ni ni: es la regla de copy de Diego', () => {
    for (const doc of DOCUMENTOS_LEGALES) {
      for (const sec of doc.secciones) {
        for (const bloque of sec.bloques) {
          const textos = bloque.tipo === 'lista' ? bloque.items
            : bloque.tipo === 'tabla' ? bloque.filas.flat()
            : [bloque.texto]
          for (const t of textos) expect(t).not.toMatch(/, (y|o|ni) /)
        }
      }
      for (const linea of doc.enCorto ?? []) expect(linea).not.toMatch(/, (y|o|ni) /)
      for (const paso of doc.pasos ?? []) expect(paso.detalle).not.toMatch(/, (y|o|ni) /)
    }
  })

  it('solo el aviso trae el resumen En corto, con cinco lineas', () => {
    expect(documentoLegal('privacidad').enCorto).toHaveLength(5)
    expect(documentoLegal('terminos').enCorto).toBeUndefined()
    expect(documentoLegal('eliminar').enCorto).toBeUndefined()
  })

  it('documentoLegal encuentra por clave y truena con una desconocida', () => {
    expect(documentoLegal('terminos').titulo).toBe('Términos y Condiciones')
    // @ts-expect-error clave invalida a proposito
    expect(() => documentoLegal('inventada')).toThrow()
  })
})
