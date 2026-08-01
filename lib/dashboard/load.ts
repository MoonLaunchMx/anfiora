import { supabase } from '@/lib/supabase'
import { computeEventMetrics } from './metrics'
import type {
  BudgetRow, ColaboradorRow, DashboardData, EventMetrics, EventoRow, GiftItemRow,
  GuestRow, MemberRow, PaymentRow, ReservationRow, Rol, SeatRow, SettingsRow,
  SupplierRow, TableRow, TaskRow,
} from './types'

const CAMPOS_EVENTO =
  'id, name, event_date, event_end_date, event_time, event_type, event_status, venue, total_guests, currency, guest_cap, host_name, host_name_2'

/* eslint-disable @typescript-eslint/no-explicit-any */
function porEvento<T extends { event_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const list = map.get(r.event_id)
    if (list) list.push(r)
    else map.set(r.event_id, [r])
  }
  return map
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const [propios, compartidos, perfil] = await Promise.all([
    supabase.from('events').select(CAMPOS_EVENTO).eq('user_id', userId).order('event_date', { ascending: true }),
    supabase
      .from('event_collaborators')
      .select(`role, event:event_id ( ${CAMPOS_EVENTO}, user_id, owner:user_id ( full_name ) )`)
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase.from('users').select('role').eq('id', userId).single(),
  ])

  const rol = (perfil.data?.role ?? null) as Rol

  const misEventos: EventoRow[] = ((propios.data ?? []) as any[]).map(e => ({
    ...e, is_shared: false, shared_role: null, owner_name: null,
  }))

  const ajenos: EventoRow[] = ((compartidos.data ?? []) as any[])
    .filter(c => !!c.event)
    .map(c => ({
      ...c.event,
      is_shared: true,
      shared_role: c.role,
      owner_name: c.event.owner?.full_name ?? null,
    }))

  const eventos = [...misEventos, ...ajenos]
  const ids = eventos.map(e => e.id)

  if (ids.length === 0) return { metrics: [], rol, colaboradores: [] }

  const [
    guests, members, budgets, suppliers, tasks,
    giftItems, reservations, tables, seats, settings, colaboradores,
  ] = await Promise.all([
    supabase.from('guests').select('event_id, rsvp_status, party_size, needs_attention').in('event_id', ids),
    supabase.from('party_members').select('event_id, rsvp_status').in('event_id', ids),
    supabase.from('event_budgets').select('event_id, budget_amount').in('event_id', ids),
    supabase.from('event_suppliers').select('id, event_id, status, contract_amount, supplier:supplier_id ( name )').in('event_id', ids),
    supabase
      .from('event_timeline_tasks')
      .select('id, event_id, title, category, task_date, is_completed, priority, assigned_to_name')
      .in('event_id', ids)
      .eq('is_completed', false),
    supabase.from('gift_registry_items').select('event_id').in('event_id', ids),
    supabase.from('gift_reservations').select('event_id, amount, purchased').in('event_id', ids),
    supabase.from('tables').select('id, event_id, capacity').in('event_id', ids),
    supabase.from('table_seats').select('event_id, table_id, guest_id, party_size').in('event_id', ids),
    supabase.from('event_settings').select('event_id, invite_draft, invite_config, access_mode, shared_token').in('event_id', ids),
    supabase
      .from('event_collaborators')
      .select('event_id, role, email, user:user_id ( full_name )')
      .in('event_id', ids)
      .eq('status', 'active'),
  ])

  const supplierRows: SupplierRow[] = ((suppliers.data ?? []) as any[]).map(s => ({
    id: s.id,
    event_id: s.event_id,
    status: s.status,
    contract_amount: s.contract_amount,
    supplier_name: s.supplier?.name ?? null,
  }))

  const supplierIds = supplierRows.map(s => s.id)
  const pagos = supplierIds.length
    ? await supabase.from('supplier_payments').select('event_supplier_id, amount').in('event_supplier_id', supplierIds)
    : { data: [] as PaymentRow[] }

  const pagosPorProveedor = new Map<string, PaymentRow[]>()
  for (const p of (pagos.data ?? []) as PaymentRow[]) {
    const list = pagosPorProveedor.get(p.event_supplier_id)
    if (list) list.push(p)
    else pagosPorProveedor.set(p.event_supplier_id, [p])
  }

  const gGuests = porEvento((guests.data ?? []) as GuestRow[])
  const gMembers = porEvento((members.data ?? []) as MemberRow[])
  const gBudgets = porEvento((budgets.data ?? []) as BudgetRow[])
  const gSuppliers = porEvento(supplierRows)
  const gTasks = porEvento((tasks.data ?? []) as TaskRow[])
  const gGifts = porEvento((giftItems.data ?? []) as GiftItemRow[])
  const gRes = porEvento((reservations.data ?? []) as ReservationRow[])
  const gTables = porEvento((tables.data ?? []) as TableRow[])
  const gSeats = porEvento((seats.data ?? []) as SeatRow[])
  const gSettings = porEvento((settings.data ?? []) as SettingsRow[])

  const colabRows: ColaboradorRow[] = ((colaboradores.data ?? []) as any[]).map(c => ({
    event_id: c.event_id,
    role: c.role,
    email: c.email,
    full_name: c.user?.full_name ?? null,
  }))

  const hoy = new Date()

  const metrics: EventMetrics[] = eventos.map(event => {
    // No reusar el nombre `propios` de arriba: aqui son los proveedores del evento.
    const proveedoresDelEvento = gSuppliers.get(event.id) ?? []
    return computeEventMetrics({
      event,
      guests: gGuests.get(event.id) ?? [],
      members: gMembers.get(event.id) ?? [],
      budgets: gBudgets.get(event.id) ?? [],
      suppliers: proveedoresDelEvento,
      payments: proveedoresDelEvento.flatMap(s => pagosPorProveedor.get(s.id) ?? []),
      tasks: gTasks.get(event.id) ?? [],
      giftItems: gGifts.get(event.id) ?? [],
      reservations: gRes.get(event.id) ?? [],
      tables: gTables.get(event.id) ?? [],
      seats: gSeats.get(event.id) ?? [],
      settings: (gSettings.get(event.id) ?? [])[0] ?? null,
      hoy,
    })
  })

  return { metrics, rol, colaboradores: colabRows }
}
