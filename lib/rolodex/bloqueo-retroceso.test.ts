import { describe, it, expect } from 'vitest'
import { bloqueoDe, tieneCotizacionRegistrada } from './bloqueo-retroceso'
import type { ArchivoAdjunto } from '@/lib/types'

const archivo = (borrado: string | null = null): ArchivoAdjunto => ({
  path: 'x', nombre: 'x.pdf', tipo: 'application/pdf', bytes: 1,
  subido: '2026-01-01T00:00:00Z', por: null, borrado,
})

describe('tieneCotizacionRegistrada', () => {
  it('no hay cotizacion sin archivo visible ni monto', () => {
    expect(tieneCotizacionRegistrada([], null)).toBe(false)
    expect(tieneCotizacionRegistrada(null, null)).toBe(false)
  })

  it('un archivo visible cuenta como cotizacion, aunque no haya monto', () => {
    expect(tieneCotizacionRegistrada([archivo()], null)).toBe(true)
  })

  it('un archivo borrado no cuenta', () => {
    expect(tieneCotizacionRegistrada([archivo('2026-01-02T00:00:00Z')], null)).toBe(false)
  })

  it('un monto sin ningun archivo tambien cuenta', () => {
    expect(tieneCotizacionRegistrada([], 5000)).toBe(true)
  })

  it('archivo y monto juntos siguen contando', () => {
    expect(tieneCotizacionRegistrada([archivo()], 5000)).toBe(true)
  })
})

describe('bloqueoDe', () => {
  it('deja pasar el movimiento cuando no hay evidencia que lo contradiga', () => {
    expect(bloqueoDe('nuevo', { tieneCotizacion: false, tienePagos: false })).toBeNull()
    expect(bloqueoDe('cotizado', { tieneCotizacion: false, tienePagos: false })).toBeNull()
  })

  it('bloquea el regreso a nuevo si ya tiene cotizacion, y ofrece cotizado', () => {
    const bloqueo = bloqueoDe('nuevo', { tieneCotizacion: true, tienePagos: false })
    expect(bloqueo).not.toBeNull()
    expect(bloqueo?.alternativa).toBe('cotizado')
  })

  it('bloquea el regreso a nuevo o cotizado si ya tiene pagos, sin alternativa', () => {
    expect(bloqueoDe('nuevo', { tieneCotizacion: false, tienePagos: true })?.alternativa).toBeNull()
    expect(bloqueoDe('cotizado', { tieneCotizacion: false, tienePagos: true })?.alternativa).toBeNull()
  })

  it('los pagos pesan mas que la cotizacion: gana el bloqueo sin alternativa', () => {
    const bloqueo = bloqueoDe('nuevo', { tieneCotizacion: true, tienePagos: true })
    expect(bloqueo).not.toBeNull()
    expect(bloqueo?.alternativa).toBeNull()
  })

  it('contratado y descartado nunca se bloquean por esta regla', () => {
    expect(bloqueoDe('contratado', { tieneCotizacion: true, tienePagos: true })).toBeNull()
    expect(bloqueoDe('descartado', { tieneCotizacion: true, tienePagos: true })).toBeNull()
  })
})
