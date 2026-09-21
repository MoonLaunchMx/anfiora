import { describe, it, expect } from 'vitest'
import {
  contarPersonas, lugaresLibres, cuantasCaben, bloqueaPorTope, cuantasFilasCaben,
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

  it('una cuenta ya pasada del tope puede intercambiar o achicar sin bloquear', () => {
    // 213 personas, tope 50: quitar 5 y agregar 1 la deja en 209, sigue arriba
    // del tope pero NO crecio -> nunca se bloquea
    expect(bloqueaPorTope(213, 209, 50)).toBe(false)
    // se queda igual
    expect(bloqueaPorTope(213, 213, 50)).toBe(false)
    // crecer aunque sea 1 mas, estando ya pasada del tope, si se bloquea
    expect(bloqueaPorTope(213, 214, 50)).toBe(true)
  })

  it('bloquea solo cuando crece mas alla del tope', () => {
    expect(bloqueaPorTope(40, 45, 50)).toBe(false)  // crece pero sigue dentro
    expect(bloqueaPorTope(48, 51, 50)).toBe(true)   // crece y cruza el tope
    expect(bloqueaPorTope(500, 600, null)).toBe(false) // sin tope nunca bloquea
  })

  it('recorta filas completas de la importacion, nunca a la mitad', () => {
    // 18 lugares libres, filas de 3 personas (1 invitado + 2 acompanantes)
    const tamanos = Array(200).fill(3)
    expect(cuantasFilasCaben(tamanos, 32, 50)).toEqual({ filas: 6, personasImportadas: 18, personasFuera: 582 })
  })

  it('una fila que no cabe entera se queda fuera junto con las que siguen', () => {
    // 5 lugares libres: 1+1+1 caben (3), la de 5 ya no (3+5=8>5), la ultima ni se intenta
    expect(cuantasFilasCaben([1, 1, 1, 5, 1], 45, 50)).toEqual({ filas: 3, personasImportadas: 3, personasFuera: 6 })
  })

  it('sin tope, todas las filas caben', () => {
    expect(cuantasFilasCaben([3, 3, 3], 500, null)).toEqual({ filas: 3, personasImportadas: 9, personasFuera: 0 })
  })
})
