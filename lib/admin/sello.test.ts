import { describe, it, expect } from 'vitest'
import { hayLugarDeFundador, normalizarSello } from '@/lib/workspace/sello'

describe('asignacion del sello', () => {
  it('no deja pasar del lugar 25', () => {
    expect(hayLugarDeFundador(24)).toBe(true)
    expect(hayLugarDeFundador(25)).toBe(false)
  })

  it('quitar el sello siempre se puede', () => {
    expect(normalizarSello('')).toBeNull()
  })
})
