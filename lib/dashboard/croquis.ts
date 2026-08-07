import type { MesaCroquis } from './types'

// Mismas medidas que el editor de mesas: si aqui midieran distinto, el croquis
// del dashboard mostraria un acomodo que no es el que el planner armo.
const RADIO_SILLA = 7
const SEPARACION = 22
const ORILLA = RADIO_SILLA + 10

export function dimensionesMesa(forma: string | null, capacidad: number): { w: number; h: number } {
  const cap = Math.max(1, capacidad)
  switch (forma) {
    case 'oval': {
      const ancho = Math.max(90, Math.ceil(cap / 2) * SEPARACION + 24)
      return { w: ancho + ORILLA * 2, h: 70 + ORILLA * 2 }
    }
    case 'rectangle': {
      const arriba = Math.ceil(cap / 2)
      const ancho = Math.max(80, arriba * SEPARACION + 20)
      return { w: ancho + ORILLA * 2, h: 44 + ORILLA * 2 + RADIO_SILLA * 2 }
    }
    case 'square': {
      const lado = Math.ceil(cap / 4)
      const ancho = Math.max(60, lado * SEPARACION + 20)
      return { w: ancho + ORILLA * 2, h: ancho + ORILLA * 2 }
    }
    case 'halfmoon': {
      const ancho = Math.max(80, cap * SEPARACION + 20)
      return { w: ancho, h: ancho / 2 + ORILLA + RADIO_SILLA }
    }
    case 'row':
      return { w: cap * SEPARACION + ORILLA, h: RADIO_SILLA * 2 + 16 }
    default: {
      const radio = Math.max(28, Math.min(44, 20 + cap * 2))
      const orbita = radio + RADIO_SILLA + 5
      const lado = (orbita + RADIO_SILLA + 6) * 2
      return { w: lado, h: lado }
    }
  }
}

// Una mesa que nunca se arrastro llega en 0,0. El editor las reparte en una
// cuadricula de cuatro columnas; aqui se repite para que el croquis no las
// encime todas en la esquina.
export function posicionMesa(
  t: { position_x: number | null; position_y: number | null },
  indice: number,
): { x: number; y: number } {
  const x = t.position_x ?? 0
  const y = t.position_y ?? 0
  if (x !== 0 || y !== 0) return { x, y }
  return { x: 80 + (indice % 4) * 240, y: 80 + Math.floor(indice / 4) * 240 }
}

export type Encuadre = { x: number; y: number; ancho: number; alto: number }

// La caja del croquis que engloba todas las mesas, con un margen. Se usa como
// viewBox del SVG: asi el dibujo se estira con la tarjeta sin recalcular nada.
export function encuadre(mesas: MesaCroquis[], margen = 40): Encuadre {
  if (mesas.length === 0) return { x: 0, y: 0, ancho: 100, alto: 100 }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const m of mesas) {
    const { w, h } = dimensionesMesa(m.forma, m.capacidad)
    minX = Math.min(minX, m.x)
    minY = Math.min(minY, m.y)
    maxX = Math.max(maxX, m.x + w)
    maxY = Math.max(maxY, m.y + h)
  }

  return {
    x: minX - margen,
    y: minY - margen,
    ancho: Math.max(1, maxX - minX + margen * 2),
    alto: Math.max(1, maxY - minY + margen * 2),
  }
}
