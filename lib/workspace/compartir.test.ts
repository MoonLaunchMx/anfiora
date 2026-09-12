import { describe, it, expect } from 'vitest'
import { enlaceWhatsApp, mensajeCliente, mensajeEquipo } from './compartir'

const ENLACE = 'https://anfiora.com/invite/abc123'

describe('enlaceWhatsApp', () => {
  it('va sin numero: WhatsApp deja escoger el contacto', () => {
    expect(enlaceWhatsApp('hola')).toBe('https://wa.me/?text=hola')
  })

  it('escapa lo que romperia la URL', () => {
    const url = enlaceWhatsApp('Ana & Luis: entra a https://x.com/a?b=1')
    expect(url).not.toContain(' ')
    expect(url).toContain('%26')
    expect(url).toContain('%3F')
  })

  it('el salto de linea viaja escapado', () => {
    expect(enlaceWhatsApp('uno\ndos')).toBe('https://wa.me/?text=uno%0Ados')
  })

  it('los acentos y la ñ sobreviven', () => {
    expect(decodeURIComponent(enlaceWhatsApp('Año de Muñoz').split('text=')[1])).toBe('Año de Muñoz')
  })
})

describe('mensajeEquipo', () => {
  it('nombra el workspace y deja el enlace en su propia linea', () => {
    const m = mensajeEquipo('Moon Events', ENLACE)
    expect(m).toContain('Moon Events')
    expect(m.endsWith('\n' + ENLACE)).toBe(true)
  })

  it('sin nombre de workspace no deja un hueco', () => {
    expect(mensajeEquipo('', ENLACE)).toContain('Anfiora')
    expect(mensajeEquipo('   ', ENLACE)).not.toContain('  .')
  })
})

describe('mensajeCliente', () => {
  it('nombra el evento y deja el enlace al final', () => {
    const m = mensajeCliente('Ana & Luis', ENLACE)
    expect(m).toContain('Ana & Luis')
    expect(m.endsWith('\n' + ENLACE)).toBe(true)
  })

  it('sin nombre de evento sigue teniendo sentido', () => {
    expect(mensajeCliente('', ENLACE)).toContain('tu acceso')
  })
})
