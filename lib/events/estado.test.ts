import { describe, it, expect } from 'vitest'
import { estadoEvento, esArchivado, ocupaLugar } from './estado'

const HOY = new Date(2026, 7, 19)

const evento = (over: Partial<{ event_status: string | null; event_date: string | null; event_end_date: string | null }> = {}) => ({
  event_status: 'active' as string | null,
  event_date: '2026-08-25',
  event_end_date: null as string | null,
  ...over,
})

describe('estadoEvento', () => {
  it('activo cuando la fecha es futura', () => {
    expect(estadoEvento(evento(), HOY)).toBe('activo')
  })

  it('el evento de hoy sigue activo', () => {
    expect(estadoEvento(evento({ event_date: '2026-08-19' }), HOY)).toBe('activo')
  })

  it('pasado cuando la fecha ya se cumplio', () => {
    expect(estadoEvento(evento({ event_date: '2026-08-18' }), HOY)).toBe('pasado')
  })

  it('en un evento de varios dias manda la fecha final', () => {
    expect(estadoEvento(evento({ event_date: '2026-08-17', event_end_date: '2026-08-20' }), HOY)).toBe('activo')
  })

  it('sin fecha se considera vigente', () => {
    expect(estadoEvento(evento({ event_date: null }), HOY)).toBe('activo')
  })

  it('archivado gana sobre la fecha', () => {
    expect(estadoEvento(evento({ event_status: 'archived' }), HOY)).toBe('archivado')
    expect(estadoEvento(evento({ event_status: 'archived', event_date: '2020-01-01' }), HOY)).toBe('archivado')
  })

  it('los estatus viejos cuentan como archivados mientras no corra la migracion', () => {
    expect(estadoEvento(evento({ event_status: 'paused' }), HOY)).toBe('archivado')
    expect(estadoEvento(evento({ event_status: 'cancelled' }), HOY)).toBe('archivado')
    expect(estadoEvento(evento({ event_status: 'completed' }), HOY)).toBe('archivado')
  })

  it('sin estatus es activo, como en la base', () => {
    expect(estadoEvento(evento({ event_status: null }), HOY)).toBe('activo')
  })
})

describe('esArchivado', () => {
  it('solo active esta vivo', () => {
    expect(esArchivado('active')).toBe(false)
    expect(esArchivado(null)).toBe(false)
    expect(esArchivado('archived')).toBe(true)
    expect(esArchivado('paused')).toBe(true)
  })
})

describe('ocupaLugar', () => {
  it('solo el activo vigente ocupa lugar', () => {
    expect(ocupaLugar(evento(), HOY)).toBe(true)
    expect(ocupaLugar(evento({ event_date: '2026-08-18' }), HOY)).toBe(false)
    expect(ocupaLugar(evento({ event_status: 'archived' }), HOY)).toBe(false)
  })
})
