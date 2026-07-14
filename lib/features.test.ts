import { describe, it, expect } from 'vitest'
import { getDefaultAccessMode, resolveAccessMode } from './features'
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
