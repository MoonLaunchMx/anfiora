import { describe, it, expect } from 'vitest'
import {
  AUDIT_ACTION_LABEL, ACCIONES_BORRADO, ACCIONES_RESTAURACION,
  entidadDeAccion, esBorrado, moduloDeEntidad, MODULO_POR_ENTIDAD, ENTIDADES_AUDITABLES,
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

// El modulo NO se le pide a cada llamada: se deriva de la entidad, igual que
// lo hace log_borrado() en Postgres. Asi la bitacora dice lo mismo venga de
// donde venga, y no depende de que alguien se acuerde de pasarlo.
//
// Sin esto, logAction() escribia modulo = null y la pantalla mandaba TODA
// edicion a "Equipo": confirmar un invitado, editarlo, cambiar la
// configuracion. Se verifico en produccion: 89 filas de edicion, todas null.
describe('moduloDeEntidad', () => {
  // Fuente: el segundo y primer argumento de log_borrado() en los .sql del
  // Tramo 3. Si la pantalla y el disparador no coinciden, el mismo objeto sale
  // en dos herramientas distintas segun quien escribio la fila.
  const COMO_EN_POSTGRES: [string, string][] = [
    ['guest', 'invitados'],
    ['party_member', 'invitados'],
    ['table', 'mesas'],
    ['song', 'playlist'],
    ['budget', 'presupuesto'],
    ['event_supplier', 'proveedores'],
    ['gift_item', 'regalos'],
    ['itinerary_moment', 'timeline'],
    ['timeline_task', 'timeline'],
    ['payment', 'pagos'],
  ]

  it('coincide con lo que escriben los disparadores', () => {
    for (const [entidad, modulo] of COMO_EN_POSTGRES) {
      expect(moduloDeEntidad(entidad), entidad).toBe(modulo)
    }
  })

  it('lo que no es de una herramienta se queda sin modulo: eso SI es Equipo', () => {
    expect(moduloDeEntidad('collaborator')).toBeNull()
    expect(moduloDeEntidad('settings')).toBeNull()
    expect(moduloDeEntidad('event')).toBeNull()
  })

  it('una entidad desconocida no se inventa una herramienta', () => {
    expect(moduloDeEntidad('marciano')).toBeNull()
    expect(moduloDeEntidad(null)).toBeNull()
  })

  it('cubre todas las entidades que el codigo puede escribir', () => {
    const sinMapear = ENTIDADES_AUDITABLES.filter(e => !(e in MODULO_POR_ENTIDAD))
    expect(sinMapear, 'faltan en MODULO_POR_ENTIDAD').toEqual([])
  })
})
