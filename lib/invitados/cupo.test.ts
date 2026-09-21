import { describe, it, expect } from 'vitest'
import {
  contarPersonas, lugaresLibres, cuantasCaben,
  parseErrorInvitados, esErrorDeInvitados,
} from './cupo'

describe('cupo de invitados', () => {
  it('cuenta invitados mas acompanantes', () => {
    expect(contarPersonas(40, 12)).toBe(52)
    expect(contarPersonas(0, 0)).toBe(0)
  })

  it('sin limite siempre hay lugar', () => {
    expect(lugaresLibres(500, null)).toBeNull()
    expect(cuantasCaben(200, 500, null)).toEqual({ caben: 200, sobran: 0 })
  })

  it('calcula lugares libres sin bajar de cero', () => {
    expect(lugaresLibres(32, 50)).toBe(18)
    expect(lugaresLibres(50, 50)).toBe(0)
    expect(lugaresLibres(213, 50)).toBe(0)
  })

  it('corta la importacion a lo que cabe', () => {
    expect(cuantasCaben(200, 32, 50)).toEqual({ caben: 18, sobran: 182 })
    expect(cuantasCaben(5, 45, 50)).toEqual({ caben: 5, sobran: 0 })
    expect(cuantasCaben(5, 50, 50)).toEqual({ caben: 0, sobran: 5 })
    expect(cuantasCaben(1, 49, 50)).toEqual({ caben: 1, sobran: 0 })
  })

  it('lee el error de la base', () => {
    expect(parseErrorInvitados('INVITADOS_LIMITE:51:50')).toEqual({ personas: 51, limite: 50 })
    expect(parseErrorInvitados('otra cosa')).toBeNull()
    expect(esErrorDeInvitados({ message: 'x INVITADOS_LIMITE:51:50 y' })).toBe(true)
    expect(esErrorDeInvitados(null)).toBe(false)
  })
})
