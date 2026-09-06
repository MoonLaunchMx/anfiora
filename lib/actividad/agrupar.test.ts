import { describe, it, expect } from 'vitest'
import { agrupar, mapaDeRestauraciones, VENTANA_MS } from './agrupar'
import type { FilaAudit } from './tipos'

let n = 0
function fila(over: Partial<FilaAudit> = {}): FilaAudit {
  n += 1
  return {
    id: 'f' + n,
    event_id: 'ev1',
    user_id: 'u1',
    user_email: 'patty@anfiora.com',
    user_name: 'Patty García',
    action: 'guest.updated',
    entity_type: 'guest',
    entity_id: 'g' + n,
    entity_label: 'Invitado ' + n,
    old_value: null,
    new_value: null,
    modulo: 'invitados',
    batch_id: null,
    created_at: '2026-09-05T18:00:00.000Z',
    ...over,
  }
}

describe('agrupar — borrados por batch_id', () => {
  it('junta en un movimiento las filas que comparten batch_id', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:02.000Z' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:01.000Z' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:00.000Z' }),
    ]
    const movs = agrupar(filas, new Map())
    expect(movs).toHaveLength(1)
    expect(movs[0].total).toBe(3)
    expect(movs[0].esBorrado).toBe(true)
    expect(movs[0].clave).toBe('b1')
  })

  it('no junta batch_id distintos aunque sean del mismo segundo', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1' }),
      fila({ action: 'guest.deleted', batch_id: 'b2' }),
    ]
    expect(agrupar(filas, new Map())).toHaveLength(2)
  })

  it('deja las filas del lote en created_at descendente, que es el orden de restauracion', () => {
    const filas = [
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:00.000Z', entity_label: 'hijo' }),
      fila({ action: 'guest.deleted', batch_id: 'b1', created_at: '2026-09-05T18:00:02.000Z', entity_label: 'padre' }),
    ]
    const [mov] = agrupar(filas, new Map())
    expect(mov.filas.map(f => f.entity_label)).toEqual(['padre', 'hijo'])
  })
})

describe('agrupar — ediciones por persona, accion, modulo y cercania', () => {
  it('junta ediciones de la misma persona dentro de la ventana', () => {
    const base = new Date('2026-09-05T18:00:00.000Z').getTime()
    const filas = [
      fila({ created_at: new Date(base).toISOString() }),
      fila({ created_at: new Date(base + 60_000).toISOString() }),
      fila({ created_at: new Date(base + 120_000).toISOString() }),
    ]
    const movs = agrupar(filas, new Map())
    expect(movs).toHaveLength(1)
    expect(movs[0].total).toBe(3)
    expect(movs[0].esBorrado).toBe(false)
  })

  it('corta el grupo cuando el hueco pasa la ventana', () => {
    const base = new Date('2026-09-05T18:00:00.000Z').getTime()
    const filas = [
      fila({ created_at: new Date(base).toISOString() }),
      fila({ created_at: new Date(base + VENTANA_MS + 1000).toISOString() }),
    ]
    expect(agrupar(filas, new Map())).toHaveLength(2)
  })

  it('no junta a dos personas distintas aunque coincidan en todo lo demas', () => {
    const filas = [
      fila({ user_id: 'u1', user_name: 'Patty García' }),
      fila({ user_id: 'u2', user_name: 'Frida Gamboa' }),
    ]
    expect(agrupar(filas, new Map())).toHaveLength(2)
  })

  it('no junta acciones distintas de la misma persona', () => {
    const filas = [
      fila({ action: 'guest.updated' }),
      fila({ action: 'guest.rsvp_updated' }),
    ]
    expect(agrupar(filas, new Map())).toHaveLength(2)
  })
})

