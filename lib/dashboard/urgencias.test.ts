import { describe, it, expect } from 'vitest'
import { buildUrgencias } from './urgencias'
import type { EventMetrics } from './types'

function m(id: string, nombre: string, over: Record<string, unknown> = {}): EventMetrics {
  return {
    event: {
      id, name: nombre, event_date: '2026-11-14', event_end_date: null, event_time: null,
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

const verDinero = { puedeVerDinero: true }

describe('buildUrgencias', () => {
  it('sin problemas devuelve lista vacia', () => {
    expect(buildUrgencias([m('e1', 'X')], verDinero)).toEqual([])
  })

  it('una tarea vencida bloqueante va antes que una vencida normal', () => {
    const u = buildUrgencias([
      m('e1', 'Uno', { tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 0 },
        proximaTarea: { id: 't1', event_id: 'e1', title: 'Normal', category: 'tarea', task_date: '2026-07-20', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null } }),
      m('e2', 'Dos', { tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 1 },
        proximaTarea: { id: 't2', event_id: 'e2', title: 'Bloqueante', category: 'pago', task_date: '2026-07-25', is_completed: false, priority: 'bloqueante', assigned_to_name: null } }),
    ], verDinero)
    expect(u[0].titulo).toContain('Bloqueante')
    expect(u[0].tipo).toBe('tarea_bloqueante')
  })

  it('el presupuesto excedido aparece con el nombre del evento', () => {
    const u = buildUrgencias([m('e1', 'Congreso', {
      dinero: { estimado: 1400000, contratado: 1512000, pagado: 0, porPagar: 1512000, sinContratar: 0, excedido: true, pctContratado: 108 },
    })], verDinero)
    const excedido = u.find(x => x.tipo === 'presupuesto_excedido')
    expect(excedido?.eventName).toBe('Congreso')
    expect(excedido?.tono).toBe('alerta')
  })

  it('el viewer no ve urgencias de dinero', () => {
    const metrics = [m('e1', 'X', {
      dinero: { estimado: 100, contratado: 200, pagado: 0, porPagar: 200, sinContratar: 0, excedido: true, pctContratado: 200 },
      proveedorConSaldo: { nombre: 'Banquete', contratado: 200, pagado: 0, porPagar: 200 },
    })]
    expect(buildUrgencias(metrics, { puedeVerDinero: false })).toEqual([])
    expect(buildUrgencias(metrics, verDinero).length).toBeGreaterThan(0)
  })

  it('los invitados que requieren atencion generan una urgencia', () => {
    const u = buildUrgencias([m('e1', 'X', {
      invitados: { total: 10, confirmados: 8, pendientes: 2, declinados: 0, pctConfirmado: 80, atencion: 3 },
    })], verDinero)
    const at = u.find(x => x.tipo === 'invitados_atencion')
    expect(at?.titulo).toContain('3')
  })

  it('la invitacion en borrador es la urgencia mas debil', () => {
    const u = buildUrgencias([m('e1', 'X', {
      invitacion: 'borrador',
      tareas: { vencidas: 1, hoy: 0, proximas: 0, bloqueantesVencidas: 0 },
      proximaTarea: { id: 't1', event_id: 'e1', title: 'A', category: 'tarea', task_date: '2026-07-01', is_completed: false, priority: null, assigned_to_name: null },
    })], verDinero)
    expect(u[u.length - 1].tipo).toBe('invitacion_borrador')
  })

  it('el proveedor con saldo trae la accion de registrar pago', () => {
    const u = buildUrgencias([m('e1', 'X', {
      proveedorConSaldo: { nombre: 'Banquete Aurora', contratado: 420000, pagado: 272000, porPagar: 148000 },
    })], verDinero)
    const pago = u.find(x => x.tipo === 'proveedor_saldo')
    expect(pago?.accion.label).toBe('Registrar pago')
    expect(pago?.detalle).toContain('Banquete Aurora')
  })
})

describe('buildUrgencias sin tareas', () => {
  const conTareas = m('e1', 'X', {
    tareas: { vencidas: 2, hoy: 1, proximas: 0, bloqueantesVencidas: 1 },
    proximaTarea: { id: 't1', title: 'Pagar el salon', task_date: '2026-01-01' },
    invitacion: 'borrador',
  })

  it('el tablero del evento no repite las tareas que ya viven en su caja', () => {
    const u = buildUrgencias([conTareas], { puedeVerDinero: true, sinTareas: true })
    expect(u.some(x => x.tipo === 'tarea_bloqueante')).toBe(false)
    expect(u.some(x => x.tipo === 'tarea_vencida')).toBe(false)
    expect(u.some(x => x.tipo === 'tarea_hoy')).toBe(false)
  })

  it('lo que no es tarea se conserva', () => {
    const u = buildUrgencias([conTareas], { puedeVerDinero: true, sinTareas: true })
    expect(u.some(x => x.tipo === 'invitacion_borrador')).toBe(true)
  })

  it('la cartera sigue viendo las tareas: ahi no hay caja de pendientes', () => {
    const u = buildUrgencias([conTareas], { puedeVerDinero: true })
    expect(u.some(x => x.tipo === 'tarea_bloqueante')).toBe(true)
  })

  it('omitir la opcion se comporta igual que hoy', () => {
    expect(buildUrgencias([conTareas], { puedeVerDinero: true }))
      .toEqual(buildUrgencias([conTareas], { puedeVerDinero: true, sinTareas: false }))
  })
})
