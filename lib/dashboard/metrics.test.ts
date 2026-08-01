import { describe, it, expect } from 'vitest'
import { computeEventMetrics } from './metrics'
import type { EventoRow, MetricsInput } from './types'

const evento: EventoRow = {
  id: 'e1', name: 'Ana y Rodrigo',
  event_date: '2026-11-14', event_end_date: null, event_time: '17:00',
  event_type: 'boda', event_status: 'active', venue: 'Hacienda San Gabriel',
  total_guests: 240, currency: 'MXN', guest_cap: 240,
  is_shared: false, shared_role: null, owner_name: null,
}

function base(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    event: evento,
    guests: [], members: [], budgets: [], suppliers: [], payments: [],
    tasks: [], giftItems: [], reservations: [], tables: [], seats: [],
    settings: null, hoy: new Date(2026, 7, 1),
    ...over,
  }
}

describe('invitados', () => {
  it('suma invitados y acompanantes en un solo conteo', () => {
    const m = computeEventMetrics(base({
      guests: [
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 2, needs_attention: false },
        { event_id: 'e1', rsvp_status: 'pending',   party_size: 1, needs_attention: false },
      ],
      members: [{ event_id: 'e1', rsvp_status: 'confirmed' }],
    }))
    expect(m.invitados.total).toBe(3)
    expect(m.invitados.confirmados).toBe(2)
    expect(m.invitados.pendientes).toBe(1)
    expect(m.invitados.pctConfirmado).toBe(67)
  })

  it('cuenta los que requieren atencion', () => {
    const m = computeEventMetrics(base({
      guests: [
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 1, needs_attention: true },
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 1, needs_attention: null },
      ],
    }))
    expect(m.invitados.atencion).toBe(1)
  })

  it('sin invitados el porcentaje es 0, no NaN', () => {
    expect(computeEventMetrics(base()).invitados.pctConfirmado).toBe(0)
  })
})

describe('dinero', () => {
  it('solo los proveedores contratados cuentan como contratado', () => {
    const m = computeEventMetrics(base({
      budgets: [{ event_id: 'e1', budget_amount: 100000 }],
      suppliers: [
        { id: 's1', event_id: 'e1', status: 'contratado', contract_amount: 60000, supplier_name: 'Banquete' },
        { id: 's2', event_id: 'e1', status: 'cotizado',   contract_amount: 30000, supplier_name: 'DJ' },
      ],
      payments: [{ event_supplier_id: 's1', amount: 20000 }],
    }))
    expect(m.dinero.estimado).toBe(100000)
    expect(m.dinero.contratado).toBe(60000)
    expect(m.dinero.pagado).toBe(20000)
    expect(m.dinero.porPagar).toBe(40000)
    expect(m.dinero.sinContratar).toBe(40000)
    expect(m.dinero.excedido).toBe(false)
  })

  it('marca excedido cuando lo contratado pasa lo estimado', () => {
    const m = computeEventMetrics(base({
      budgets: [{ event_id: 'e1', budget_amount: 50000 }],
      suppliers: [{ id: 's1', event_id: 'e1', status: 'contratado', contract_amount: 70000, supplier_name: 'X' }],
    }))
    expect(m.dinero.excedido).toBe(true)
    expect(m.dinero.sinContratar).toBe(0)
  })

  it('un pago de proveedor descartado no cuenta', () => {
    const m = computeEventMetrics(base({
      suppliers: [{ id: 's9', event_id: 'e1', status: 'descartado', contract_amount: 10000, supplier_name: 'X' }],
      payments: [{ event_supplier_id: 's9', amount: 5000 }],
    }))
    expect(m.dinero.contratado).toBe(0)
    expect(m.dinero.pagado).toBe(0)
  })

  it('expone el proveedor con mayor saldo pendiente', () => {
    const m = computeEventMetrics(base({
      suppliers: [
        { id: 's1', event_id: 'e1', status: 'contratado', contract_amount: 420000, supplier_name: 'Banquete Aurora' },
        { id: 's2', event_id: 'e1', status: 'contratado', contract_amount: 90000,  supplier_name: 'DJ' },
      ],
      payments: [{ event_supplier_id: 's1', amount: 272000 }],
    }))
    expect(m.proveedorConSaldo?.nombre).toBe('Banquete Aurora')
    expect(m.proveedorConSaldo?.porPagar).toBe(148000)
  })
})