describe('agrupar — restaurado', () => {
  const BORRADO = '2026-09-05T18:00:00.000Z'
  const DESPUES = new Date('2026-09-05T19:00:00.000Z').getTime()
  const ANTES   = new Date('2026-09-05T17:00:00.000Z').getTime()

  const dosBorrados = () => [
    fila({ action: 'guest.deleted', batch_id: 'b1', entity_id: 'g1', created_at: BORRADO }),
    fila({ action: 'guest.deleted', batch_id: 'b1', entity_id: 'g2', created_at: BORRADO }),
  ]

  it('marca el movimiento cuando todas volvieron DESPUES de este borrado', () => {
    const mapa = new Map([['g1', DESPUES], ['g2', DESPUES]])
    expect(agrupar(dosBorrados(), mapa)[0].restaurado).toBe(true)
  })

  it('no lo marca si falta una', () => {
    expect(agrupar(dosBorrados(), new Map([['g1', DESPUES]]))[0].restaurado).toBe(false)
  })

  // El bug del 6-sep: Diego restauro 42 invitados y los volvio a borrar. Como
  // la marca de restauracion no miraba el reloj, el borrado NUEVO heredaba el
  // "Restaurado" del anterior y se quedaba sin boton para deshacerlo.
  it('una restauracion ANTERIOR al borrado no cuenta: se borro otra vez', () => {
    const mapa = new Map([['g1', ANTES], ['g2', ANTES]])
    expect(agrupar(dosBorrados(), mapa)[0].restaurado).toBe(false)
  })

  it('sin ninguna restauracion no marca nada', () => {
    expect(agrupar(dosBorrados(), new Map())[0].restaurado).toBe(false)
  })
})

describe('mapaDeRestauraciones', () => {
  it('se queda con la restauracion MAS RECIENTE de cada entidad', () => {
    const m = mapaDeRestauraciones([
      fila({ action: 'guest.restored', entity_id: 'g1', created_at: '2026-09-05T10:00:00.000Z' }),
      fila({ action: 'guest.restored', entity_id: 'g1', created_at: '2026-09-05T20:00:00.000Z' }),
    ])
    expect(m.get('g1')).toBe(new Date('2026-09-05T20:00:00.000Z').getTime())
  })

  it('ignora lo que no es una restauracion', () => {
    const m = mapaDeRestauraciones([fila({ action: 'guest.deleted', entity_id: 'g1' })])
    expect(m.has('g1')).toBe(false)
  })
})

describe('agrupar — forma de salida', () => {
  it('ordena los movimientos del mas reciente al mas viejo', () => {
    const filas = [
      fila({ action: 'table.deleted', batch_id: 'viejo', created_at: '2026-09-01T10:00:00.000Z' }),
      fila({ action: 'table.deleted', batch_id: 'nuevo', created_at: '2026-09-05T10:00:00.000Z' }),
    ]
    expect(agrupar(filas, new Map()).map(m => m.clave)).toEqual(['nuevo', 'viejo'])
  })

  it('usa el correo cuando no hay nombre', () => {
    const [mov] = agrupar([fila({ user_name: null })], new Map())
    expect(mov.persona).toBe('patty@anfiora.com')
  })

  it('cae en la accion cruda cuando no hay etiqueta', () => {
    const [mov] = agrupar([fila({ action: 'cosa.rara' })], new Map())
    expect(mov.etiquetaAccion).toBe('cosa.rara')
  })

  it('tira el modulo que no es de los doce', () => {
    const [mov] = agrupar([fila({ modulo: 'inventado' })], new Map())
    expect(mov.modulo).toBeNull()
  })

  it('con la lista vacia devuelve lista vacia', () => {
    expect(agrupar([], new Map())).toEqual([])
  })
})

// La restauracion NO es un movimiento: es la contraparte del borrado que ya
// esta en la lista. Si se dibujara aparte, restaurar duplicaria el renglon
// —una vez el borrado marcado "Restaurado" y otra la restauracion misma—.
// Las filas se siguen guardando en la base; aqui solo no se pintan.
describe('agrupar — las restauraciones no son renglones', () => {
  it('no dibuja un movimiento por la restauracion', () => {
    const movs = agrupar([
      fila({ action: 'guest.deleted',  batch_id: 'b1', entity_id: 'g1', created_at: '2026-09-05T18:00:00.000Z' }),
      fila({ action: 'guest.restored',                 entity_id: 'g1', created_at: '2026-09-05T19:00:00.000Z' }),
    ], new Map([['g1', new Date('2026-09-05T19:00:00.000Z').getTime()]]))

    expect(movs).toHaveLength(1)
    expect(movs[0].accion).toBe('guest.deleted')
    expect(movs[0].restaurado).toBe(true)
  })

  it('con puras restauraciones no hay nada que mostrar', () => {
    expect(agrupar([fila({ action: 'table.restored' })], new Map())).toEqual([])
  })
})
