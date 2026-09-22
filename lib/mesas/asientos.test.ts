import { describe, it, expect } from 'vitest'
import { personasDe, esLegado, mapaAsientos, ocupacionDe, personasEnMesa, opsExpandir, opsSentar, opsQuitar, etiquetaSeparado, claveDe, type Fila } from './asientos'

const guests = [
  { id: 'g1', name: 'Diego Garza', rsvp_status: 'confirmed', checked_in: false, side: 'Tíos', party_members: [
    { id: 'm1', name: 'Carmen Rodríguez', rsvp_status: 'confirmed', checked_in: false },
    { id: 'm2', name: 'Ximena Garza', rsvp_status: 'pending', checked_in: false },
  ] },
  { id: 'g2', name: 'Rosa Garza', rsvp_status: 'confirmed', checked_in: true, side: null, party_members: [] },
]
const personas = personasDe(guests)
const fila = (p: Partial<Fila> & { id: string; table_id: string }): Fila => ({ event_id: 'e', guest_id: 'g1', party_member_id: null, party_size: 1, seat_number: 1, ...p })

describe('personasDe', () => {
  it('una persona por titular y por acompanante, con clave, titular y grupo', () => {
    expect(personas.map(p => p.clave)).toEqual(['g1', 'm1', 'm2', 'g2'])
    expect(personas[1]).toMatchObject({ guestId: 'g1', memberId: 'm1', titular: 'Diego Garza', nombre: 'Carmen Rodríguez', grupo: 'Tíos' })
    expect(personas[0].titular).toBeNull()
    expect(personas[3].grupo).toBeNull()
    expect(claveDe('g1', 'm1')).toBe('m1')
    expect(claveDe('g1', null)).toBe('g1')
  })
  it('un acompanante sin nombre se llama Acompañante', () => {
    const p = personasDe([{ id: 'g9', name: 'X', rsvp_status: 'pending', checked_in: false, side: null, party_members: [{ id: 'm9', name: '', rsvp_status: 'pending', checked_in: false }] }])
    expect(p[1].nombre).toBe('Acompañante')
  })
})

describe('esLegado', () => {
  it('fila de titular con party_size > 1 y sin filas de acompanantes', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    expect(esLegado(filas[0], filas)).toBe(true)
  })
  it('deja de ser legado en cuanto un acompanante tiene fila', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })]
    expect(esLegado(filas[0], filas)).toBe(false)
  })
  it('una fila de acompanante nunca es legado', () => {
    const filas = [fila({ id: 's2', table_id: 't2', party_member_id: 'm1', party_size: 3 })]
    expect(esLegado(filas[0], filas)).toBe(false)
  })
})

describe('mapaAsientos y ocupacion', () => {
  it('una fila legado sienta a toda la familia y cuenta N', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    const mapa = mapaAsientos(filas, personas)
    expect(mapa.get('g1')).toEqual({ seatId: 's1', tableId: 't1', legado: true })
    expect(mapa.get('m2')).toEqual({ seatId: 's1', tableId: 't1', legado: true })
    expect(ocupacionDe('t1', filas)).toBe(3)
    expect(personasEnMesa('t1', filas, personas).map(p => p.clave)).toEqual(['g1', 'm1', 'm2'])
  })
  it('filas por persona cuentan 1 cada una', () => {
    const filas = [fila({ id: 's1', table_id: 't1' }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })]
    expect(ocupacionDe('t1', filas)).toBe(1)
    expect(ocupacionDe('t2', filas)).toBe(1)
    expect(mapaAsientos(filas, personas).get('m2')).toBeUndefined()
    expect(personasEnMesa('t2', filas, personas).map(p => p.clave)).toEqual(['m1'])
  })
  it('una fila cuyo invitado ya no existe cuenta pero no aparece', () => {
    const filas = [fila({ id: 's1', table_id: 't1', guest_id: 'huerfano', party_size: 2 })]
    expect(ocupacionDe('t1', filas)).toBe(2)
    expect(personasEnMesa('t1', filas, personas)).toEqual([])
  })
})

describe('opsExpandir', () => {
  it('inserta una fila por acompanante en la misma mesa y luego encoge al titular', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3, seat_number: 4 })]
    expect(opsExpandir('g1', filas, personas)).toEqual([
      { kind: 'insert', row: { table_id: 't1', event_id: 'e', guest_id: 'g1', party_member_id: 'm1', seat_number: 5, party_size: 1 } },
      { kind: 'insert', row: { table_id: 't1', event_id: 'e', guest_id: 'g1', party_member_id: 'm2', seat_number: 6, party_size: 1 } },
      { kind: 'encoger', seatId: 's1' },
    ])
  })
  it('sin fila legado no hace nada', () => {
    expect(opsExpandir('g1', [fila({ id: 's1', table_id: 't1' })], personas)).toEqual([])
    expect(opsExpandir('g1', [], personas)).toEqual([])
  })
})

