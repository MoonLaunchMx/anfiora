import { describe, it, expect } from 'vitest'
import { puertaAplica } from './legal-puerta'

describe('puertaAplica', () => {
  it('corre en las rutas con cuenta', () => {
    for (const r of ['/dashboard', '/events', '/events/abc-123', '/events/abc/mesas', '/perfil', '/configuracion', '/configuracion/perfil', '/ajustes/categorias', '/admin', '/mensajes', '/rolodex', '/rolodex/9']) {
      expect(puertaAplica(r), r).toBe(true)
    }
  })

  it('NO corre en la landing ni en los nichos', () => {
    for (const r of ['/', '/bodas', '/eventos-corporativos']) {
      expect(puertaAplica(r), r).toBe(false)
    }
  })

  it('NO corre en las superficies publicas de invitados', () => {
    for (const r of ['/invitacion/boda/abc', '/invitacion/preview/9', '/mesa/tok', '/playlist/tok', '/opinion/tok', '/invite/tok']) {
      expect(puertaAplica(r), r).toBe(false)
    }
  })

  it('NO corre en las paginas legales ni en recuperar contrasena', () => {
    for (const r of ['/privacidad', '/terminos', '/eliminar-datos', '/auth/reset']) {
      expect(puertaAplica(r), r).toBe(false)
    }
  })

  it('no se deja enganar por una ruta que solo empieza igual', () => {
    expect(puertaAplica('/eventsomething')).toBe(false)
    expect(puertaAplica('/adminis')).toBe(false)
    expect(puertaAplica('/perfiles')).toBe(false)
  })

  it('sin pathname no corre', () => {
    expect(puertaAplica(null)).toBe(false)
    expect(puertaAplica(undefined)).toBe(false)
    expect(puertaAplica('')).toBe(false)
  })
})
