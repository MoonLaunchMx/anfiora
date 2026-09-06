import { describe, it, expect } from 'vitest'
import {
  AUDIT_ACTION_LABEL, ACCIONES_BORRADO, ACCIONES_RESTAURACION,
  entidadDeAccion, esBorrado,
  type AuditAction,
} from './vocabulario'

// Los diez disparadores que corren hoy en produccion, con el nombre exacto
// que escriben. Fuente: docs/superpowers/plans/sql/2026-09-0*.sql
const DISPARADORES: AuditAction[] = [
  'timeline_task.deleted', 'itinerary_moment.deleted', 'budget.deleted',
  'event_supplier.deleted', 'payment.deleted', 'guest.deleted',
  'party_member.deleted', 'table.deleted', 'gift_item.deleted', 'song.deleted',
]

describe('AUDIT_ACTION_LABEL', () => {
  it('tiene etiqueta para toda accion de disparador', () => {
    for (const a of DISPARADORES) {
      expect(AUDIT_ACTION_LABEL[a], a).toBeTruthy()
    }
  })

  it('no deja ninguna accion sin etiqueta', () => {
    for (const [accion, label] of Object.entries(AUDIT_ACTION_LABEL)) {
      expect(label.trim(), accion).not.toBe('')
    }
  })
})

describe('ACCIONES_BORRADO', () => {
  it('contiene los diez disparadores y nada mas', () => {
    expect([...ACCIONES_BORRADO].sort()).toEqual([...DISPARADORES].sort())
  })

  it('esBorrado reconoce solo los borrados', () => {
    expect(esBorrado('guest.deleted')).toBe(true)
    expect(esBorrado('guest.updated')).toBe(false)
    expect(esBorrado('guest.restored')).toBe(false)
  })
})

describe('ACCIONES_RESTAURACION', () => {
  it('hay una restauracion por cada borrado', () => {
    expect(ACCIONES_RESTAURACION.length).toBe(ACCIONES_BORRADO.length)
    for (const b of ACCIONES_BORRADO) {
      const r = b.replace('.deleted', '.restored') as AuditAction
      expect(ACCIONES_RESTAURACION).toContain(r)
    }
  })
})

describe('entidadDeAccion', () => {
  it('parte la accion en su entidad', () => {
    expect(entidadDeAccion('event_supplier.deleted')).toBe('event_supplier')
    expect(entidadDeAccion('guest.restored')).toBe('guest')
  })
})
