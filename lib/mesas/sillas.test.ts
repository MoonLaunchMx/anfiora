import { describe, it, expect } from 'vitest'
import { sillasDe, FORMAS, SIN_SILLAS } from './sillas'

describe('sillasDe', () => {
  it('cada forma con sillas da exactamente una silla por lugar', () => {
    for (const shape of FORMAS.filter(f => !SIN_SILLAS.has(f))) {
      for (const cap of [1, 2, 5, 8, 10, 13, 24]) {
        expect(sillasDe(shape, cap).sillas, shape + ' ' + cap).toHaveLength(cap)
      }
    }
  })
  it('coctel no tiene sillas pero si dibujo', () => {
    const d = sillasDe('coctel', 30)
    expect(d.sillas).toHaveLength(0)
    expect(d.cuerpo.tipo).toBe('coctel')
    expect(d.w).toBeGreaterThan(0)
  })
  it('las sillas caen dentro del dibujo', () => {
    for (const shape of FORMAS) {
      const d = sillasDe(shape, 12)
      for (const s of d.sillas) {
        expect(s.x, shape).toBeGreaterThanOrEqual(-1)
        expect(s.y, shape).toBeGreaterThanOrEqual(-1)
        expect(s.x, shape).toBeLessThanOrEqual(d.w + 1)
        expect(s.y, shape).toBeLessThanOrEqual(d.h + 1)
      }
    }
  })
  it('una forma desconocida se dibuja redonda', () => {
    expect(sillasDe('rara', 8).cuerpo.tipo).toBe('circulo')
  })
  it('la redonda de 8 mide lo mismo que el SVG de siempre', () => {
    const d = sillasDe('round', 8)
    expect(d.w).toBe(122)
    expect(d.sillas[0]).toEqual({ x: 61, y: 61 - 48 })
  })
})
