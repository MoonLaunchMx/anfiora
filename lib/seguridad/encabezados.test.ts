import { describe, it, expect } from 'vitest'
import { ENCABEZADOS_SEGURIDAD, ENCABEZADOS_SEGURIDAD_LISTA, ponerEncabezados } from './encabezados'

describe('encabezados de seguridad', () => {
  it('trae el que evita que el token viaje a sitios de fuera', () => {
    expect(ENCABEZADOS_SEGURIDAD['Referrer-Policy']).toBe('same-origin')
  })

  it('la lista para next.config trae los mismos', () => {
    expect(ENCABEZADOS_SEGURIDAD_LISTA).toHaveLength(Object.keys(ENCABEZADOS_SEGURIDAD).length)
    expect(ENCABEZADOS_SEGURIDAD_LISTA).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' })
  })

  it('los pone todos en una respuesta y pisa lo que hubiera', () => {
    const headers = new Headers({ 'Referrer-Policy': 'unsafe-url', 'Content-Type': 'text/html' })
    ponerEncabezados(headers)

    expect(headers.get('Referrer-Policy')).toBe('same-origin')
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(headers.get('Strict-Transport-Security')).toContain('includeSubDomains')
    expect(headers.get('Content-Type')).toBe('text/html')
  })
})
