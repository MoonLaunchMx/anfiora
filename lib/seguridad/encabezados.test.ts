import { describe, it, expect } from 'vitest'
import { ENCABEZADOS_SEGURIDAD, ENCABEZADOS_SEGURIDAD_LISTA, ponerEncabezados } from './encabezados'

describe('encabezados de seguridad', () => {
  it('hacia afuera manda el dominio, nunca la ruta con el token', () => {
    expect(ENCABEZADOS_SEGURIDAD['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('deja el microfono, que lo usa el mensaje de voz de la invitacion', () => {
    expect(ENCABEZADOS_SEGURIDAD['Permissions-Policy']).toContain('microphone=(self)')
    expect(ENCABEZADOS_SEGURIDAD['Permissions-Policy']).toContain('camera=()')
    expect(ENCABEZADOS_SEGURIDAD['Permissions-Policy']).not.toContain('display-capture')
  })

  it('la lista para next.config trae los mismos', () => {
    expect(ENCABEZADOS_SEGURIDAD_LISTA).toHaveLength(Object.keys(ENCABEZADOS_SEGURIDAD).length)
    expect(ENCABEZADOS_SEGURIDAD_LISTA).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' })
  })

  it('los pone todos en una respuesta y pisa lo que hubiera', () => {
    const headers = new Headers({ 'Referrer-Policy': 'unsafe-url', 'Content-Type': 'text/html' })
    ponerEncabezados(headers)

    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(headers.get('Strict-Transport-Security')).toContain('includeSubDomains')
    expect(headers.get('Content-Type')).toBe('text/html')
  })
})
