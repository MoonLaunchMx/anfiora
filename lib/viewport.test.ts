import { describe, expect, it } from 'vitest'
import { MODAL_HEIGHT_RATIO, panelMaxHeight, visualRect } from './viewport'

describe('visualRect', () => {
  const pantalla = { width: 390, height: 663 }

  it('sin visualViewport devuelve la pantalla completa', () => {
    expect(visualRect(null, pantalla)).toEqual({ top: 0, left: 0, width: 390, height: 663 })
  })

  it('con el teclado abierto devuelve solo la franja visible', () => {
    // Medido en un iPhone 13 Pro: la pantalla de layout no encoge (663) y el
    // teclado deja 395 visibles arrancando 268 mas abajo.
    expect(visualRect({ offsetTop: 268, offsetLeft: 0, width: 390, height: 395 }, pantalla)).toEqual(
      { top: 268, left: 0, width: 390, height: 395 }
    )
  })

  it('ignora el rebote de iOS que reporta un desplazamiento negativo', () => {
    expect(visualRect({ offsetTop: -63, offsetLeft: 0, width: 390, height: 395 }, pantalla)).toEqual(
      { top: 0, left: 0, width: 390, height: 395 }
    )
  })

  it('cae a la pantalla completa si la medida no es utilizable', () => {
    expect(visualRect({ offsetTop: 0, offsetLeft: 0, width: 390, height: 0 }, pantalla)).toEqual({
      top: 0,
      left: 0,
      width: 390,
      height: 663,
    })
    expect(visualRect({ offsetTop: 0, offsetLeft: 0, width: 0, height: NaN }, pantalla)).toEqual({
      top: 0,
      left: 0,
      width: 390,
      height: 663,
    })
  })

  it('redondea para no producir medios pixeles', () => {
    expect(
      visualRect({ offsetTop: 267.6, offsetLeft: 0.4, width: 390.2, height: 395.5 }, pantalla)
    ).toEqual({ top: 268, left: 0, width: 390, height: 396 })
  })
})

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
