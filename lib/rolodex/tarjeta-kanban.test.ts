import { describe, it, expect } from 'vitest'
import { dineroDeTarjeta } from './tarjeta-kanban'

describe('dineroDeTarjeta', () => {
  it('descartado siempre trae su motivo, sin importar los montos', () => {
    expect(dineroDeTarjeta({ status: 'descartado', contract_amount: 5000, quoted_amount: 4000 }, 1000, 'precio'))
      .toEqual({ tipo: 'descarte', motivo: 'precio' })
  })

  it('descartado sin motivo registrado igual trae el tipo descarte', () => {
    expect(dineroDeTarjeta({ status: 'descartado', contract_amount: null, quoted_amount: null }, 0, null))
      .toEqual({ tipo: 'descarte', motivo: null })
  })

  it('con contrato manda contratado y pagado, aunque tambien haya cotizado', () => {
    expect(dineroDeTarjeta({ status: 'contratado', contract_amount: 8000, quoted_amount: 7500 }, 3000, null))
      .toEqual({ tipo: 'contratado', contratado: 8000, pagado: 3000 })
  })

  it('sin contrato pero con cotizacion manda cotizado', () => {
    expect(dineroDeTarjeta({ status: 'cotizado', contract_amount: null, quoted_amount: 4200 }, 0, null))
      .toEqual({ tipo: 'cotizado', cotizado: 4200 })
  })

  it('sin ningun monto no hay nada que mostrar', () => {
    expect(dineroDeTarjeta({ status: 'nuevo', contract_amount: null, quoted_amount: null }, 0, null))
      .toEqual({ tipo: 'ninguno' })
  })
})
