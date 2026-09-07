import { describe, it, expect } from 'vitest'
import { COLUMNAS_LISTA, COLUMNA_SIEMPRE_VISIBLE, columnasPorDefecto, agruparPorEstado } from './columnas-lista'

describe('columnasPorDefecto', () => {
  it('Proveedor siempre esta prendida', () => {
    expect(columnasPorDefecto().has(COLUMNA_SIEMPRE_VISIBLE)).toBe(true)
  })

  it('las ocho columnas que Diego pidio de arranque, ni una mas', () => {
    expect([...columnasPorDefecto()].sort()).toEqual(
      ['categoria', 'contacto', 'contratado', 'cotizado', 'desempeno', 'estatus', 'proveedor', 'telefono'].sort(),
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
  it('trae las doce columnas, Proveedor primero', () => {
    expect(COLUMNAS_LISTA.map(c => c.key)).toEqual([
      'proveedor', 'categoria', 'estatus', 'desempeno', 'contacto', 'telefono',
      'ciudad', 'cotizado', 'contratado', 'pagado', 'partida', 'notas',
    ])
  })
})

describe('agruparPorEstado', () => {
  const item = (status: 'nuevo' | 'cotizado' | 'contratado' | 'descartado', id: string) => ({ id, status })

  it('ordena nuevo, cotizado, contratado y deja descartado al final', () => {
    const items = [
      item('descartado', 'a'),
      item('contratado', 'b'),
      item('nuevo', 'c'),
      item('cotizado', 'd'),
    ]
    expect(agruparPorEstado(items).map(g => g.estado)).toEqual(['nuevo', 'cotizado', 'contratado', 'descartado'])
  })

  it('agrupa cada item bajo su estado', () => {
    const items = [item('nuevo', 'a'), item('nuevo', 'b'), item('contratado', 'c')]
    const grupos = agruparPorEstado(items)
    expect(grupos.find(g => g.estado === 'nuevo')?.items.map(i => i.id)).toEqual(['a', 'b'])
    expect(grupos.find(g => g.estado === 'contratado')?.items.map(i => i.id)).toEqual(['c'])
  })

  it('un estado sin proveedores no deja un grupo vacio', () => {
    const items = [item('nuevo', 'a')]
    expect(agruparPorEstado(items)).toEqual([{ estado: 'nuevo', items: [items[0]] }])
  })

  it('sin proveedores no hay grupos', () => {
    expect(agruparPorEstado([])).toEqual([])
  })
})
