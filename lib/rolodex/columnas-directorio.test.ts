import { describe, it, expect } from 'vitest'
import {
  COLUMNAS_DIRECTORIO,
  COLUMNA_DIRECTORIO_SIEMPRE,
  columnasDirectorioPorDefecto,
  columnasDirectorioDesdeJSON,
} from './columnas-directorio'

describe('columnasDirectorioPorDefecto', () => {
  it('arranca con seis, para no abrumar', () => {
    const d = columnasDirectorioPorDefecto()
    expect(d.size).toBe(6)
    expect([...d]).toEqual(['proveedor', 'categoria', 'eventos', 'cierre', 'planner', 'ultima'])
  })

  it('las otras tres existen en el catalogo, apagadas', () => {
    const d = columnasDirectorioPorDefecto()
    for (const k of ['ahorro', 'cliente', 'rango'] as const) {
      expect(COLUMNAS_DIRECTORIO.some(c => c.key === k)).toBe(true)
      expect(d.has(k)).toBe(false)
    }
  })

  it('devuelve un Set nuevo cada vez, para que nadie ensucie el de al lado', () => {
    const a = columnasDirectorioPorDefecto()
    a.delete('categoria')
    expect(columnasDirectorioPorDefecto().has('categoria')).toBe(true)
  })

  it('el catalogo no repite claves ni etiquetas', () => {
    expect(new Set(COLUMNAS_DIRECTORIO.map(c => c.key)).size).toBe(COLUMNAS_DIRECTORIO.length)
    expect(new Set(COLUMNAS_DIRECTORIO.map(c => c.label)).size).toBe(COLUMNAS_DIRECTORIO.length)
  })
})

describe('columnasDirectorioDesdeJSON', () => {
  it('acepta una lista de claves validas', () => {
    expect([...columnasDirectorioDesdeJSON(['proveedor', 'ahorro'])!]).toEqual(['proveedor', 'ahorro'])
  })

  it('siempre devuelve la columna fija, aunque no venga guardada', () => {
    expect(columnasDirectorioDesdeJSON(['ahorro'])!.has(COLUMNA_DIRECTORIO_SIEMPRE)).toBe(true)
  })

  it('tira lo que no es una columna', () => {
    expect([...columnasDirectorioDesdeJSON(['ahorro', 'inventada', 7])!]).toEqual(['ahorro', 'proveedor'])
  })

  it('devuelve null cuando lo guardado no sirve, para caer en las de siempre', () => {
    expect(columnasDirectorioDesdeJSON('proveedor')).toBeNull()
    expect(columnasDirectorioDesdeJSON(null)).toBeNull()
    expect(columnasDirectorioDesdeJSON({ a: 1 })).toBeNull()
    expect(columnasDirectorioDesdeJSON([])).toBeNull()
    expect(columnasDirectorioDesdeJSON(['nada', 'de', 'esto'])).toBeNull()
  })
})
