import { describe, it, expect } from 'vitest'
import {
  normalizarSello, limiteEventos, limiteInvitados,
  LUGARES_FUNDADOR, hayLugarDeFundador,
} from './sello'

describe('sello de partner', () => {
  it('solo reconoce fundador', () => {
    expect(normalizarSello('fundador')).toBe('fundador')
    expect(normalizarSello(' FUNDADOR ')).toBe('fundador')
    expect(normalizarSello('vip')).toBeNull()
    expect(normalizarSello(null)).toBeNull()
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
