import { describe, it, expect } from 'vitest'
import { planDeRestauracion, TABLA_POR_ENTIDAD, esConflictoDeLlave } from './restaurar'
import { ACCIONES_BORRADO, entidadDeAccion } from './vocabulario'
import type { FilaAudit, Movimiento } from './tipos'

function fila(over: Partial<FilaAudit>): FilaAudit {
  return {
    id: 'f1', event_id: 'ev1', user_id: 'u1',
    user_email: 'diego@anfiora.com', user_name: 'Diego Garza',
    action: 'guest.deleted', entity_type: 'guest', entity_id: 'g1',
    entity_label: 'Juan', old_value: { id: 'g1', name: 'Juan', event_id: 'ev1' },
    new_value: null, modulo: 'invitados', batch_id: 'b1',
    created_at: '2026-09-05T18:00:00.000Z',
    ...over,
  }
}

function mov(filas: FilaAudit[]): Movimiento {
  return {
    clave: 'b1', accion: filas[0].action, etiquetaAccion: 'x',
    modulo: 'invitados', persona: 'Diego Garza', personaId: 'u1',
    cuando: filas[0].created_at, esBorrado: true, batchId: 'b1',
    filas, total: filas.length, restaurado: false,
  }
}

describe('TABLA_POR_ENTIDAD', () => {
  it('cubre las diez entidades que borran los disparadores', () => {
    for (const accion of ACCIONES_BORRADO) {
      expect(TABLA_POR_ENTIDAD[entidadDeAccion(accion)], accion).toBeTruthy()
    }
  })
})

describe('planDeRestauracion', () => {
  it('respeta el orden de las filas: el padre entra primero', () => {
    const filas = [
      fila({ id: 'f1', entity_id: 'g1', entity_type: 'guest', old_value: { id: 'g1' } }),
      fila({ id: 'f2', entity_id: 'p1', entity_type: 'party_member', action: 'party_member.deleted', old_value: { id: 'p1' } }),
    ]
    const plan = planDeRestauracion(mov(filas))
    expect(plan.map(i => i.tabla)).toEqual(['guests', 'party_members'])
  })

  it('manda la accion de restauracion que le toca a cada entidad', () => {
    const plan = planDeRestauracion(mov([fila({})]))
    expect(plan[0].accionRestauracion).toBe('guest.restored')
  })

  it('inserta old_value tal cual, con su id', () => {
    const plan = planDeRestauracion(mov([fila({ old_value: { id: 'g1', name: 'Juan', event_id: 'ev1' } })]))
    expect(plan[0].fila).toEqual({ id: 'g1', name: 'Juan', event_id: 'ev1' })
  })

  it('salta las filas sin old_value: no hay nada que regresar', () => {
    expect(planDeRestauracion(mov([fila({ old_value: null })]))).toEqual([])
  })

  it('salta las filas sin entity_id: no se podrian marcar despues', () => {
    expect(planDeRestauracion(mov([fila({ entity_id: null })]))).toEqual([])
  })

  it('salta la entidad que no sabe a que tabla va', () => {
    expect(planDeRestauracion(mov([fila({ entity_type: 'marciano', action: 'marciano.deleted' })]))).toEqual([])
  })

  it('con soloEstos deja pasar unicamente los pedidos', () => {
    const filas = [
      fila({ id: 'f1', entity_id: 'g1', old_value: { id: 'g1' } }),
      fila({ id: 'f2', entity_id: 'g2', old_value: { id: 'g2' } }),
    ]
    const plan = planDeRestauracion(mov(filas), new Set(['g2']))
    expect(plan).toHaveLength(1)
    expect(plan[0].entityId).toBe('g2')
  })
})

describe('esConflictoDeLlave', () => {
  it('reconoce el choque de llave duplicada de Postgres', () => {
    expect(esConflictoDeLlave({ code: '23505' })).toBe(true)
  })

  it('no confunde otros errores', () => {
    expect(esConflictoDeLlave({ code: '42501' })).toBe(false)
    expect(esConflictoDeLlave(null)).toBe(false)
  })
})
