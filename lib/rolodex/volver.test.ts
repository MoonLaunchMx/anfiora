import { describe, it, expect } from 'vitest'
import { destinoDeVuelta } from './volver'

describe('destinoDeVuelta', () => {
  it('desde el directorio se sale al dashboard', () => {
    expect(destinoDeVuelta('', '/rolodex')).toBe('/dashboard')
    expect(destinoDeVuelta('?desde=/events/1/proveedores', '/rolodex')).toBe('/dashboard')
  })

  it('el expediente regresa a la ficha que lo abrio', () => {
    expect(destinoDeVuelta('?desde=%2Fevents%2Fabc%2Fproveedores%3Fproveedor%3D9', '/rolodex/abc'))
      .toBe('/events/abc/proveedores?proveedor=9')
  })

  it('el expediente sin origen regresa al directorio', () => {
    expect(destinoDeVuelta('', '/rolodex/abc')).toBe('/rolodex')
  })

  it('ignora un destino que salga de Anfiora', () => {
    expect(destinoDeVuelta('?desde=https://otro.com', '/rolodex/abc')).toBe('/rolodex')
    expect(destinoDeVuelta('?desde=//otro.com', '/rolodex/abc')).toBe('/rolodex')
  })
})
