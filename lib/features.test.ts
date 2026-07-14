import { describe, it, expect } from 'vitest'
import { getDefaultAccessMode, resolveAccessMode, normalizeAccessFields } from './features'
import { EVENT_TYPES } from './event-types'

describe('getDefaultAccessMode', () => {
  it('las celebraciones de lista curada son privadas', () => {
    expect(getDefaultAccessMode('boda')).toBe('privada')
    expect(getDefaultAccessMode('xv')).toBe('privada')
    expect(getDefaultAccessMode('bautizo')).toBe('privada')
    expect(getDefaultAccessMode('graduacion')).toBe('privada')
  })

  it('los eventos de boleto y cupo son abiertos', () => {
    expect(getDefaultAccessMode('conferencia')).toBe('abierta')
    expect(getDefaultAccessMode('congreso')).toBe('abierta')
    expect(getDefaultAccessMode('caridad')).toBe('abierta')
    expect(getDefaultAccessMode('fiesta')).toBe('abierta')
    expect(getDefaultAccessMode('cumpleanos')).toBe('abierta')
  })

  it('los grupos cerrados self-serve piden aprobacion', () => {
    expect(getDefaultAccessMode('despedida')).toBe('aprobacion')
    expect(getDefaultAccessMode('capacitacion')).toBe('aprobacion')
    expect(getDefaultAccessMode('teambuilding')).toBe('aprobacion')
    expect(getDefaultAccessMode('lanzamiento')).toBe('aprobacion')
    expect(getDefaultAccessMode('asamblea')).toBe('aprobacion')
    expect(getDefaultAccessMode('retiro')).toBe('aprobacion')
    expect(getDefaultAccessMode('campamento')).toBe('aprobacion')
    expect(getDefaultAccessMode('otro')).toBe('aprobacion')
  })

  it('tipo desconocido o null cae en aprobacion', () => {
    expect(getDefaultAccessMode('inexistente')).toBe('aprobacion')
    expect(getDefaultAccessMode(null)).toBe('aprobacion')
  })

  it('los 17 tipos declaran un modo valido', () => {
    expect(EVENT_TYPES).toHaveLength(17)
    for (const t of EVENT_TYPES) {
      expect(['privada', 'aprobacion', 'abierta']).toContain(t.defaultAccessMode)
    }
  })
})

describe('resolveAccessMode', () => {
  it('respeta el valor guardado', () => {
    expect(resolveAccessMode('boda', 'abierta')).toBe('abierta')
    expect(resolveAccessMode('conferencia', 'privada')).toBe('privada')
  })

  it('evento viejo (columna null) cae en el default del tipo', () => {
    expect(resolveAccessMode('boda', null)).toBe('privada')
    expect(resolveAccessMode('conferencia', undefined)).toBe('abierta')
  })

  it('valor basura en la columna cae en el default del tipo', () => {
    expect(resolveAccessMode('boda', 'lo-que-sea')).toBe('privada')
    expect(resolveAccessMode('boda', '')).toBe('privada')
  })
})

describe('normalizeAccessFields', () => {
  it('privada borra cupo y precio aunque vengan llenos', () => {
    expect(normalizeAccessFields({ accessMode: 'privada', guestCap: '100', ticketPrice: '500' }))
      .toEqual({ guest_cap: null, ticket_price: null })
  })

  it('abierta guarda cupo y precio', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '100', ticketPrice: '500' }))
      .toEqual({ guest_cap: 100, ticket_price: 500 })
  })

  it('aprobacion guarda cupo y precio', () => {
    expect(normalizeAccessFields({ accessMode: 'aprobacion', guestCap: '30', ticketPrice: '0' }))
      .toEqual({ guest_cap: 30, ticket_price: 0 })
  })

  it('vacio o espacios es null: sin limite y gratis', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: '   ' }))
      .toEqual({ guest_cap: null, ticket_price: null })
  })

  it('el precio acepta decimales', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: '250.50' }).ticket_price)
      .toBe(250.5)
  })

  it('el cupo rechaza decimales, cero y negativos', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '10.5', ticketPrice: '' }).guest_cap).toBeNull()
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '0', ticketPrice: '' }).guest_cap).toBeNull()
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '-5', ticketPrice: '' }).guest_cap).toBeNull()
  })

  it('el precio rechaza negativos y basura', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: '-1' }).ticket_price).toBeNull()
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '', ticketPrice: 'abc' }).ticket_price).toBeNull()
  })

  it('el cupo rechaza basura', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: 'muchos', ticketPrice: '' }).guest_cap).toBeNull()
  })

  it('el cupo acepta el limite exacto (1000000)', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '1000000', ticketPrice: '' }).guest_cap).toBe(1000000)
  })

  it('el cupo rechaza arriba del limite (1000001)', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '1000001', ticketPrice: '' }).guest_cap).toBeNull()
  })

  it('el cupo rechaza valores absurdos (99999999999)', () => {
    expect(normalizeAccessFields({ accessMode: 'abierta', guestCap: '99999999999', ticketPrice: '' }).guest_cap).toBeNull()
  })
})
