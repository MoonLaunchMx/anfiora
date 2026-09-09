import { describe, it, expect } from 'vitest'
import { esEventoVigente, eventosParaRepartir, hoyISO } from './eventos'

const HOY = '2026-09-09'
const ev = (id: string, event_date: string | null, event_status: string | null = 'active') =>
  ({ id, event_date, event_status })

describe('esEventoVigente', () => {
  it('el de hoy cuenta: se trabaja justo ese dia', () => {
    expect(esEventoVigente(ev('a', HOY), HOY)).toBe(true)
  })

  it('el futuro cuenta y el pasado no', () => {
    expect(esEventoVigente(ev('a', '2027-02-14'), HOY)).toBe(true)
    expect(esEventoVigente(ev('a', '2026-09-08'), HOY)).toBe(false)
    expect(esEventoVigente(ev('a', '2024-01-01'), HOY)).toBe(false)
  })

  it('sin fecha se ofrece: no hay razon para esconderlo', () => {
    expect(esEventoVigente(ev('a', null), HOY)).toBe(true)
  })

  it('los estados terminados nunca se ofrecen, aunque sean del futuro', () => {
    for (const estado of ['cancelled', 'completed', 'archived']) {
      expect(esEventoVigente(ev('a', '2027-02-14', estado), HOY)).toBe(false)
    }
  })

  it('un estado desconocido o nulo no descalifica', () => {
    expect(esEventoVigente(ev('a', '2027-02-14', null), HOY)).toBe(true)
    expect(esEventoVigente(ev('a', '2027-02-14', 'paused'), HOY)).toBe(true)
  })
})

describe('eventosParaRepartir', () => {
  const lista = [
    ev('futuro', '2027-02-14'),
    ev('hoy', HOY),
    ev('pasado', '2026-01-10'),
    ev('cancelado', '2027-05-01', 'cancelled'),
    ev('sinfecha', null),
  ]

  it('deja fuera lo pasado y lo terminado', () => {
    expect(eventosParaRepartir(lista, HOY).map(e => e.id))
      .toEqual(['futuro', 'hoy', 'sinfecha'])
  })

  it('conserva lo que la persona YA tiene, aunque haya pasado', () => {
    expect(eventosParaRepartir(lista, HOY, new Set(['pasado'])).map(e => e.id))
      .toEqual(['futuro', 'hoy', 'pasado', 'sinfecha'])
  })

  it('conservar tambien rescata un evento cancelado que ya tenia', () => {
    expect(eventosParaRepartir(lista, HOY, new Set(['cancelado'])).map(e => e.id))
      .toEqual(['futuro', 'hoy', 'cancelado', 'sinfecha'])
  })

  it('sin eventos devuelve vacio', () => {
    expect(eventosParaRepartir([], HOY)).toEqual([])
  })
})

describe('hoyISO', () => {
  it('da la fecha local en YYYY-MM-DD, no la UTC', () => {
    // 31 de diciembre a las 20:00 local: en UTC ya seria el dia 1.
    expect(hoyISO(new Date(2026, 11, 31, 20, 0, 0))).toBe('2026-12-31')
  })

  it('rellena mes y dia con cero', () => {
    expect(hoyISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
