import { describe, it, expect } from 'vitest'
import { dimensionesMesa, encuadre, posicionMesa } from './croquis'
import type { MesaCroquis } from './types'

function mesa(over: Partial<MesaCroquis> = {}): MesaCroquis {
  return {
    id: 'm1', numero: 1, nombre: null, forma: 'round', rotacion: 0,
    x: 0, y: 0, capacidad: 10, ocupados: 0,
    ...over,
  }
}

describe('dimensionesMesa', () => {
  it('una mesa redonda es cuadrada en su caja', () => {
    const d = dimensionesMesa('round', 10)
    expect(d.w).toBe(d.h)
  })

  it('mas sillas hacen la mesa mas grande, hasta un tope', () => {
    expect(dimensionesMesa('round', 12).w).toBeGreaterThan(dimensionesMesa('round', 4).w)
    expect(dimensionesMesa('round', 40).w).toBe(dimensionesMesa('round', 24).w)
  })

  it('una rectangular es mas ancha que alta', () => {
    const d = dimensionesMesa('rectangle', 12)
    expect(d.w).toBeGreaterThan(d.h)
  })

  it('una forma desconocida cae a redonda en vez de medir cero', () => {
    expect(dimensionesMesa('inventada', 10)).toEqual(dimensionesMesa('round', 10))
    expect(dimensionesMesa(null, 10)).toEqual(dimensionesMesa('round', 10))
  })

  it('capacidad cero no colapsa la mesa', () => {
    expect(dimensionesMesa('round', 0).w).toBeGreaterThan(0)
  })
})

describe('posicionMesa', () => {
  it('respeta la posicion que el planner dejo', () => {
    expect(posicionMesa({ position_x: 320, position_y: 140 }, 0)).toEqual({ x: 320, y: 140 })
  })

  it('una mesa nunca movida se reparte en cuadricula, no en la esquina', () => {
    const a = posicionMesa({ position_x: 0, position_y: 0 }, 0)
    const b = posicionMesa({ position_x: 0, position_y: 0 }, 1)
    expect(a).not.toEqual(b)
  })

  it('la quinta sin mover baja de renglon', () => {
    const cuarta = posicionMesa({ position_x: 0, position_y: 0 }, 3)
    const quinta = posicionMesa({ position_x: 0, position_y: 0 }, 4)
    expect(quinta.y).toBeGreaterThan(cuarta.y)
    expect(quinta.x).toBeLessThan(cuarta.x)
  })

  it('sin posicion guardada se trata como nunca movida', () => {
    expect(posicionMesa({ position_x: null, position_y: null }, 0))
      .toEqual(posicionMesa({ position_x: 0, position_y: 0 }, 0))
  })
})

describe('encuadre', () => {
  it('sin mesas devuelve una caja usable, no una de tamano cero', () => {
    const e = encuadre([])
    expect(e.ancho).toBeGreaterThan(0)
    expect(e.alto).toBeGreaterThan(0)
  })

  it('mete todas las mesas dentro de la caja', () => {
    const mesas = [mesa({ x: 100, y: 100 }), mesa({ id: 'm2', x: 600, y: 400 })]
    const e = encuadre(mesas)
    for (const m of mesas) {
      const d = dimensionesMesa(m.forma, m.capacidad)
      expect(m.x).toBeGreaterThanOrEqual(e.x)
      expect(m.y).toBeGreaterThanOrEqual(e.y)
      expect(m.x + d.w).toBeLessThanOrEqual(e.x + e.ancho)
      expect(m.y + d.h).toBeLessThanOrEqual(e.y + e.alto)
    }
  })

  it('deja margen alrededor para que la mesa no toque el borde', () => {
    const e = encuadre([mesa({ x: 200, y: 200 })], 40)
    expect(e.x).toBe(160)
    expect(e.y).toBe(160)
  })

  it('posiciones negativas no rompen el encuadre', () => {
    const e = encuadre([mesa({ x: -300, y: -120 })])
    expect(e.x).toBeLessThan(-300)
    expect(e.ancho).toBeGreaterThan(0)
  })
})
