import { describe, it, expect } from 'vitest'
import { computeSalud, computeChipDeuda, haceCuanto, sumaPorMoneda } from './salud'
import type { EventMetrics } from './types'

function m(over: Record<string, unknown> = {}): EventMetrics {
  return {
    event: {
      id: 'e1', name: 'X', event_date: '2026-11-14', event_end_date: null, event_time: null,
      event_type: 'boda', event_status: 'active', venue: null, total_guests: 0,
      currency: 'MXN', guest_cap: null, is_shared: false, shared_role: null, owner_name: null,
    },
    invitados: { total: 0, confirmados: 0, pendientes: 0, declinados: 0, pctConfirmado: 0, atencion: 0 },
    dinero: { estimado: 0, contratado: 0, pagado: 0, porPagar: 0, sinContratar: 0, excedido: false, pctContratado: 0 },
    proveedores: { total: 0, contratados: 0, cotizados: 0, nuevos: 0 },
    tareas: { vencidas: 0, hoy: 0, proximas: 0, bloqueantesVencidas: 0 },
    regalos: { recibido: 0, apartados: 0, totalItems: 0 },
    mesas: { mesas: 0, conGente: 0, conLugar: 0, sinLugar: 0, sillasLibres: 0 },
    invitacion: 'publicada',
    proximaTarea: null,
    proveedorConSaldo: null,
    ...over,
  } as EventMetrics
}

describe('computeSalud', () => {
  it('sin datos cada barra queda vacia', () => {
    const s = computeSalud(m())
    expect([s.invitados, s.dinero, s.logistica, s.tareas]).toEqual(['vacio', 'vacio', 'vacio', 'vacio'])
  })

  it('invitados: 70 por ciento o mas es ok, 40 a 69 aviso, menos alerta', () => {
    expect(computeSalud(m({ invitados: { total: 10, confirmados: 7, pendientes: 3, declinados: 0, pctConfirmado: 70, atencion: 0 } })).invitados).toBe('ok')
    expect(computeSalud(m({ invitados: { total: 10, confirmados: 5, pendientes: 5, declinados: 0, pctConfirmado: 50, atencion: 0 } })).invitados).toBe('aviso')
    expect(computeSalud(m({ invitados: { total: 10, confirmados: 2, pendientes: 8, declinados: 0, pctConfirmado: 20, atencion: 0 } })).invitados).toBe('alerta')
  })

  it('dinero: excedido es alerta', () => {
    expect(computeSalud(m({ dinero: { estimado: 100, contratado: 120, pagado: 0, porPagar: 120, sinContratar: 0, excedido: true, pctContratado: 120 } })).dinero).toBe('alerta')
  })

  it('dinero: arriba de 90 por ciento contratado es aviso', () => {
    expect(computeSalud(m({ dinero: { estimado: 100, contratado: 95, pagado: 0, porPagar: 95, sinContratar: 5, excedido: false, pctContratado: 95 } })).dinero).toBe('aviso')
  })

  it('tareas: una vencida es alerta, una de hoy es aviso', () => {
    expect(computeSalud(m({ tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 0 } })).tareas).toBe('alerta')
    expect(computeSalud(m({ tareas: { vencidas: 0, hoy: 1, proximas: 0, bloqueantesVencidas: 0 } })).tareas).toBe('aviso')
    expect(computeSalud(m({ tareas: { vencidas: 0, hoy: 0, proximas: 3, bloqueantesVencidas: 0 } })).tareas).toBe('ok')
  })

  it('logistica: 25 por ciento o mas de confirmados sin lugar es alerta', () => {
    const base = { mesas: 4, conGente: 3, conLugar: 30, sinLugar: 10, sillasLibres: 5 }
    expect(computeSalud(m({ mesas: base })).logistica).toBe('alerta')
    expect(computeSalud(m({ mesas: { ...base, sinLugar: 4 } })).logistica).toBe('aviso')
    expect(computeSalud(m({ mesas: { ...base, sinLugar: 0 } })).logistica).toBe('ok')
  })
})

describe('computeChipDeuda', () => {
  it('las vencidas ganan a todo', () => {
    const c = computeChipDeuda(m({ tareas: { vencidas: 3, hoy: 2, proximas: 0, bloqueantesVencidas: 1 }, invitacion: 'borrador' }))
    expect(c).toEqual({ tono: 'alerta', texto: '3' })
  })

  it('sin vencidas, las de hoy', () => {
    expect(computeChipDeuda(m({ tareas: { vencidas: 0, hoy: 1, proximas: 0, bloqueantesVencidas: 0 } }))).toEqual({ tono: 'aviso', texto: '1' })
  })

  it('sin tareas urgentes pero en borrador, avisa del borrador', () => {
    expect(computeChipDeuda(m({ invitacion: 'borrador' }))).toEqual({ tono: 'vacio', texto: 'Borrador' })
  })

  it('todo limpio dice OK', () => {
    expect(computeChipDeuda(m())).toEqual({ tono: 'ok', texto: 'OK' })
  })
})

describe('haceCuanto', () => {
  const ahora = new Date(2026, 7, 1, 15, 0, 0)

  it('menos de un minuto', () => {
    expect(haceCuanto(new Date(2026, 7, 1, 14, 59, 40).toISOString(), ahora)).toBe('Hace un momento')
  })

  it('minutos, en singular y plural', () => {
    expect(haceCuanto(new Date(2026, 7, 1, 14, 59, 0).toISOString(), ahora)).toBe('Hace 1 minuto')
    expect(haceCuanto(new Date(2026, 7, 1, 14, 35, 0).toISOString(), ahora)).toBe('Hace 25 minutos')
  })

  it('horas del mismo dia', () => {
    expect(haceCuanto(new Date(2026, 7, 1, 12, 0, 0).toISOString(), ahora)).toBe('Hace 3 horas')
  })

  it('ayer trae la hora', () => {
    expect(haceCuanto(new Date(2026, 6, 31, 18, 40, 0).toISOString(), ahora)).toBe('Ayer, 6:40 pm')
  })

  it('mas de una semana cae a fecha corta', () => {
    expect(haceCuanto(new Date(2026, 6, 10, 9, 0, 0).toISOString(), ahora)).toBe('10 jul')
  })

  it('una fecha invalida no revienta', () => {
    expect(haceCuanto('no-es-fecha', ahora)).toBe('')
  })
})

describe('sumaPorMoneda', () => {
  const conMoneda = (currency: string, estimado: number) =>
    m({ event: { id: 'x', name: 'X', currency, event_status: 'active' }, dinero: { estimado, contratado: 0, pagado: 0, porPagar: 0, sinContratar: 0, excedido: false, pctContratado: 0 } })

  it('sin eventos da cero en MXN', () => {
    expect(sumaPorMoneda([], x => x.dinero.estimado)).toEqual({ total: 0, currency: 'MXN', otras: 0 })
  })

  it('una sola moneda suma todo', () => {
    const r = sumaPorMoneda([conMoneda('MXN', 100), conMoneda('MXN', 250)], x => x.dinero.estimado)
    expect(r).toEqual({ total: 350, currency: 'MXN', otras: 0 })
  })

  it('con dos monedas devuelve la dominante y cuenta las otras', () => {
    const r = sumaPorMoneda(
      [conMoneda('MXN', 100), conMoneda('MXN', 200), conMoneda('USD', 9000)],
      x => x.dinero.estimado,
    )
    expect(r).toEqual({ total: 300, currency: 'MXN', otras: 1 })
  })
})
