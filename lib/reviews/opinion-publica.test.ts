import { describe, it, expect } from 'vitest'
import { parseRespuestaCliente } from './opinion-publica'

const completa = {
  event_supplier_id: '11111111-1111-1111-1111-111111111111',
  precio_valor: 4, calidad: 5, comunicacion: 4, servicio_trato: 5, manejo_imprevistos: null,
  recontratacion: 5, cobros_extra: false, monto_cobros_extra: null, comentarios: '  Excelente  ',
}

describe('parseRespuestaCliente', () => {
  it('acepta una respuesta completa y limpia los comentarios', () => {
    const r = parseRespuestaCliente(completa)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos.comentarios).toBe('Excelente')
  })
  it('manejo_imprevistos puede venir null (no hubo imprevistos)', () => {
    expect(parseRespuestaCliente({ ...completa, manejo_imprevistos: null }).ok).toBe(true)
  })
  it('rechaza sin event_supplier_id', () => {
    const r = parseRespuestaCliente({ ...completa, event_supplier_id: '' })
    expect(r.ok).toBe(false)
  })
  it('rechaza ejes fuera de 1..5 o no numericos', () => {
    expect(parseRespuestaCliente({ ...completa, calidad: 6 }).ok).toBe(false)
    expect(parseRespuestaCliente({ ...completa, calidad: 'cinco' }).ok).toBe(false)
  })
  it('la recomendacion es lo unico obligatorio', () => {
    const r = parseRespuestaCliente({ ...completa, recontratacion: null })
    expect(r.ok).toBe(false)
  })

  it('acepta solo la recomendacion: los cinco ejes y los cobros pueden ir vacios', () => {
    const r = parseRespuestaCliente({
      event_supplier_id: '11111111-1111-1111-1111-111111111111',
      precio_valor: null, calidad: null, comunicacion: null, servicio_trato: null, manejo_imprevistos: null,
      recontratacion: 4, cobros_extra: null, monto_cobros_extra: null, comentarios: null,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.datos.recontratacion).toBe(4)
      expect(r.datos.calidad).toBeNull()
      expect(r.datos.cobros_extra).toBeNull()
    }
  })
  it('el monto solo cuenta si hubo cobros extra', () => {
    const r = parseRespuestaCliente({ ...completa, cobros_extra: false, monto_cobros_extra: 500 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos.monto_cobros_extra).toBeNull()
  })
  it('basura no truena', () => {
    expect(parseRespuestaCliente(null).ok).toBe(false)
    expect(parseRespuestaCliente('x').ok).toBe(false)
  })
})