describe('opsSentar', () => {
  it('persona sin lugar: un insert con el siguiente numero de la mesa destino', () => {
    const filas = [fila({ id: 's9', table_id: 't2', guest_id: 'g2', seat_number: 2 })]
    expect(opsSentar(personas[1], 't2', 'e', filas, personas)).toEqual([
      { kind: 'insert', row: { table_id: 't2', event_id: 'e', guest_id: 'g1', party_member_id: 'm1', seat_number: 3, party_size: 1 } },
    ])
  })
  it('persona ya sentada: un solo mover, nunca borrar y crear', () => {
    const filas = [fila({ id: 's2', table_id: 't1', party_member_id: 'm1' })]
    expect(opsSentar(personas[1], 't2', 'e', filas, personas)).toEqual([{ kind: 'mover', seatId: 's2', table_id: 't2', seat_number: 1 }])
  })
  it('ya esta en esa mesa: nada que hacer', () => {
    const filas = [fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })]
    expect(opsSentar(personas[1], 't2', 'e', filas, personas)).toEqual([])
  })
  it('acompanante de familia legado: primero expande, luego mueve su fila nueva', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    const ops = opsSentar(personas[2], 't2', 'e', filas, personas)
    expect(ops.map(o => o.kind)).toEqual(['insert', 'insert', 'encoger', 'mover'])
    expect(ops[3]).toEqual({ kind: 'mover', seatId: 'nuevo:m2', table_id: 't2', seat_number: 1 })
  })
  it('titular de familia legado a otra mesa: expande y mueve solo su fila', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    const ops = opsSentar(personas[0], 't2', 'e', filas, personas)
    expect(ops.map(o => o.kind)).toEqual(['insert', 'insert', 'encoger', 'mover'])
    expect(ops[3]).toEqual({ kind: 'mover', seatId: 's1', table_id: 't2', seat_number: 1 })
  })
})

describe('opsQuitar', () => {
  it('persona con fila: un delete', () => {
    const filas = [fila({ id: 's2', table_id: 't1', party_member_id: 'm1' })]
    expect(opsQuitar(personas[1], filas, personas)).toEqual([{ kind: 'delete', seatId: 's2' }])
  })
  it('titular de familia legado: expande y borra solo su fila', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    const ops = opsQuitar(personas[0], filas, personas)
    expect(ops.map(o => o.kind)).toEqual(['insert', 'insert', 'encoger', 'delete'])
    expect(ops[3]).toEqual({ kind: 'delete', seatId: 's1' })
  })
  it('sin lugar: nada', () => {
    expect(opsQuitar(personas[3], [], personas)).toEqual([])
  })
})

describe('etiquetaSeparado', () => {
  const num = (t: string) => ({ t1: 2, t2: 5, t3: 8 } as Record<string, number>)[t] ?? 0
  it('nada cuando la familia esta junta o sin mesa', () => {
    const mapa = mapaAsientos([fila({ id: 's1', table_id: 't1', party_size: 3 })], personas)
    expect(etiquetaSeparado(personas[0], mapa, personas, num)).toBeNull()
    expect(etiquetaSeparado(personas[1], mapa, personas, num)).toBeNull()
    expect(etiquetaSeparado(personas[3], new Map(), personas, num)).toBeNull()
  })
  it('acompanante en otra mesa que su titular: la mesa del titular', () => {
    const mapa = mapaAsientos([fila({ id: 's1', table_id: 't1' }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })], personas)
    expect(etiquetaSeparado(personas[1], mapa, personas, num)).toBe('Mesa 2')
    expect(etiquetaSeparado(personas[0], mapa, personas, num)).toBe('+1 en Mesa 5')
  })
  it('acompanante sentado con titular sin mesa: nada', () => {
    const mapa = mapaAsientos([fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })], personas)
    expect(etiquetaSeparado(personas[1], mapa, personas, num)).toBeNull()
  })
  it('titular con acompanantes en varias mesas', () => {
    const mapa = mapaAsientos([fila({ id: 's1', table_id: 't1' }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' }), fila({ id: 's3', table_id: 't3', party_member_id: 'm2' })], personas)
    expect(etiquetaSeparado(personas[0], mapa, personas, num)).toBe('+2 en otras mesas')
  })
})
