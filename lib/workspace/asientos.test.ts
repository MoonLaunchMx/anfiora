import { describe, it, expect } from 'vitest'
import {
  contarAsientos, asientosExtra, costoAsientosExtra, puedeInvitar, resumenAsientos,
} from './asientos'

const m = (status: string) => ({ status })

describe('asientos', () => {
  it('cuenta pendientes y activos, no revocados', () => {
    expect(contarAsientos([m('active'), m('pending'), m('revoked')])).toBe(2)
    expect(contarAsientos([])).toBe(0)
  })

  it('extra y costo por plan', () => {
    expect(asientosExtra('pro', 1)).toBe(0)
    expect(asientosExtra('pro', 3)).toBe(2)
    expect(asientosExtra('agency', 3)).toBe(0)
    expect(asientosExtra('agency', 5)).toBe(2)
    expect(costoAsientosExtra('pro', 3)).toBe(580)
    expect(costoAsientosExtra('agency', 3)).toBe(0)
  })

  it('Free no invita equipo', () => {
    expect(puedeInvitar('free', 1)).toEqual({ ok: false, motivo: 'plan', costoNuevoAsiento: 0 })
  })

  it('Pro invita; el segundo asiento cuesta', () => {
    expect(puedeInvitar('pro', 1)).toEqual({ ok: true, motivo: null, costoNuevoAsiento: 290 })
    expect(puedeInvitar('pro', 0)).toEqual({ ok: true, motivo: null, costoNuevoAsiento: 0 })
  })

  it('Agency: los tres primeros gratis', () => {
    expect(puedeInvitar('agency', 2).costoNuevoAsiento).toBe(0)
    expect(puedeInvitar('agency', 3).costoNuevoAsiento).toBe(290)
  })

  it('resumen para la pantalla', () => {
    expect(resumenAsientos('pro', [m('active'), m('active'), m('pending'), m('revoked')]))
      .toEqual({ ocupados: 3, incluidos: 1, extra: 2, costoExtraMensual: 580 })
  })
})
