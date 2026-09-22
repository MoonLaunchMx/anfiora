import { describe, it, expect } from 'vitest'
import { describirFallo, falloDeEscritura, SIN_FILAS } from './fallo'

describe('describirFallo', () => {
  it('la red caida se puede reintentar', () => {
    const f = describirFallo(new TypeError('Failed to fetch'))
    expect(f.tipo).toBe('red')
    expect(f.reintentable).toBe(true)
    expect(f.detalle).toBe('Se perdió la conexión.')
  })

  it('un rechazo de RLS no se reintenta', () => {
    const f = describirFallo({ code: '42501', message: 'new row violates row-level security policy' })
    expect(f.tipo).toBe('permiso')
    expect(f.reintentable).toBe(false)
  })

  it('cero filas se trata como permiso o dato que ya no existe', () => {
    const f = describirFallo(SIN_FILAS)
    expect(f.tipo).toBe('sin_filas')
    expect(f.reintentable).toBe(false)
  })

  it('lo demas es interno, reintentable y se reporta', () => {
    const f = describirFallo({ code: '23505', message: 'duplicate key' })
    expect(f.tipo).toBe('interno')
    expect(f.reintentable).toBe(true)
    expect(f.detalle).toBe('Algo falló de nuestro lado. Ya nos llegó el aviso.')
  })
})

describe('falloDeEscritura', () => {
  it('sin error y con filas no hay fallo', () => {
    expect(falloDeEscritura({ data: [{ id: '1' }], error: null })).toBeNull()
  })

  it('el error manda aunque haya filas', () => {
    const f = falloDeEscritura({ data: [], error: { message: 'Failed to fetch' } })
    expect(f?.tipo).toBe('red')
  })

  it('sin error pero sin filas es un fallo mudo de RLS', () => {
    const f = falloDeEscritura({ data: [], error: null })
    expect(f?.tipo).toBe('sin_filas')
  })

  it('data null sin error tambien cuenta como cero filas', () => {
    expect(falloDeEscritura({ data: null, error: null })?.tipo).toBe('sin_filas')
  })

  it('se pueden exigir N filas exactas', () => {
    const f = falloDeEscritura({ data: [{ id: '1' }], error: null }, 2)
    expect(f?.tipo).toBe('sin_filas')
  })
})
