import { describe, it, expect } from 'vitest'
import { evaluarCandado } from './candado'

const BASE = {
  reviewExiste: true,
  tipoReview: 'post_evento' as const,
  fechaEvento: '2026-01-01',
  puedeSaltarlo: false,
}

describe('evaluarCandado', () => {
  it('nunca bloquea crear: sin review existente no hay candado aunque hayan pasado meses', () => {
    const r = evaluarCandado({ ...BASE, reviewExiste: false, ahora: new Date('2026-06-01T12:00:00') })
    expect(r.bloqueado).toBe(false)
  })

  it('dentro de la ventana de 15 dias sigue abierta', () => {
    const r = evaluarCandado({ ...BASE, ahora: new Date('2026-01-10T12:00:00') })
    expect(r.bloqueado).toBe(false)
  })

  it('el dia 15 exacto todavia esta abierta', () => {
    const r = evaluarCandado({ ...BASE, ahora: new Date('2026-01-16T23:59:00') })
    expect(r.bloqueado).toBe(false)
  })

  it('el dia 16 ya esta cerrada', () => {
    const r = evaluarCandado({ ...BASE, ahora: new Date('2026-01-17T00:01:00') })
    expect(r.bloqueado).toBe(true)
    expect(r.razon).toContain('administrador')
  })

  it('contratacion y descarte nunca se bloquean, sin importar la fecha', () => {
    const contratacion = evaluarCandado({ ...BASE, tipoReview: 'contratacion', ahora: new Date('2027-01-01') })
    const descarte = evaluarCandado({ ...BASE, tipoReview: 'descarte', ahora: new Date('2027-01-01') })
    expect(contratacion.bloqueado).toBe(false)
    expect(descarte.bloqueado).toBe(false)
  })

  it('un evento sin fecha nunca se bloquea', () => {
    const r = evaluarCandado({ ...BASE, fechaEvento: null, ahora: new Date('2027-01-01') })
    expect(r.bloqueado).toBe(false)
  })

  it('dueno o admin pasan sin friccion aunque este cerrada', () => {
    const r = evaluarCandado({ ...BASE, puedeSaltarlo: true, ahora: new Date('2027-01-01') })
    expect(r.bloqueado).toBe(false)
  })
})
