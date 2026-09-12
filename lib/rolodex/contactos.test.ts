import { describe, it, expect } from 'vitest'
import { contactosDe, telefonoCrudoDe } from './contactos'

const VACIO = {
  phone: null, phone_country_code: null, email: null, instagram: null, facebook: null, website: null,
}

describe('telefonoCrudoDe', () => {
  it('sin telefono no hay nada que armar', () => {
    expect(telefonoCrudoDe({ phone: null, phone_country_code: null })).toBeNull()
  })

  it('un telefono que ya trae + se deja igual', () => {
    expect(telefonoCrudoDe({ phone: '+525512345678', phone_country_code: '+1' })).toBe('+525512345678')
  })

  it('sin + antepone la lada guardada', () => {
    expect(telefonoCrudoDe({ phone: '5512345678', phone_country_code: '+52' })).toBe('+52 5512345678')
  })

  it('sin lada guardada usa Mexico por defecto', () => {
    expect(telefonoCrudoDe({ phone: '5512345678', phone_country_code: null })).toBe('+52 5512345678')
  })
})

describe('contactosDe', () => {
  it('sin ningun dato no ofrece ningun boton', () => {
    expect(contactosDe(VACIO)).toEqual([])
  })

  it('con todo trae los cinco canales en el orden acordado', () => {
    const contactos = contactosDe({
      phone: '5512345678',
      phone_country_code: '+52',
      email: 'hola@proveedor.mx',
      instagram: '@proveedor',
      facebook: '@proveedorfb',
      website: 'proveedor.mx',
    })
    expect(contactos.map(c => c.tipo)).toEqual(['whatsapp', 'correo', 'instagram', 'facebook', 'sitio'])
  })

  it('arma el link de whatsapp en digitos, sin el mas', () => {
    const [wa] = contactosDe({ ...VACIO, phone: '5512345678', phone_country_code: '+52' })
    expect(wa).toEqual({ tipo: 'whatsapp', href: 'https://wa.me/525512345678' })
  })

  // Antes un numero corto no ofrecia boton. Ahora si: quien dice si el numero
  // existe es WhatsApp al abrirlo, no Anfiora al guardarlo.
  it('un telefono corto igual ofrece boton de whatsapp', () => {
    expect(contactosDe({ ...VACIO, phone: '123', phone_country_code: '+52' }))
      .toEqual([{ tipo: 'whatsapp', href: 'https://wa.me/52123' }])
  })

  it('un telefono sin digitos no ofrece boton de whatsapp', () => {
    expect(contactosDe({ ...VACIO, phone: 'pendiente', phone_country_code: '+52' })).toEqual([])
  })

  it('mailto con el correo tal cual', () => {
    expect(contactosDe({ ...VACIO, email: 'hola@proveedor.mx' }))
      .toEqual([{ tipo: 'correo', href: 'mailto:hola@proveedor.mx' }])
  })

  it('instagram y facebook se limpian de la arroba', () => {
    const contactos = contactosDe({ ...VACIO, instagram: '@fotos', facebook: '@fiestas' })
    expect(contactos).toEqual([
      { tipo: 'instagram', href: 'https://instagram.com/fotos' },
      { tipo: 'facebook', href: 'https://facebook.com/fiestas' },
    ])
  })

  it('un sitio sin http le antepone https', () => {
    expect(contactosDe({ ...VACIO, website: 'proveedor.mx' }))
      .toEqual([{ tipo: 'sitio', href: 'https://proveedor.mx' }])
  })

  it('un sitio que ya trae protocolo se deja igual', () => {
    expect(contactosDe({ ...VACIO, website: 'http://proveedor.mx' }))
      .toEqual([{ tipo: 'sitio', href: 'http://proveedor.mx' }])
  })
})
