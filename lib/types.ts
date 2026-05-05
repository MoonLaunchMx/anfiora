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

// Simbolo a mostrar antes del numero
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

// Sufijo opcional para diferenciar monedas con simbolo $
// Ejemplo: "$1,500 MXN" vs "$1,500 USD"
export const CURRENCY_CODE_SUFFIX: Record<Currency, string> = {
  MXN: ' MXN',
  USD: ' USD',
  EUR: '',     // simbolo unico, no necesita sufijo
  GBP: '',     // simbolo unico, no necesita sufijo
  COP: ' COP',
  ARS: ' ARS',
  BRL: '',     // simbolo unico, no necesita sufijo
  CLP: ' CLP',
  PEN: '',     // simbolo unico, no necesita sufijo
}

// Helper para formatear montos con la moneda del evento
// Ejemplo: formatCurrency(1500.5, 'MXN') => "$1,500.50 MXN"
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
  // computed client-side
  seats?: TableSeat[]
}

export type TableSeat = {
  id: string
  table_id: string
  event_id: string
  seat_number: number
  guest_id: string | null
  created_at: string
  // joined client-side
  guest?: Pick<Guest, 'id' | 'name' | 'rsvp_status'>
}

export type TimelineTask = {
  id: string
  event_id: string
  title: string
  emoji: string | null
  category: 'evento' | 'tarea' | 'recordatorio' | 'reunion' | 'entrega' | 'pago' | 'comunicacion' | 'otro'
  task_date: string
  task_time: string | null
  notes: string | null
  is_highlighted: boolean
  is_completed: boolean
  reminder_date: string | null
  created_at: string
}

// ─── FINANZAS — BUDGET CATEGORIES ────────────────────────────────────────────
// Las 14 categorias madre que se usan en presupuesto y proveedores

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

// Subcategorias sugeridas por categoria madre (autocomplete en UI, texto libre en DB)
export const SUBCATEGORIES_BY_CATEGORY: Record<BudgetCategory, string[]> = {
  'Planeacion': ['Wedding planner', 'Wedding designer', 'Coordinador del dia'],
  'Venue': ['Recepcion', 'Iglesia/Religioso', 'Civil', 'Hospedaje invitados'],
  'Banquete': ['Catering', 'Banquetero', 'Mesa de dulces', 'Pastel', 'Postres'],
  'Bebidas': ['Barra/Cocteleria', 'Vinos', 'Hielera/Mixologo'],
  'Audio y Video': ['Sonido', 'DJ', 'Musicos en vivo', 'Mariachi', 'Video', 'Fotografia', 'Cabina de fotos'],
  'Imagen': ['Hair & Makeup', 'Vestido novia', 'Traje novio', 'Joyeria'],
  'Decoracion': ['Floristas', 'Mobiliario', 'Iluminacion', 'Carpa/Estructuras'],
  'Ceremonia': ['Oficiante', 'Coro', 'Lazo/Arras'],
  'Entretenimiento': ['Show', 'Espectaculo', 'Pirotecnia', 'Animacion ninos'],
  'Papeleria': ['Invitaciones', 'Save the date', 'Letreros', 'Menus'],
  'Logistica': ['Transporte invitados', 'Valet parking', 'Seguridad', 'Sanitarios'],
  'Recuerdos': ['Bolo/Mesa de regalos', 'Recuerdos invitados'],
  'Digital': ['Anfiora', 'Otros (RSVP, gestion)'],
  'Otro': [],
}

// Labels para UI (con acentos correctos en espanol)
export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  'Planeacion': 'Planeación',
  'Venue': 'Venue',
  'Banquete': 'Banquete',
  'Bebidas': 'Bebidas',
  'Audio y Video': 'Audio y Video',
  'Imagen': 'Imagen',
  'Decoracion': 'Decoración',
  'Ceremonia': 'Ceremonia',
  'Entretenimiento': 'Entretenimiento',
  'Papeleria': 'Papelería',
  'Logistica': 'Logística',
  'Recuerdos': 'Recuerdos',
  'Digital': 'Digital',
  'Otro': 'Otro',
}

// ─── FINANZAS — EVENT BUDGETS ────────────────────────────────────────────────
// Presupuesto por categoria por evento

export type EventBudget = {
  id: string
  event_id: string
  category: BudgetCategory
  subcategory: string
  budget_amount: number
  event_supplier_id: string | null
  notes: string | null
  created_at: string
}

export type EventBudgetInsert = Omit<EventBudget, 'id' | 'created_at'>
export type EventBudgetUpdate = Partial<Omit<EventBudget, 'id' | 'event_id' | 'created_at'>>

// Tipo agregado para UI: una categoria madre con sus partidas (subcategorias)
export type BudgetCategoryWithItems = {
  category: BudgetCategory
  items: EventBudget[]
  total_budget: number       // suma de budget_amount de todos los items
  total_contracted: number   // calculado desde event_suppliers
  total_paid: number         // calculado desde supplier_payments
  total_pending: number      // total_contracted - total_paid
  is_over_budget: boolean    // total_contracted > total_budget
}

