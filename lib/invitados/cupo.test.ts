import { describe, it, expect } from 'vitest'
import {
  contarPersonas, lugaresLibres, bloqueaPorTope, borrarPrimero, cuantasFilasCaben,
  parseErrorInvitados, esErrorDeInvitados,
} from './cupo'

describe('cupo de invitados', () => {
  it('cuenta invitados mas acompanantes', () => {
    expect(contarPersonas(40, 12)).toBe(52)
    expect(contarPersonas(0, 0)).toBe(0)
  })

  it('sin limite siempre hay lugar', () => {
    expect(lugaresLibres(500, null)).toBeNull()
  })

  it('calcula lugares libres sin bajar de cero', () => {
    expect(lugaresLibres(32, 50)).toBe(18)
    expect(lugaresLibres(50, 50)).toBe(0)
    expect(lugaresLibres(213, 50)).toBe(0)
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

  it('cuenta exactamente en el tope: cambiar un acompanante por otro borra primero y cabe', () => {
    // 50 de 50: borrar 1 y agregar 1 deja 50-1+1=50, que SI cabe (<=50), asi
    // que borra primero: baja a 49 y sube a 50 sin rebasar nunca el limite
    // ni ver el muro.
    expect(borrarPrimero(50, 1, 1, 50)).toBe(true)
  })

  it('cuenta muy pasada del tope: quitar 5 y agregar 1 NO cabe, aunque no crezca', () => {
    // 213 con tope 50: 213-5+1=209, sigue arriba de 50. Borrar primero
    // dejaria el total en 209 igual de rechazado, y la restauracion (otro
    // insert) se rechazaria por lo mismo -- perdiendo los 5 para siempre.
    // La regla correcta manda insertar primero: falla sin haber borrado
    // nada, y el aviso de tope es honesto porque esa cuenta de verdad no
    // puede hacer este intercambio en ningun orden mientras siga tan arriba.
    expect(borrarPrimero(213, 5, 1, 50)).toBe(false)
  })

  it('achicar (se borra mas de lo que se inserta) y cabe: borra primero', () => {
    expect(borrarPrimero(52, 3, 1, 50)).toBe(true) // 52-3+1=50, cabe justo
    expect(borrarPrimero(40, 2, 0, 50)).toBe(true)
  })

  it('crecer y cabe: tambien borra primero (no hay riesgo)', () => {
    expect(borrarPrimero(40, 0, 5, 50)).toBe(true) // 40-0+5=45, cabe
  })

  it('crecer y no cabe: inserta primero, bloqueaPorTope ya lo hubiera frenado', () => {
    expect(borrarPrimero(48, 0, 5, 50)).toBe(false) // 48-0+5=53, no cabe
  })

  it('sin tope, siempre borra primero (nunca hay riesgo de rechazo)', () => {
    expect(borrarPrimero(500, 5, 50, null)).toBe(true)
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

  it('sin lugares libres, no cabe ni una fila', () => {
    expect(cuantasFilasCaben([3, 3, 3], 50, 50)).toEqual({ filas: 0, personasImportadas: 0, personasFuera: 9 })
    // cuenta ya pasada del tope: tambien cero, nunca negativo
    expect(cuantasFilasCaben([1, 2, 3], 213, 50)).toEqual({ filas: 0, personasImportadas: 0, personasFuera: 6 })
  })

  it('cuando el total cae exacto en el tope, todas las filas que ajustan pasan', () => {
    // 9 lugares libres, tres filas de 3: la suma da justo 9, ninguna se corta
    expect(cuantasFilasCaben([3, 3, 3], 41, 50)).toEqual({ filas: 3, personasImportadas: 9, personasFuera: 0 })
    // una fila mas, ya no cabe: la igualdad exacta no se rompe por el vecino
    expect(cuantasFilasCaben([3, 3, 3, 1], 41, 50)).toEqual({ filas: 3, personasImportadas: 9, personasFuera: 1 })
  })
})
