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
  playlist_max_songs: number | null
  registry_token: string | null
  registry_payment_info: RegistryPaymentInfo | null
  registry_external_links: RegistryExternalLink[] | null
  enabled_features: Partial<Record<'mesas' | 'regalos' | 'album' | 'playlist' | 'comida', boolean>> | null
  dress_code: import('./dresscode').DressCode | null
  created_at: string
  updated_at: string
}

// Limite efectivo de canciones por invitado: null = 3 (default), 0 = sin limite
export function resolveMaxSongs(value: number | null | undefined): number {
  if (value === 0) return Infinity
  if (!value || value < 0) return 3
  return value
}

export type RegistryExternalLink = {
  id: string
  store: string
  url: string
}

// ─── MESA DE REGALOS ─────────────────────────────────────────────────────────

export const GIFT_CATEGORIES = [
  { id: 'viajes',       label: 'Viajes' },
  { id: 'hogar',        label: 'Hogar' },
  { id: 'experiencias', label: 'Experiencias' },
  { id: 'estilo',       label: 'Estilo de vida' },
  { id: 'otro',         label: 'Otro' },
] as const

// Ladas para selects de telefono (MX primero, luego America y Europa)
export const PHONE_COUNTRY_CODES: { code: string; label: string }[] = [
  { code: '+52',  label: 'México +52' },
  { code: '+1',   label: 'USA / Canadá +1' },
  { code: '+54',  label: 'Argentina +54' },
  { code: '+591', label: 'Bolivia +591' },
  { code: '+55',  label: 'Brasil +55' },
  { code: '+56',  label: 'Chile +56' },
  { code: '+57',  label: 'Colombia +57' },
  { code: '+506', label: 'Costa Rica +506' },
  { code: '+53',  label: 'Cuba +53' },
  { code: '+593', label: 'Ecuador +593' },
  { code: '+503', label: 'El Salvador +503' },
  { code: '+502', label: 'Guatemala +502' },
  { code: '+504', label: 'Honduras +504' },
  { code: '+505', label: 'Nicaragua +505' },
  { code: '+507', label: 'Panamá +507' },
  { code: '+595', label: 'Paraguay +595' },
  { code: '+51',  label: 'Perú +51' },
  { code: '+598', label: 'Uruguay +598' },
  { code: '+58',  label: 'Venezuela +58' },
  { code: '+34',  label: 'España +34' },
  { code: '+49',  label: 'Alemania +49' },
  { code: '+43',  label: 'Austria +43' },
  { code: '+32',  label: 'Bélgica +32' },
  { code: '+45',  label: 'Dinamarca +45' },
  { code: '+33',  label: 'Francia +33' },
  { code: '+30',  label: 'Grecia +30' },
  { code: '+353', label: 'Irlanda +353' },
  { code: '+39',  label: 'Italia +39' },
  { code: '+47',  label: 'Noruega +47' },
  { code: '+31',  label: 'Países Bajos +31' },
  { code: '+48',  label: 'Polonia +48' },
  { code: '+351', label: 'Portugal +351' },
  { code: '+44',  label: 'Reino Unido +44' },
  { code: '+46',  label: 'Suecia +46' },
  { code: '+41',  label: 'Suiza +41' },
  { code: '+61',  label: 'Australia +61' },
  { code: '+86',  label: 'China +86' },
  { code: '+972', label: 'Israel +972' },
  { code: '+81',  label: 'Japón +81' },
]

export type RegistryPaymentMethodType =
  'transfer' | 'card' | 'mercado_pago' | 'paypal' | 'zelle' | 'other'

export type RegistryPaymentMethod = {
  id: string
  type: RegistryPaymentMethodType
  bank?: string    // transfer y card
  holder?: string  // transfer, card y zelle
  value: string    // CLABE / tarjeta / link / email-tel / instruccion
  label?: string   // solo other: nombre de la app
}

export type RegistryPaymentInfo = {
  methods: RegistryPaymentMethod[]
}

// Acepta la forma vieja del JSONB ({ bank, account_holder, clabe }) y la nueva ({ methods })
export function normalizePaymentMethods(raw: unknown): RegistryPaymentMethod[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.methods)) return obj.methods as RegistryPaymentMethod[]
  const legacy = obj as { bank?: string; account_holder?: string; clabe?: string }
  if (legacy.clabe || legacy.bank || legacy.account_holder) {
    return [{
      id: 'legacy-transfer',
      type: 'transfer',
      bank: legacy.bank || '',
      holder: legacy.account_holder || '',
      value: legacy.clabe || '',
    }]
  }
  return []
}

export type RegistryShippingAddress = {
  recipient: string
  street: string
  neighborhood: string
  zip: string
  city: string
  state: string
  references: string
}

export function formatShippingAddress(a: Partial<RegistryShippingAddress>): string {
  const cityLine = [a.zip ? `CP ${a.zip}` : '', a.city, a.state]
    .map(s => (s || '').trim()).filter(Boolean).join(', ')
  return [a.recipient, a.street, a.neighborhood, cityLine, a.references]
    .map(s => (s || '').trim()).filter(Boolean).join('\n')
}

export type GiftType = 'external' | 'fund' | 'cash'

export type GiftRegistryItem = {
  id: string
  event_id: string
  type: GiftType
  title: string
  description: string | null
  category: string | null
  image_url: string | null
  external_url: string | null
  store: string | null
  price: number | null
  target_amount: number | null
  created_at: string
}

export type GiftReservation = {
  id: string
  item_id: string
  event_id: string
  guest_id: string | null
  guest_name: string
  guest_phone: string | null
  amount: number | null
  message: string | null
  purchased: boolean
  thanked: boolean
  created_at: string
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

export type AttentionReason = 'alergia' | 'peticion' | 'queja' | 'duda' | 'otro'

export type PartyMember = {
  id: string
  guest_id: string
  event_id: string
  name: string
  phone?: string | null
  rsvp_status: RsvpStatus
  created_at?: string
  allergies?: string[]
  tags?: string[]
  notes?: string | null
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
  needs_attention?: boolean
  attention_reason?: AttentionReason | null
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

// ─── AGENT ───────────────────────────────────────────────────────────────────

export type AgentMode = 'autonomo' | 'copiloto'
export type AgentTone = 'calido' | 'formal'
export type FaqEntry = { q: string; a: string }

export type AgentConfig = {
  enabled: boolean
  mode: AgentMode
  tone: AgentTone
  signature: string
  holdingMessage: string
  deflectMessage: string
  escalate: { alergias: boolean; quejas: boolean; cambios_invitados: boolean; fuera_de_info: boolean }
  faq: FaqEntry[]
}