// ─── FINANZAS — SUPPLIERS ────────────────────────────────────────────────────
// Rolodex global del planner. UI visible solo en plan Agency,
// pero schema unificado: en PRO los proveedores tambien viven aqui

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
// Relacion proveedor <-> evento (el SRM real)

export const SUPPLIER_STATUSES = [
  'contactado',
  'cotizacion',
  'negociacion',
  'contratado',
  'descartado',
] as const

export type SupplierStatus = typeof SUPPLIER_STATUSES[number]

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  contactado: 'Contactado',
  cotizacion: 'En cotización',
  negociacion: 'Negociando',
  contratado: 'Contratado',
  descartado: 'Descartado',
}

// Colores por estado para badges (clases tailwind)
export const SUPPLIER_STATUS_COLORS: Record<SupplierStatus, string> = {
  contactado: 'bg-amber-100 text-amber-700',
  cotizacion: 'bg-blue-100 text-blue-700',
  negociacion: 'bg-gray-100 text-gray-600',
  contratado: 'bg-emerald-100 text-emerald-700',
  descartado: 'bg-red-100 text-red-600',
}

export const SUPPLIER_MOODS = ['no', 'normal', 'love'] as const
export type SupplierMood = typeof SUPPLIER_MOODS[number]

// Label para accesibilidad (tooltips, screen readers, alt text)
// La UI principal muestra solo el icono de Lucide
export const SUPPLIER_MOOD_LABELS: Record<SupplierMood, string> = {
  no: 'No nos gusta',
  normal: 'Normal',
  love: 'Nos encanta',
}

// Nombre del icono Lucide a renderizar
export const SUPPLIER_MOOD_ICONS: Record<SupplierMood, 'Frown' | 'Meh' | 'Smile'> = {
  no: 'Frown',
  normal: 'Meh',
  love: 'Smile',
}

// Color del icono (clases Tailwind)
export const SUPPLIER_MOOD_COLORS: Record<SupplierMood, string> = {
  no: 'text-red-400',
  normal: 'text-gray-400',
  love: 'text-[#48C9B0]',
}
export const RESPONSE_SPEEDS = ['lentisimo', 'normal', 'bueno', 'rapidos'] as const
export type ResponseSpeed = typeof RESPONSE_SPEEDS[number]

export const RESPONSE_SPEED_LABELS: Record<ResponseSpeed, string> = {
  lentisimo: 'Lentísimo',
  normal: 'Normal',
  bueno: 'Bueno',
  rapidos: 'Rápidos',
}

// Colores para badges de pildora (clases Tailwind)
export const RESPONSE_SPEED_COLORS: Record<ResponseSpeed, string> = {
  lentisimo: 'bg-red-100 text-red-700',
  normal: 'bg-gray-100 text-gray-600',
  bueno: 'bg-blue-100 text-blue-700',
  rapidos: 'bg-emerald-100 text-emerald-700',
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
  created_at: string
}

export type EventSupplierInsert = Omit<EventSupplier, 'id' | 'created_at'>
export type EventSupplierUpdate = Partial<Omit<EventSupplier, 'id' | 'event_id' | 'supplier_id' | 'created_at'>>

// Tipos auxiliares para queries con joins
export type EventSupplierWithSupplier = EventSupplier & {
  supplier: Supplier
}

export type EventSupplierWithDetails = EventSupplier & {
  supplier: Supplier
  payments: SupplierPayment[]
  // computed client-side
  total_paid?: number
  payment_progress?: number // 0-100, contract_amount > 0 ? (total_paid / contract_amount) * 100
}

// ─── FINANZAS — SUPPLIER PAYMENTS ────────────────────────────────────────────
// Pagos multiples por proveedor en evento

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
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta de débito',
  cheque: 'Cheque',
  otro: 'Otro',
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
  novia: 'Novia',
  novio: 'Novio',
  pareja: 'Pareja',
  papas_novia: 'Papás de la novia',
  papas_novio: 'Papás del novio',
  familiar: 'Familiar',
  otro: 'Otro',
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
// Resumenes calculados en memoria para las cards superiores y graficas

export type BudgetSummary = {
  total_budget: number              // suma de todos los event_budgets
  total_quoted: number              // suma de quoted_amount de event_suppliers
  total_contracted: number          // suma de contract_amount donde status = 'contratado'
  total_paid: number                // suma de supplier_payments
  balance: number                   // total_budget - total_contracted (positivo = sobra, negativo = excedido)
  contracted_count: number          // count de event_suppliers con status = 'contratado'
  total_suppliers_count: number     // count total de event_suppliers (todos los estatus)
}

export type CategoryBudgetStatus = {
  category: BudgetCategory
  budget: number
  contracted: number                // suma de contract_amount en esta categoria
  paid: number                      // suma de pagos en esta categoria
  is_within_budget: boolean         // contracted <= budget
  remaining: number                 // budget - contracted
}