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
  const DESPUES = { cuando: new Date('2026-09-05T19:00:00.000Z').getTime(), fecha: '2026-09-05T19:00:00.000Z', persona: 'Diego Garza' }
  const ANTES   = { cuando: new Date('2026-09-05T17:00:00.000Z').getTime(), fecha: '2026-09-05T17:00:00.000Z', persona: 'Diego Garza' }

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

  it('dice QUIEN lo trajo de vuelta y CUANDO', () => {
    const mapa = new Map([
      ['g1', { cuando: new Date('2026-09-05T19:00:00.000Z').getTime(), fecha: '2026-09-05T19:00:00.000Z', persona: 'Frida Gamboa' }],
      ['g2', { cuando: new Date('2026-09-05T19:30:00.000Z').getTime(), fecha: '2026-09-05T19:30:00.000Z', persona: 'Frida Gamboa' }],
    ])
    const [mov] = agrupar(dosBorrados(), mapa)
    expect(mov.restauracion?.persona).toBe('Frida Gamboa')
    // La mas reciente: es la que cierra la historia del lote.
    expect(mov.restauracion?.cuando).toBe('2026-09-05T19:30:00.000Z')
  })

  it('lo que sigue borrado no trae dato de restauracion', () => {
    expect(agrupar(dosBorrados(), new Map())[0].restauracion).toBeNull()
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
    expect(m.get('g1')?.cuando).toBe(new Date('2026-09-05T20:00:00.000Z').getTime())
    expect(m.get('g1')?.persona).toBe('Patty García')
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
    ], new Map([['g1', { cuando: new Date('2026-09-05T19:00:00.000Z').getTime(), fecha: '2026-09-05T19:00:00.000Z', persona: 'Diego Garza' }]]))

    expect(movs).toHaveLength(1)
    expect(movs[0].accion).toBe('guest.deleted')
    expect(movs[0].restaurado).toBe(true)
  })

  it('con puras restauraciones no hay nada que mostrar', () => {
    expect(agrupar([fila({ action: 'table.restored' })], new Map())).toEqual([])
  })
})

// Diego, 6-sep: "me divides en dos cuando un invitado con acompanantes es
// eliminado, no se supone que deben de venir en una sola linea?". La app borra
// a los acompanantes en su propia transaccion, asi que llegan con otro
// batch_id. Se juntan siguiendo el guest_id, no la hora.
describe('agrupar — el invitado y sus acompanantes son UN renglon', () => {
  const invitado = (id: string, cuando: string) =>
    fila({ action: 'guest.deleted', entity_type: 'guest', entity_id: id,
           entity_label: 'Alejandra', batch_id: 'lote-invitado', created_at: cuando,
           old_value: { id } })

  const acompanante = (id: string, deQuien: string, cuando: string) =>
    fila({ action: 'party_member.deleted', entity_type: 'party_member', entity_id: id,
           entity_label: 'Acomp ' + id, batch_id: 'lote-acompanantes', created_at: cuando,
           old_value: { id, guest_id: deQuien } })

  const escena = () => [
    acompanante('p1', 'g1', '2026-09-05T18:00:01.000Z'),
    acompanante('p2', 'g1', '2026-09-05T18:00:01.000Z'),
    invitado('g1', '2026-09-05T18:00:03.000Z'),
  ]

  it('los junta en un solo movimiento aunque tengan lotes distintos', () => {
    const movs = agrupar(escena(), new Map())
    expect(movs).toHaveLength(1)
    expect(movs[0].total).toBe(3)
  })

  it('el renglon se llama como el invitado, no como el acompanante', () => {
    const [mov] = agrupar(escena(), new Map())
    expect(mov.accion).toBe('guest.deleted')
    expect(mov.filas[0].entity_label).toBe('Alejandra')
  })

  it('separa cuantos son principales y cuantos van colgando', () => {
    const [mov] = agrupar(escena(), new Map())
    expect(mov.principales).toBe(1)
    expect(mov.dependientes).toBe(2)
  })

  it('el acompanante de OTRO invitado no se cuela', () => {
    const filas = [...escena(), acompanante('p9', 'gOtro', '2026-09-05T18:00:01.000Z')]
    const movs = agrupar(filas, new Map())
    expect(movs).toHaveLength(2)
    expect(movs.find(m => m.total === 3)).toBeTruthy()
  })

  it('si su invitado no esta en la bitacora, el acompanante va solo', () => {
    const movs = agrupar([acompanante('p1', 'gDesconocido', '2026-09-05T18:00:01.000Z')], new Map())
    expect(movs).toHaveLength(1)
    expect(movs[0].principales).toBe(1)
    expect(movs[0].dependientes).toBe(0)
  })
})
