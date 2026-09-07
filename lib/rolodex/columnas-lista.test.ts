import { describe, it, expect } from 'vitest'
import { COLUMNAS_LISTA, COLUMNA_SIEMPRE_VISIBLE, columnasPorDefecto } from './columnas-lista'

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
