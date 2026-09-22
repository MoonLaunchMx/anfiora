import { describe, it, expect } from 'vitest'
import {
  normalizarSello, limiteEventos, limiteInvitados,
  LUGARES_FUNDADOR, hayLugarDeFundador, resolverLimiteInvitados, resolverLimiteEventos,
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

describe('resolverLimiteInvitados: el plan de paga del RPC (el workspace DEL EVENTO) manda siempre', () => {
  it('un plan de paga del RPC gana aunque la lectura directa diga free — el creador puede administrar un workspace que no es el suyo', () => {
    // Antes de este arreglo, wsEncontrado ganaba siempre y esto daba 50:
    // un evento Agency creado por alguien cuyo workspace PERSONAL es free
    // quedaba topado por error.
    expect(resolverLimiteInvitados('agency', true, 'free', null)).toBeNull()
    expect(resolverLimiteInvitados('pro', true, 'free', 'fundador')).toBeNull()
  })

  it('la lectura directa desambigua un free del RPC (puede ser su default) cuando SI encuentra fila', () => {
    expect(resolverLimiteInvitados('free', true, 'pro', null)).toBeNull()
    expect(resolverLimiteInvitados(null, true, 'agency', null)).toBeNull()
  })

  it('la lectura directa confirma un free real: 50, o sin tope si trae el sello', () => {
    expect(resolverLimiteInvitados('free', true, 'free', null)).toBe(50)
    expect(resolverLimiteInvitados('free', true, 'free', 'fundador')).toBeNull()
  })

  it('el plan del RPC se normaliza antes de comparar: mayusculas, espacios o un valor desconocido no esquivan la ambiguedad de "free"', () => {
    expect(resolverLimiteInvitados('FREE', true, 'free', null)).toBe(50)
    expect(resolverLimiteInvitados(' Free ', true, 'pro', null)).toBeNull()
    expect(resolverLimiteInvitados('lo-que-sea', true, 'free', null)).toBe(50)
  })

  it('un free del RPC es ambiguo: sin lectura directa que lo confirme, no se confia — sin tope', () => {
    expect(resolverLimiteInvitados('free', false, null, null)).toBeNull()
  })

  it('sin ninguna fuente confiable, no se pudo verificar: sin tope', () => {
    expect(resolverLimiteInvitados(null, false, null, null)).toBeNull()
  })

  // Nota: no hay una prueba separada de "un plan de paga del RPC es
  // confiable sin lectura directa" — resolverLimiteInvitados(x, false, ...)
  // con x de paga y con x ambiguo dan el mismo numero (null), asi que esa
  // aserticion sola no distingue nada. La prueba que SI distingue de verdad
  // es la primera de este describe: ahi wsEncontrado es true con un plan
  // free en conflicto, y solo una implementacion que de verdad prioriza el
  // plan de paga del RPC (antes de mirar wsEncontrado) pasa esa prueba.
})

describe('resolverLimiteEventos: mismo camino que invitados, sin RPC de cuenta', () => {
  it('sin lectura directa, no se pudo verificar: sin tope (fail open)', () => {
    expect(resolverLimiteEventos(null, false, null, null)).toBeNull()
  })

  it('la lectura directa confirma un free real: 1 evento, o sin tope si trae el sello', () => {
    expect(resolverLimiteEventos(null, true, 'free', null)).toBe(1)
    expect(resolverLimiteEventos(null, true, 'free', 'fundador')).toBeNull()
  })

  it('la lectura directa trae un plan de paga: sin tope', () => {
    expect(resolverLimiteEventos(null, true, 'pro', null)).toBeNull()
    expect(resolverLimiteEventos(null, true, 'studio', null)).toBeNull()
  })

  it('un plan de paga confirmado por RPC manda igual que en invitados', () => {
    expect(resolverLimiteEventos('agency', true, 'free', null)).toBeNull()
  })
})
