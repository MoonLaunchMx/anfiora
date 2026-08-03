import { describe, expect, it } from 'vitest'
import { MODAL_HEIGHT_RATIO, panelMaxHeight } from './viewport'

describe('panelMaxHeight', () => {
  it('toma el 92% del alto visible por defecto', () => {
    expect(panelMaxHeight(1000)).toBe(920)
  })

  it('respeta un ratio explicito', () => {
    expect(panelMaxHeight(1000, 0.5)).toBe(500)
  })

  it('redondea a entero para no producir medios pixeles', () => {
    expect(panelMaxHeight(667)).toBe(614)
  })

  it('nunca devuelve negativo si el teclado deja cero espacio', () => {
    expect(panelMaxHeight(0)).toBe(0)
    expect(panelMaxHeight(-50)).toBe(0)
  })

  it('sostiene un minimo usable cuando el teclado casi no deja lugar', () => {
    expect(panelMaxHeight(180)).toBe(180)
  })

  it('expone el ratio como constante', () => {
    expect(MODAL_HEIGHT_RATIO).toBe(0.92)
  })
})
