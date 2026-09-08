import { describe, it, expect } from 'vitest'
import { COLUMNAS_LISTA, COLUMNA_SIEMPRE_VISIBLE, columnasPorDefecto, columnasValidasDesdeJSON } from './columnas-lista'

describe('columnasPorDefecto', () => {
  it('Proveedor siempre esta prendida', () => {
    expect(columnasPorDefecto().has(COLUMNA_SIEMPRE_VISIBLE)).toBe(true)
  })

  it('las nueve columnas que Diego pidio de arranque, ni una mas', () => {
    expect([...columnasPorDefecto()].sort()).toEqual(
      ['agregado', 'categoria', 'contacto', 'contratado', 'cotizado', 'desempeno', 'estatus', 'proveedor', 'telefono'].sort(),
    )
  })

  it('ciudad, pagado, partida y notas arrancan apagadas', () => {
    const defecto = columnasPorDefecto()
    for (const key of ['ciudad', 'pagado', 'partida', 'notas'] as const) {
      expect(defecto.has(key)).toBe(false)
    }
  })
})

describe('COLUMNAS_LISTA', () => {
  it('trae las trece columnas, Proveedor primero y Agregado al final', () => {
    expect(COLUMNAS_LISTA.map(c => c.key)).toEqual([
      'proveedor', 'categoria', 'estatus', 'desempeno', 'contacto', 'telefono',
      'ciudad', 'cotizado', 'contratado', 'pagado', 'partida', 'notas', 'agregado',
    ])
  })
})

describe('columnasValidasDesdeJSON', () => {
  it('un arreglo de claves reales se acepta tal cual, mas la siempre visible', () => {
    const resultado = columnasValidasDesdeJSON(['categoria', 'ciudad'])
    expect(resultado && [...resultado].sort()).toEqual(['categoria', 'ciudad', 'proveedor'].sort())
  })

  it('descarta las claves que no existen en COLUMNAS_LISTA', () => {
    const resultado = columnasValidasDesdeJSON(['categoria', 'inventada'])
    expect(resultado && [...resultado].sort()).toEqual(['categoria', 'proveedor'].sort())
  })

  it('un string en vez de un arreglo no es una forma valida, aunque JSON.parse no truene', () => {
    // JSON.parse('"abc"') da el string 'abc', y new Set('abc') seria un Set
    // valido de sus letras sin lanzar error: por eso se rechaza por forma.
    expect(columnasValidasDesdeJSON('abc')).toBeNull()
  })

  it('un numero, un objeto o null tampoco son un arreglo valido', () => {
    expect(columnasValidasDesdeJSON(42)).toBeNull()
    expect(columnasValidasDesdeJSON({ proveedor: true })).toBeNull()
    expect(columnasValidasDesdeJSON(null)).toBeNull()
  })

  it('un arreglo vacio o sin ninguna clave real no sobrevive', () => {
    expect(columnasValidasDesdeJSON([])).toBeNull()
    expect(columnasValidasDesdeJSON(['inventada', 42, null])).toBeNull()
  })
})
