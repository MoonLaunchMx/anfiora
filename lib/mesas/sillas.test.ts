import { describe, it, expect } from 'vitest'
import { sillasDe } from './sillas'

describe('sillasDe', () => {
  it('cada forma da exactamente una silla por lugar', () => {
    for (const shape of ['round', 'oval', 'rectangle', 'square', 'halfmoon', 'row', 'rara']) {
      for (const cap of [1, 2, 5, 8, 10, 13]) {
        expect(sillasDe(shape, cap).sillas).toHaveLength(cap)
      }
    }
  })
  it('las sillas caen dentro del dibujo', () => {
    for (const shape of ['round', 'oval', 'rectangle', 'square', 'halfmoon', 'row']) {
      const d = sillasDe(shape, 10)
      for (const s of d.sillas) {
        expect(s.x).toBeGreaterThanOrEqual(-1)
        expect(s.y).toBeGreaterThanOrEqual(-1)
        expect(s.x).toBeLessThanOrEqual(d.w + 1)
        expect(s.y).toBeLessThanOrEqual(d.h + 1)
      }
    }
  })
  it('la redonda de 8 mide lo mismo que el SVG de siempre', () => {
    const d = sillasDe('round', 8)
    expect(d.w).toBe(122)
    expect(d.sillas[0]).toEqual({ x: 61, y: 61 - 48 })
  })
})