describe('tareas', () => {
  const hoy = new Date(2026, 7, 1)
  it('clasifica vencidas, hoy y proximas contra la fecha dada', () => {
    const m = computeEventMetrics(base({
      hoy,
      tasks: [
        { id: 't1', event_id: 'e1', title: 'A', category: 'pago',  task_date: '2026-07-29', is_completed: false, priority: 'bloqueante',    assigned_to_name: null },
        { id: 't2', event_id: 'e1', title: 'B', category: 'tarea', task_date: '2026-07-31', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null },
        { id: 't3', event_id: 'e1', title: 'C', category: 'tarea', task_date: '2026-08-01', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null },
        { id: 't4', event_id: 'e1', title: 'D', category: 'tarea', task_date: '2026-08-05', is_completed: false, priority: 'no_bloqueante', assigned_to_name: null },
      ],
    }))
    expect(m.tareas.vencidas).toBe(2)
    expect(m.tareas.hoy).toBe(1)
    expect(m.tareas.proximas).toBe(1)
    expect(m.tareas.bloqueantesVencidas).toBe(1)
  })

  it('ignora las completadas y las sin fecha', () => {
    const m = computeEventMetrics(base({
      hoy,
      tasks: [
        { id: 't1', event_id: 'e1', title: 'A', category: 'tarea', task_date: '2026-07-01', is_completed: true,  priority: null, assigned_to_name: null },
        { id: 't2', event_id: 'e1', title: 'B', category: 'tarea', task_date: null,         is_completed: false, priority: null, assigned_to_name: null },
      ],
    }))
    expect(m.tareas.vencidas).toBe(0)
    expect(m.tareas.proximas).toBe(0)
  })
})

describe('mesas', () => {
  it('los confirmados sin asiento quedan como sin lugar', () => {
    const m = computeEventMetrics(base({
      guests: [
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 3, needs_attention: false },
        { event_id: 'e1', rsvp_status: 'confirmed', party_size: 2, needs_attention: false },
      ],
      tables: [{ id: 'm1', event_id: 'e1', capacity: 10 }],
      seats: [{ event_id: 'e1', table_id: 'm1', guest_id: 'g1', party_size: 3 }],
    }))
    expect(m.mesas.mesas).toBe(1)
    expect(m.mesas.conGente).toBe(1)
    expect(m.mesas.conLugar).toBe(3)
    expect(m.mesas.sinLugar).toBe(2)
    expect(m.mesas.sillasLibres).toBe(7)
  })

  it('dos asientos en la misma mesa cuentan una sola mesa con gente', () => {
    const m = computeEventMetrics(base({
      tables: [{ id: 'm1', event_id: 'e1', capacity: 10 }, { id: 'm2', event_id: 'e1', capacity: 10 }],
      seats: [
        { event_id: 'e1', table_id: 'm1', guest_id: 'g1', party_size: 2 },
        { event_id: 'e1', table_id: 'm1', guest_id: 'g2', party_size: 1 },
      ],
    }))
    expect(m.mesas.mesas).toBe(2)
    expect(m.mesas.conGente).toBe(1)
    expect(m.mesas.conLugar).toBe(3)
  })

  it('un asiento vacio no ocupa lugar ni marca la mesa como ocupada', () => {
    const m = computeEventMetrics(base({
      tables: [{ id: 'm1', event_id: 'e1', capacity: 8 }],
      seats: [{ event_id: 'e1', table_id: 'm1', guest_id: null, party_size: null }],
    }))
    expect(m.mesas.conGente).toBe(0)
    expect(m.mesas.conLugar).toBe(0)
    expect(m.mesas.sillasLibres).toBe(8)
  })
})

describe('regalos', () => {
  it('suma solo los aportes con monto', () => {
    const m = computeEventMetrics(base({
      giftItems: [{ event_id: 'e1' }, { event_id: 'e1' }, { event_id: 'e1' }],
      reservations: [
        { event_id: 'e1', amount: 2500, purchased: true },
        { event_id: 'e1', amount: null, purchased: false },
      ],
    }))
    expect(m.regalos.recibido).toBe(2500)
    expect(m.regalos.apartados).toBe(2)
    expect(m.regalos.totalItems).toBe(3)
  })
})

describe('invitacion', () => {
  it('sin settings se lee como borrador', () => {
    expect(computeEventMetrics(base()).invitacion).toBe('borrador')
  })
})
