import { describe, it, expect } from 'vitest'
import { dineroDeTarjeta } from './tarjeta-kanban'

describe('dineroDeTarjeta', () => {
  it('un descartado solo muestra por que se cayo, aunque tenga dinero', () => {
    expect(dineroDeTarjeta({ status: 'descartado', quoted_amount: 4000 }, 5000, 1000, 'precio'))
      .toEqual({ tipo: 'descarte', motivo: 'precio' })
  })

  it('un descartado sin motivo sigue siendo descarte', () => {
    expect(dineroDeTarjeta({ status: 'descartado', quoted_amount: null }, null, 0, null))
      .toEqual({ tipo: 'descarte', motivo: null })
  })

  it('con contrato (la suma de sus partidas) muestra contratado y pagado', () => {
    expect(dineroDeTarjeta({ status: 'contratado', quoted_amount: 7500 }, 8000, 3000, null))
      .toEqual({ tipo: 'contratado', contratado: 8000, pagado: 3000 })
  })

  it('contratado sin partidas todavia cae a lo cotizado: el contrato aun no tiene donde vivir', () => {
    expect(dineroDeTarjeta({ status: 'contratado', quoted_amount: 7500 }, null, 0, null))
      .toEqual({ tipo: 'cotizado', cotizado: 7500 })
  })

  it('sin contrato pero con cotizacion muestra cotizado', () => {
    expect(dineroDeTarjeta({ status: 'cotizado', quoted_amount: 4200 }, null, 0, null))
      .toEqual({ tipo: 'cotizado', cotizado: 4200 })
  })

  it('sin nada, ninguno', () => {
    expect(dineroDeTarjeta({ status: 'nuevo', quoted_amount: null }, null, 0, null))
      .toEqual({ tipo: 'ninguno' })
  })
})
