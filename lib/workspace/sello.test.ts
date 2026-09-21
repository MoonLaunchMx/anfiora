import { describe, it, expect } from 'vitest'
import {
  normalizarSello, limiteEventos, limiteInvitados,
  LUGARES_FUNDADOR, hayLugarDeFundador, resolverLimiteInvitados,
} from './sello'

describe('sello de partner', () => {
  it('solo reconoce fundador', () => {
    expect(normalizarSello('fundador')).toBe('fundador')
    expect(normalizarSello(' FUNDADOR ')).toBe('fundador')
    expect(normalizarSello('vip')).toBeNull()
    expect(normalizarSello(null)).toBeNull()
  })

  it('quitar el sello siempre se puede', () => {
    expect(normalizarSello('')).toBeNull()
  })

  it('free tiene topes y los de paga no', () => {
    expect(limiteEventos('free', null)).toBe(1)
    expect(limiteInvitados('free', null)).toBe(50)
    expect(limiteEventos('pro', null)).toBeNull()
    expect(limiteInvitados('studio', null)).toBeNull()
  })

  it('el sello quita los topes aunque el plan sea free', () => {
    expect(limiteEventos('free', 'fundador')).toBeNull()
    expect(limiteInvitados('free', 'fundador')).toBeNull()
  })

  it('un plan desconocido se trata como free', () => {
    expect(limiteEventos('lo-que-sea', null)).toBe(1)
    expect(limiteInvitados(null, null)).toBe(50)
  })

  it('los lugares de fundador son 25', () => {
    expect(LUGARES_FUNDADOR).toBe(25)
    expect(hayLugarDeFundador(24)).toBe(true)
    expect(hayLugarDeFundador(25)).toBe(false)
  })
})

describe('resolverLimiteInvitados: RPC ambiguo vs lectura directa', () => {
  it('la lectura directa del workspace manda sobre el RPC', () => {
    expect(resolverLimiteInvitados('free', true, 'pro', null)).toBeNull()
    expect(resolverLimiteInvitados('pro', true, 'free', null)).toBe(50)
    expect(resolverLimiteInvitados('free', true, 'free', 'fundador')).toBeNull()
  })

  it('un plan de paga del RPC es confiable aunque la lectura directa no encuentre nada', () => {
    expect(resolverLimiteInvitados('pro', false, null, null)).toBeNull()
    expect(resolverLimiteInvitados('agency', false, null, null)).toBeNull()
  })

  it('un free del RPC es ambiguo (puede ser su default): sin lectura directa, no se confia', () => {
    expect(resolverLimiteInvitados('free', false, null, null)).toBeNull()
  })

  it('sin ninguna fuente confiable, no se pudo verificar: sin tope', () => {
    expect(resolverLimiteInvitados(null, false, null, null)).toBeNull()
  })
})
