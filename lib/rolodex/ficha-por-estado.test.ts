import { describe, it, expect } from 'vitest'
import { carpetasDe, accionesDe } from './ficha-por-estado'

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

describe('accionesDe', () => {
  const textos = (estado: Parameters<typeof accionesDe>[0], paso: boolean) =>
    accionesDe(estado, paso).filter(a => !a.separador).map(a => a.texto)

  it('siempre ofrece al menos una accion', () => {
    for (const estado of ['nuevo', 'cotizado', 'contratado', 'descartado'] as const) {
      expect(textos(estado, false).length).toBeGreaterThan(0)
    }
  })

  it('la primera accion es la que mueve el trato hacia adelante', () => {
    expect(textos('nuevo', false)[0]).toBe('Ya me cotizó')
    expect(textos('cotizado', false)[0]).toBe('Contratar')
    expect(textos('descartado', false)[0]).toBe('Recuperar')
  })

  it('descartar se ofrece mientras el trato siga vivo', () => {
    expect(textos('nuevo', false)).toContain('Descartar')
    expect(textos('cotizado', false)).toContain('Descartar')
    expect(textos('contratado', false)).not.toContain('Descartar')
  })

  it('calificar solo se ofrece cuando la boda ya paso', () => {
    expect(textos('contratado', false)).not.toContain('Calificar')
    expect(textos('contratado', true)).toContain('Calificar')
  })

  it('las que mueven el trato traen su estado nuevo; las demas no', () => {
    const contratar = accionesDe('cotizado', false).find(a => a.texto === 'Contratar')
    expect(contratar?.nuevoEstado).toBe('contratado')
    const pago = accionesDe('contratado', false).find(a => a.texto === 'Registrar un pago')
    expect(pago?.nuevoEstado).toBeUndefined()
  })

  it('deshacer el contrato regresa a cotizado, no a nuevo', () => {
    const deshacer = accionesDe('contratado', false).find(a => a.texto === 'Deshacer contrato')
    expect(deshacer?.nuevoEstado).toBe('cotizado')
  })

  it('nunca deja dos separadores juntos ni uno al final', () => {
    for (const estado of ['nuevo', 'cotizado', 'contratado', 'descartado'] as const) {
      for (const paso of [true, false]) {
        const lista = accionesDe(estado, paso)
        expect(lista[lista.length - 1].separador).toBeFalsy()
        lista.forEach((a, i) => {
          if (a.separador) expect(lista[i + 1]?.separador).toBeFalsy()
        })
      }
    }
  })
})
