import { describe, it, expect } from 'vitest'
import { isAuthorizedCronRequest } from './cron-auth'

describe('isAuthorizedCronRequest', () => {
  it('sin CRON_SECRET configurado nadie entra', () => {
    expect(isAuthorizedCronRequest('Bearer lo-que-sea', undefined)).toBe(false)
    expect(isAuthorizedCronRequest('Bearer lo-que-sea', '')).toBe(false)
  })

  it('sin cabecera no entra', () => {
    expect(isAuthorizedCronRequest(null, 'secreto')).toBe(false)
  })

  it('secreto equivocado no entra', () => {
    expect(isAuthorizedCronRequest('Bearer equivocado', 'secreto')).toBe(false)
  })

  it('secreto correcto entra', () => {
    expect(isAuthorizedCronRequest('Bearer secreto', 'secreto')).toBe(true)
  })

  it('un secreto de largo distinto devuelve false en vez de lanzar', () => {
    expect(() => isAuthorizedCronRequest('Bearer a', 'una-cadena-mucho-mas-larga')).not.toThrow()
    expect(isAuthorizedCronRequest('Bearer a', 'una-cadena-mucho-mas-larga')).toBe(false)
  })

  it('cabecera vacia tras quitar el prefijo no entra', () => {
    expect(isAuthorizedCronRequest('Bearer ', 'secreto')).toBe(false)
  })
})
