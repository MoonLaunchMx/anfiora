import { describe, it, expect } from 'vitest'
import { planDeRestauracion, TABLA_POR_ENTIDAD, esConflictoDeLlave, tandasPorTabla, arrastrados, insercionDeFila, type Insercion } from './restaurar'
import { ACCIONES_BORRADO, entidadDeAccion } from './vocabulario'
import type { FilaAudit, Movimiento, Restauracion } from './tipos'

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
    filas, total: filas.length, principales: filas.length, dependientes: 0, arrastreTexto: null,
    restaurado: false, restauracion: null,
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

describe('tandasPorTabla', () => {
  const ins = (tabla: string, entityId: string): Insercion => ({
    tabla, fila: { id: entityId }, entityId, accionRestauracion: 'x.restored',
  })

  it('sin nada devuelve nada', () => {
    expect(tandasPorTabla([])).toEqual([])
  })

  it('junta en una sola tanda las inserciones seguidas de la misma tabla', () => {
    const t = tandasPorTabla([ins('guests', 'g1'), ins('guests', 'g2'), ins('guests', 'g3')])
    expect(t).toHaveLength(1)
    expect(t[0]).toHaveLength(3)
  })

  it('CORTA cuando cambia de tabla: el padre entra antes que el hijo', () => {
    const t = tandasPorTabla([
      ins('guests', 'g1'), ins('guests', 'g2'),
      ins('party_members', 'p1'),
    ])
    expect(t.map(x => x[0].tabla)).toEqual(['guests', 'party_members'])
    expect(t[0]).toHaveLength(2)
    expect(t[1]).toHaveLength(1)
  })

  it('NO reordena para juntar tablas separadas, o se rompe la dependencia', () => {
    const t = tandasPorTabla([
      ins('guests', 'g1'), ins('party_members', 'p1'), ins('guests', 'g2'),
    ])
    expect(t.map(x => x[0].tabla)).toEqual(['guests', 'party_members', 'guests'])
  })

  it('conserva todas las inserciones', () => {
    const plan = [ins('guests', 'g1'), ins('party_members', 'p1'), ins('tables', 't1')]
    expect(tandasPorTabla(plan).flat()).toEqual(plan)
  })
})

// Diego, 6-sep: "que pasa si quitas a 20 personas con acompanantes y el planner
// no ve a sus acompanantes?" — restauraba a los 20 invitados, los veia de vuelta
// y daba por terminado, pero cada uno habia perdido a los suyos. La app borra a
// los acompanantes en su propia transaccion, asi que caen en otro lote.
describe('arrastrados', () => {
  const RESTAURADOS = new Map<string, Restauracion>()

  const borradoInvitado = (id: string) =>
    fila({ id: 'a' + id, action: 'guest.deleted', entity_type: 'guest', entity_id: id, old_value: { id } })

  const borradoAcompanante = (id: string, deQuien: string) =>
    fila({
      id: 'b' + id, action: 'party_member.deleted', entity_type: 'party_member',
      entity_id: id, entity_label: 'Acompanante ' + id,
      old_value: { id, guest_id: deQuien },
    })

  const planDe = (ids: string[]) => planDeRestauracion(mov(ids.map(borradoInvitado)))

  it('encuentra a los acompanantes de los invitados que se estan restaurando', () => {
    const filas = [borradoAcompanante('p1', 'g1'), borradoAcompanante('p2', 'g1')]
    const out = arrastrados(planDe(['g1']), filas, RESTAURADOS)
    expect(out.map(f => f.entity_id)).toEqual(['p1', 'p2'])
  })

  it('ignora a los acompanantes de OTROS invitados', () => {
    const filas = [borradoAcompanante('p1', 'g1'), borradoAcompanante('p9', 'gOtro')]
    expect(arrastrados(planDe(['g1']), filas, RESTAURADOS).map(f => f.entity_id)).toEqual(['p1'])
  })

  it('no arrastra al que ya volvio', () => {
    const filas = [borradoAcompanante('p1', 'g1')]
    const yaVolvio = new Map<string, Restauracion>([
      ['p1', { cuando: Date.parse('2026-09-05T19:00:00.000Z'), fecha: '2026-09-05T19:00:00.000Z', persona: 'Diego' }],
    ])
    expect(arrastrados(planDe(['g1']), filas, yaVolvio)).toEqual([])
  })

  it('sin acompanantes no arrastra nada', () => {
    expect(arrastrados(planDe(['g1']), [], RESTAURADOS)).toEqual([])
  })

  it('insercionDeFila convierte el arrastre en algo insertable', () => {
    const i = insercionDeFila(borradoAcompanante('p1', 'g1'))
    expect(i?.tabla).toBe('party_members')
    expect(i?.accionRestauracion).toBe('party_member.restored')
    expect(i?.entityId).toBe('p1')
  })
})
