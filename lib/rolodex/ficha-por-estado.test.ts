import { describe, it, expect } from 'vitest'
import { carpetasDe, destinosDe, pasosAlcanzados, CAMINO, QUE_SIGNIFICA } from './ficha-por-estado'

describe('carpetasDe', () => {
  it('a un proveedor recien capturado solo se le pregunta el contacto', () => {
    expect(carpetasDe('nuevo', false)).toEqual(['Contacto'])
  })

  it('la cotizacion aparece cuando ya te cotizo', () => {
    expect(carpetasDe('cotizado', false)).toEqual(['Contacto', 'Cotización'])
  })

  it('los pagos solo existen con algo contratado', () => {
    expect(carpetasDe('cotizado', false)).not.toContain('Pagos')
    expect(carpetasDe('contratado', false)).toContain('Pagos')
  })

  it('la resena solo aparece cuando la boda ya paso', () => {
    expect(carpetasDe('contratado', false)).not.toContain('Reseña')
    expect(carpetasDe('contratado', true)).toContain('Reseña')
  })

  it('un descartado no tiene cotizacion ni pagos, tiene motivo', () => {
    expect(carpetasDe('descartado', true)).toEqual(['Contacto', 'Motivo'])
  })

  it('contacto siempre va primero', () => {
    for (const estado of ['nuevo', 'cotizado', 'contratado', 'descartado'] as const) {
      expect(carpetasDe(estado, true)[0]).toBe('Contacto')
    }
  })
})

describe('destinosDe', () => {
  it('nunca se ofrece el estado en el que ya estas', () => {
    for (const estado of ['nuevo', 'cotizado', 'contratado', 'descartado'] as const) {
      expect(destinosDe(estado)).not.toContain(estado)
    }
  })

  it('siempre deja a donde ir', () => {
    for (const estado of ['nuevo', 'cotizado', 'contratado', 'descartado'] as const) {
      expect(destinosDe(estado).length).toBe(3)
    }
  })

  it('respeta el orden del camino y deja descartado al final', () => {
    expect(destinosDe('nuevo')).toEqual(['cotizado', 'contratado', 'descartado'])
    expect(destinosDe('contratado')).toEqual(['nuevo', 'cotizado', 'descartado'])
  })

  it('desde descartado se puede volver a cualquier paso del camino', () => {
    expect(destinosDe('descartado')).toEqual(CAMINO)
  })

  it('cada destino sabe explicarse', () => {
    for (const estado of destinosDe('nuevo')) {
      expect(QUE_SIGNIFICA[estado].length).toBeGreaterThan(0)
    }
  })
})

describe('pasosAlcanzados', () => {
  it('marca el paso en el que estas y los anteriores', () => {
    expect(pasosAlcanzados('nuevo')).toEqual(['nuevo'])
    expect(pasosAlcanzados('cotizado')).toEqual(['nuevo', 'cotizado'])
    expect(pasosAlcanzados('contratado')).toEqual(['nuevo', 'cotizado', 'contratado'])
  })

  // Descartar es salirse del camino: no se palomea lo que no se termino.
  it('un descartado no tiene pasos alcanzados', () => {
    expect(pasosAlcanzados('descartado')).toEqual([])
  })
})
