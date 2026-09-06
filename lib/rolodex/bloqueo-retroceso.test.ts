import { describe, it, expect } from 'vitest'
import { bloqueoDe } from './bloqueo-retroceso'

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

  it('un monto cotizado sin archivo tambien cuenta como cotizacion', () => {
    // La evidencia la arma quien llama (archivo O monto); aqui solo se prueba
    // que basta con que venga en true.
    expect(bloqueoDe('nuevo', { tieneCotizacion: true, tienePagos: false })).not.toBeNull()
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
