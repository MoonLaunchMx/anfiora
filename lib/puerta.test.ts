import { describe, it, expect } from 'vitest'
import { occupiedSeats, seatsLeft, canFit, parseRegistration } from './puerta'

describe('cupo', () => {
  it('el aforo suma party_size, no cabezas de fila', () => {
    expect(occupiedSeats([{ party_size: 3 }, { party_size: 2 }])).toBe(5)
  })

  it('un party_size nulo cuenta como una persona', () => {
    expect(occupiedSeats([{ party_size: null }, { party_size: 2 }])).toBe(3)
  })

  it('un party_size basura no rompe la cuenta', () => {
    expect(occupiedSeats([{ party_size: 0 }, { party_size: -4 }])).toBe(2)
  })

  it('una lista vacia no ocupa nada', () => {
    expect(occupiedSeats([])).toBe(0)
  })

  it('sin cupo declarado no hay limite', () => {
    expect(seatsLeft(null, 500)).toBe(null)
  })

  it('los lugares que quedan nunca son negativos', () => {
    expect(seatsLeft(10, 14)).toBe(0)
  })

  it('los lugares que quedan son la resta', () => {
    expect(seatsLeft(10, 4)).toBe(6)
  })

  it('cabe si alcanzan los lugares', () => {
    expect(canFit(10, 8, 2)).toBe(true)
  })

  it('no cabe si el grupo se pasa por uno', () => {
    expect(canFit(10, 8, 3)).toBe(false)
  })

  it('sin cupo siempre cabe', () => {
    expect(canFit(null, 9999, 5)).toBe(true)
  })

  it('con el cupo ya rebasado no cabe nadie', () => {
    expect(canFit(10, 12, 1)).toBe(false)
  })
})

describe('parseo del registro', () => {
  const ok = { name: 'Ana Ruiz', phone: '5544332211', companions: 2 }

  it('normaliza el telefono a E.164', () => {
    expect(parseRegistration(ok, 3)?.phone).toBe('+525544332211')
  })

  it('el party_size incluye al que se registra', () => {
    expect(parseRegistration(ok, 3)?.partySize).toBe(3)
  })

  it('sin acompanantes el party_size es 1', () => {
    expect(parseRegistration({ ...ok, companions: 0 }, 3)?.partySize).toBe(1)
  })

  it('recorta los acompanantes al maximo del anfitrion', () => {
    expect(parseRegistration({ ...ok, companions: 9 }, 2)?.companions).toBe(2)
  })

  it('si el maximo es cero, va solo', () => {
    const r = parseRegistration({ ...ok, companions: 5 }, 0)
    expect(r?.companions).toBe(0)
    expect(r?.partySize).toBe(1)
  })

  it('un numero negativo de acompanantes se trata como cero', () => {
    expect(parseRegistration({ ...ok, companions: -3 }, 2)?.companions).toBe(0)
  })

  it('acompanantes ausente se trata como cero', () => {
    expect(parseRegistration({ name: 'Ana Ruiz', phone: '5544332211' }, 2)?.companions).toBe(0)
  })

  it('recorta espacios del nombre', () => {
    expect(parseRegistration({ ...ok, name: '  Ana Ruiz  ' }, 3)?.name).toBe('Ana Ruiz')
  })

  it('sin nombre no hay registro', () => {
    expect(parseRegistration({ ...ok, name: '   ' }, 3)).toBe(null)
  })

  it('un telefono imposible no pasa', () => {
    expect(parseRegistration({ ...ok, phone: '123' }, 3)).toBe(null)
  })

  it('sin telefono no hay registro, porque el telefono es la llave del dedupe', () => {
    expect(parseRegistration({ ...ok, phone: '' }, 3)).toBe(null)
  })

  it('el telefono ya en E.164 se respeta', () => {
    expect(parseRegistration({ ...ok, phone: '+525544332211' }, 3)?.phone).toBe('+525544332211')
  })

  it('un cuerpo que no es objeto no truena', () => {
    expect(parseRegistration(null, 3)).toBe(null)
    expect(parseRegistration('hola', 3)).toBe(null)
    expect(parseRegistration(undefined, 3)).toBe(null)
  })
})
