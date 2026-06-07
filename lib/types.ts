// ─── RSVP ────────────────────────────────────────────────────────────────────

export type RsvpStatus = 'pending' | 'confirmed' | 'declined' | 'mensaje_enviado' | 'respondio' | 'accion_necesaria'

// ─── CURRENCY ────────────────────────────────────────────────────────────────

export const CURRENCIES = ['MXN', 'USD', 'EUR', 'GBP', 'COP', 'ARS', 'BRL', 'CLP', 'PEN'] as const

export type Currency = typeof CURRENCIES[number]

export const CURRENCY_LABELS: Record<Currency, string> = {
  MXN: 'Peso mexicano',
  USD: 'Dólar estadounidense',
  EUR: 'Euro',
  GBP: 'Libra esterlina',
  COP: 'Peso colombiano',
  ARS: 'Peso argentino',
  BRL: 'Real brasileño',
  CLP: 'Peso chileno',
  PEN: 'Sol peruano',
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MXN: '$',
  USD: '$',
  EUR: '€',
  GBP: '£',
  COP: '$',
  ARS: '$',
  BRL: 'R$',
  CLP: '$',
  PEN: 'S/',
}

export const CURRENCY_CODE_SUFFIX: Record<Currency, string> = {
  MXN: ' MXN',
  USD: ' USD',
  EUR: '',
  GBP: '',
  COP: ' COP',
  ARS: ' ARS',
  BRL: '',
  CLP: ' CLP',
  PEN: '',
}

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  const suffix = CURRENCY_CODE_SUFFIX[currency]
  const formatted = amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol}${formatted}${suffix}`
}

// ─── WHATSAPP AGENT ──────────────────────────────────────────────────────────

export type AgentMode = 'autonomo' | 'copiloto'
export type AgentTone = 'calido' | 'formal'

export type FaqEntry = { q: string; a: string }

export type AgentEscalateConfig = {
  alergias: boolean
  quejas: boolean
  cambios_invitados: boolean
  fuera_de_info: boolean
}

export type AgentConfig = {
  enabled: boolean
  mode: AgentMode
  tone: AgentTone
  signature: string
  holdingMessage: string
  deflectMessage: string
  escalate: AgentEscalateConfig
  faq: FaqEntry[]
}

// ─── EVENT ───────────────────────────────────────────────────────────────────

export type EventStatus = 'active' | 'paused' | 'cancelled' | 'completed'

export type Event = {
  id: string
  user_id: string
  name: string
  event_date: string | null
  event_end_date: string | null
  event_time: string | null
  event_type: string | null
  event_status: EventStatus
  venue: string | null
  address: string | null
  total_guests: number
  guest_tags: string[]
  currency: Currency
  created_at: string
  host_name?: string | null
  host_name_2?: string | null
  organization?: string | null
  event_category?: string | null
}

export type EventSettings = {
  id: string
  event_id: string
  message_templates: string[] | null
  template_names: string[] | null
  album_url: string | null
  playlist_token: string | null
  playlist_categories: string[] | null
  created_at: string
  updated_at: string
  agent_config: AgentConfig | null
}

// ─── COLLABORATORS ───────────────────────────────────────────────────────────

export type CollaboratorRole = 'admin' | 'editor' | 'viewer'
export type CollaboratorStatus = 'pending' | 'accepted' | 'revoked'

export type EventCollaborator = {
  id: string
  event_id: string
  invited_by: string
  user_id: string | null
  email: string
  role: CollaboratorRole
  status: CollaboratorStatus
  invite_token: string | null
  invited_at: string | null
  accepted_at: string | null
  revoked_at: string | null
  user?: {
    id: string
    full_name: string | null
    email: string
  }
}

// ─── GUESTS ──────────────────────────────────────────────────────────────────

export type PartyMember = {
  id: string
  guest_id: string
  event_id: string
  name: string
  phone?: string | null
  rsvp_status: RsvpStatus
  created_at?: string
}

export type Guest = {
  id: string
  event_id: string
  name: string
  phone: string | null
  email?: string | null
  party_size: number
  notes?: string | null
  rsvp_status: RsvpStatus
  tags: string[]
  party_members: PartyMember[]
  side?: string
  allergies?: string[]
  wa_opt_out?: boolean
  wa_opt_out_at?: string | null
  wa_needs_human?: boolean
  wa_needs_human_reason?: string | null
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────

export type MessageDirection = 'sent' | 'received'

export type WaMessage = {
  id: string
  guest_id: string
  event_id: string
  direction: MessageDirection
  content: string
  created_at: string
  twilio_sid?: string | null
  status?: string | null
  author?: 'ia' | 'human' | null
}

// ─── FOOD PLANNER ────────────────────────────────────────────────────────────

export type FoodCategory = {
  id: string
  name: string
  emoji: string
  items: FoodItem[]
}

export type FoodItem = {
  id: string
  name: string
  amountPerPerson: number
  unit: 'g' | 'kg' | 'pz' | 'L' | 'ml'
  custom?: boolean
}

// ─── SEATING ─────────────────────────────────────────────────────────────────

export type TableShape = 'round' | 'rectangle'

export type Table = {
  id: string
  event_id: string
  number: number
  name: string | null
  capacity: number
  shape: TableShape
  position_x: number
  position_y: number
  created_at: string
  seats?: TableSeat[]
}

export type TableSeat = {
  id: string
  table_id: string
  event_id: string
  seat_number: number
  guest_id: string | null
  created_at: string
  guest?: Pick<Guest, 'id' | 'name' | 'rsvp_status'>
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────

export type TimelinePriority = 'bloqueante' | 'no_bloqueante'

export type TimelineCategory = 'evento' | 'tarea' | 'recordatorio' | 'reunion' | 'entrega' | 'pago' | 'comunicacion' | 'otro'

export type TimelineTask = {
  id: string
  event_id: string
  title: string
  emoji: string | null
  category: TimelineCategory
  task_date: string
  task_time: string | null
  notes: string | null
  is_highlighted: boolean
  is_completed: boolean
  reminder_date: string | null
  created_at: string
  // campos nuevos
  assigned_to_user_id: string | null
  assigned_to_name: string | null
  event_supplier_id: string | null
  priority: TimelinePriority | null
  // joins opcionales para UI
  assigned_user?: {
    id: string
    full_name: string | null
    email: string
  }
  event_supplier?: {
    id: string
    supplier: {
      id: string
      name: string
    }
  }
}

// ─── FINANZAS — BUDGET CATEGORIES ────────────────────────────────────────────

export const BUDGET_CATEGORIES = [
  'Planeacion',
  'Venue',
  'Banquete',
  'Bebidas',
  'Audio y Video',
  'Imagen',
  'Decoracion',
  'Ceremonia',
  'Entretenimiento',
  'Papeleria',
  'Logistica',
  'Recuerdos',
  'Digital',
  'Otro',
] as const

export type BudgetCategory = typeof BUDGET_CATEGORIES[number]

export const SUBCATEGORIES_BY_CATEGORY: Record<BudgetCategory, string[]> = {
  'Planeacion':      ['Wedding planner', 'Wedding designer', 'Coordinador del dia'],
  'Venue':           ['Recepcion', 'Iglesia/Religioso', 'Civil', 'Hospedaje invitados'],
  'Banquete':        ['Catering', 'Banquetero', 'Mesa de dulces', 'Pastel', 'Postres'],
  'Bebidas':         ['Barra/Cocteleria', 'Vinos', 'Hielera/Mixologo'],
  'Audio y Video':   ['Sonido', 'DJ', 'Musicos en vivo', 'Mariachi', 'Video', 'Fotografia', 'Cabina de fotos'],
  'Imagen':          ['Hair & Makeup', 'Vestido novia', 'Traje novio', 'Joyeria'],
  'Decoracion':      ['Floristas', 'Mobiliario', 'Iluminacion', 'Carpa/Estructuras'],
  'Ceremonia':       ['Oficiante', 'Coro', 'Lazo/Arras'],
  'Entretenimiento': ['Show', 'Espectaculo', 'Pirotecnia', 'Animacion ninos'],
  'Papeleria':       ['Invitaciones', 'Save the date', 'Letreros', 'Menus'],
  'Logistica':       ['Transporte invitados', 'Valet parking', 'Seguridad', 'Sanitarios'],
  'Recuerdos':       ['Bolo/Mesa de regalos', 'Recuerdos invitados'],
  'Digital':         ['Anfiora', 'Otros (RSVP, gestion)'],
  'Otro':            [],
}

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  'Planeacion':      'Planeación',
  'Venue':           'Venue',
  'Banquete':        'Banquete',
  'Bebidas':         'Bebidas',
  'Audio y Video':   'Audio y Video',
  'Imagen':          'Imagen',
  'Decoracion':      'Decoración',
  'Ceremonia':       'Ceremonia',
  'Entretenimiento': 'Entretenimiento',
  'Papeleria':       'Papelería',
  'Logistica':       'Logística',
  'Recuerdos':       'Recuerdos',
  'Digital':         'Digital',
  'Otro':            'Otro',
}

export function budgetCategoryLabel(name: string): string {
  return (BUDGET_CATEGORY_LABELS as Record<string, string>)[name] ?? name
}

// ─── FINANZAS — EVENT BUDGETS ────────────────────────────────────────────────

export type EventBudget = {
  id: string
  event_id: string
  category: string
  subcategory: string
  budget_amount: number
  event_supplier_id: string | null
  notes: string | null
  created_at: string
}

export type EventBudgetInsert = Omit<EventBudget, 'id' | 'created_at'>
export type EventBudgetUpdate = Partial<Omit<EventBudget, 'id' | 'event_id' | 'created_at'>>

export type BudgetCategoryWithItems = {
  category: BudgetCategory
  items: EventBudget[]
  total_budget: number
  total_contracted: number
  total_paid: number
  total_pending: number
  is_over_budget: boolean
}

// ─── FINANZAS — SUPPLIERS ────────────────────────────────────────────────────

export type Supplier = {
  id: string
  user_id: string
  name: string
  category: BudgetCategory
  subcategory: string | null
  contact_name: string | null
  phone: string | null
  phone_country_code: string | null
  email: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  country: string | null
  city: string | null
  state_region: string | null
  service_radius_km: number | null
  general_notes: string | null
  created_at: string
}

export type SupplierInsert = Omit<Supplier, 'id' | 'created_at'>
export type SupplierUpdate = Partial<Omit<Supplier, 'id' | 'user_id' | 'created_at'>>

// ─── FINANZAS — EVENT SUPPLIERS ──────────────────────────────────────────────

export const SUPPLIER_STATUSES = [
  'nuevo',
  'cotizado',
  'contratado',
  'descartado',
] as const

export type SupplierStatus = typeof SUPPLIER_STATUSES[number]

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  nuevo:      'Nuevo',
  cotizado:   'Cotizado',
  contratado: 'Contratado',
  descartado: 'Descartado',
}

export const SUPPLIER_STATUS_COLORS: Record<SupplierStatus, string> = {
  nuevo:      'bg-gray-100 text-gray-600',
  cotizado:   'bg-blue-100 text-blue-700',
  contratado: 'bg-emerald-100 text-emerald-700',
  descartado: 'bg-red-100 text-red-600',
}

export const SUPPLIER_MOODS = ['no', 'normal', 'love'] as const
export type SupplierMood = typeof SUPPLIER_MOODS[number]

export const SUPPLIER_MOOD_LABELS: Record<SupplierMood, string> = {
  no:     'No nos gusta',
  normal: 'Normal',
  love:   'Nos encanta',
}

export const SUPPLIER_MOOD_ICONS: Record<SupplierMood, 'Frown' | 'Meh' | 'Smile'> = {
  no:     'Frown',
  normal: 'Meh',
  love:   'Smile',
}

export const SUPPLIER_MOOD_COLORS: Record<SupplierMood, string> = {
  no:     'text-red-400',
  normal: 'text-gray-400',
  love:   'text-[#48C9B0]',
}

export const RESPONSE_SPEEDS = ['lentisimo', 'normal', 'bueno', 'rapidos'] as const
export type ResponseSpeed = typeof RESPONSE_SPEEDS[number]

export const RESPONSE_SPEED_LABELS: Record<ResponseSpeed, string> = {
  lentisimo: 'Lentísimo',
  normal:    'Normal',
  bueno:     'Bueno',
  rapidos:   'Rápidos',
}

export const RESPONSE_SPEED_COLORS: Record<ResponseSpeed, string> = {
  lentisimo: 'bg-red-100 text-red-700',
  normal:    'bg-gray-100 text-gray-600',
  bueno:     'bg-blue-100 text-blue-700',
  rapidos:   'bg-emerald-100 text-emerald-700',
}

export type EventSupplier = {
  id: string
  event_id: string
  supplier_id: string
  status: SupplierStatus
  mood: SupplierMood | null
  response_speed: ResponseSpeed | null
  quoted_amount: number | null
  contract_amount: number | null
  rating: number | null
  review_text: string | null
  event_notes: string | null
  external_files_url: string | null
  has_pro_files: boolean
  event_budget_id: string | null
  created_at: string
}

export type EventSupplierInsert = Omit<EventSupplier, 'id' | 'created_at'>
export type EventSupplierUpdate = Partial<Omit<EventSupplier, 'id' | 'event_id' | 'supplier_id' | 'created_at'>>

export type EventSupplierWithSupplier = EventSupplier & {
  supplier: Supplier
}

export type EventSupplierWithDetails = EventSupplier & {
  supplier: Supplier
  payments: SupplierPayment[]
  total_paid?: number
  payment_progress?: number
}

// ─── FINANZAS — SUPPLIER PAYMENTS ────────────────────────────────────────────

export const PAYMENT_METHODS = [
  'transferencia',
  'efectivo',
  'tarjeta_credito',
  'tarjeta_debito',
  'cheque',
  'otro',
] as const

export type PaymentMethod = typeof PAYMENT_METHODS[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia:   'Transferencia',
  efectivo:        'Efectivo',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito:  'Tarjeta de débito',
  cheque:          'Cheque',
  otro:            'Otro',
}

export const PAID_BY_OPTIONS = [
  'novia',
  'novio',
  'pareja',
  'papas_novia',
  'papas_novio',
  'familiar',
  'otro',
] as const

export type PaidBy = typeof PAID_BY_OPTIONS[number]

export const PAID_BY_LABELS: Record<PaidBy, string> = {
  novia:       'Novia',
  novio:       'Novio',
  pareja:      'Pareja',
  papas_novia: 'Papás de la novia',
  papas_novio: 'Papás del novio',
  familiar:    'Familiar',
  otro:        'Otro',
}

export type SupplierPayment = {
  id: string
  event_supplier_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod | null
  paid_by: PaidBy | null
  reference: string | null
  created_at: string
}

export type SupplierPaymentInsert = Omit<SupplierPayment, 'id' | 'created_at'>
export type SupplierPaymentUpdate = Partial<Omit<SupplierPayment, 'id' | 'event_supplier_id' | 'created_at'>>

// ─── FINANZAS — TIPOS AGREGADOS PARA UI ──────────────────────────────────────

export type BudgetSummary = {
  total_budget: number
  total_quoted: number
  total_contracted: number
  total_paid: number
  balance: number
  contracted_count: number
  total_suppliers_count: number
}

export type CategoryBudgetStatus = {
  category: BudgetCategory
  budget: number
  contracted: number
  paid: number
  is_within_budget: boolean
  remaining: number
}