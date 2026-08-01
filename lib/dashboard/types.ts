import type { Currency, EventStatus, RsvpStatus, CollaboratorRole } from '@/lib/types'
import type { EstadoPublicacion } from '@/lib/invite/publicacion'

export type Contexto = { kind: 'cartera' } | { kind: 'evento'; eventId: string }

export type Tono = 'ok' | 'aviso' | 'alerta' | 'vacio'

export type EventoRow = {
  id: string
  name: string
  event_date: string | null
  event_end_date: string | null
  event_time: string | null
  event_type: string | null
  event_status: EventStatus
  venue: string | null
  total_guests: number
  currency: Currency
  guest_cap: number | null
  is_shared: boolean
  shared_role: CollaboratorRole | null
  owner_name: string | null
  host_name?: string | null
  host_name_2?: string | null
}

export type GuestRow = {
  event_id: string
  rsvp_status: RsvpStatus
  party_size: number | null
  needs_attention: boolean | null
}

export type MemberRow = { event_id: string; rsvp_status: RsvpStatus }
export type BudgetRow = { event_id: string; budget_amount: number | null }

export type SupplierRow = {
  id: string
  event_id: string
  status: string
  contract_amount: number | null
  supplier_name: string | null
}

export type PaymentRow = { event_supplier_id: string; amount: number | null }

export type TaskRow = {
  id: string
  event_id: string
  title: string
  category: string
  task_date: string | null
  is_completed: boolean | null
  priority: string | null
  assigned_to_name: string | null
}

export type GiftItemRow = { event_id: string }
export type ReservationRow = { event_id: string; amount: number | null; purchased: boolean | null }
export type TableRow = { id: string; event_id: string; capacity: number | null }
export type SeatRow = { event_id: string; table_id: string; guest_id: string | null; party_size: number | null }
export type SettingsRow = {
  event_id: string
  invite_draft: unknown
  invite_config: unknown
  access_mode?: string | null
  shared_token?: string | null
}

export type Invitados = {
  total: number
  confirmados: number
  pendientes: number
  declinados: number
  pctConfirmado: number
  atencion: number
}

export type Dinero = {
  estimado: number
  contratado: number
  pagado: number
  porPagar: number
  sinContratar: number
  excedido: boolean
  pctContratado: number
}

export type Proveedores = {
  total: number
  contratados: number
  cotizados: number
  nuevos: number
}

export type Tareas = {
  vencidas: number
  hoy: number
  proximas: number
  bloqueantesVencidas: number
}

export type Regalos = { recibido: number; apartados: number; totalItems: number }

export type Mesas = {
  mesas: number
  conGente: number
  conLugar: number
  sinLugar: number
  sillasLibres: number
}

export type EventMetrics = {
  event: EventoRow
  invitados: Invitados
  dinero: Dinero
  proveedores: Proveedores
  tareas: Tareas
  regalos: Regalos
  mesas: Mesas
  invitacion: EstadoPublicacion
  // Crudos: la UI los resuelve con resolveAccessMode / slugifyEvent para no
  // meter dependencias de presentacion en la capa pura.
  accessMode: string | null
  sharedToken: string | null
  proximaTarea: TaskRow | null
  // Tareas vivas ordenadas por fecha: la columna de pendientes las marca sin
  // entrar al timeline, asi que necesita la lista, no solo la primera.
  tareasProximas: TaskRow[]
  proveedorConSaldo: { nombre: string; contratado: number; pagado: number; porPagar: number } | null
}

export type ColaboradorRow = {
  event_id: string
  role: CollaboratorRole
  full_name: string | null
  email: string
}

export type Rol = 'planner' | 'anfitrion' | null

export type DashboardData = {
  metrics: EventMetrics[]
  rol: Rol
  colaboradores: ColaboradorRow[]
}

export type MetricsInput = {
  event: EventoRow
  guests: GuestRow[]
  members: MemberRow[]
  budgets: BudgetRow[]
  suppliers: SupplierRow[]
  payments: PaymentRow[]
  tasks: TaskRow[]
  giftItems: GiftItemRow[]
  reservations: ReservationRow[]
  tables: TableRow[]
  seats: SeatRow[]
  settings: SettingsRow | null
  hoy: Date
}
