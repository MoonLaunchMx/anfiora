import { describe, it, expect } from 'vitest'
import { isCaptureCancelled } from './feedback-capture'

describe('isCaptureCancelled', () => {
  it('trata como cancelacion cuando el usuario cierra el selector del navegador', () => {
    expect(isCaptureCancelled(new DOMException('Permission denied', 'NotAllowedError'))).toBe(true)
  })

  it('trata como cancelacion el AbortError que usa Firefox', () => {
    expect(isCaptureCancelled(new DOMException('The user aborted a request.', 'AbortError'))).toBe(true)
  })

  it('no trata como cancelacion una falla real: esa si merece mensaje', () => {
    expect(isCaptureCancelled(new DOMException('no hay camara', 'NotFoundError'))).toBe(false)
    expect(isCaptureCancelled(new Error('sin canvas'))).toBe(false)
  })

  it('no truena con nulos ni con cosas que no son errores', () => {
    expect(isCaptureCancelled(null)).toBe(false)
    expect(isCaptureCancelled(undefined)).toBe(false)
    expect(isCaptureCancelled('NotAllowedError')).toBe(false)
  })
})
