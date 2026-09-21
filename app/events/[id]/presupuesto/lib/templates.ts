import { BudgetCategory } from '@/lib/types'

export type BudgetTier = 'esencial' | 'clasica' | 'premium'

type BudgetItemTpl = { category: BudgetCategory; concepto: string }

// category va aparte de EventBudgetInsert: es el nombre canonico del template,
// el que el caller usa para resolver category_id contra categories antes de
// insertar. No se guarda tal cual -EventBudgetInsert ya no tiene esa columna.
export type SuggestedBudgetRow = {
  event_id: string
  category: BudgetCategory
  subcategory: string
  budget_amount: number
  event_supplier_id: null
  notes: null
}

const BODA_ESENCIAL: BudgetItemTpl[] = [
  { category: 'Venue',         concepto: 'Lugar / Salon' },
  { category: 'Banquete',      concepto: 'Banquete (catering)' },
  { category: 'Banquete',      concepto: 'Pastel' },
  { category: 'Bebidas',       concepto: 'Barra de bebidas' },
  { category: 'Audio y Video', concepto: 'DJ o música' },
  { category: 'Audio y Video', concepto: 'Fotografía' },
  { category: 'Imagen',        concepto: 'Vestido de novia' },
  { category: 'Imagen',        concepto: 'Traje del novio' },
  { category: 'Decoracion',    concepto: 'Flores y centros de mesa' },
  { category: 'Papeleria',     concepto: 'Invitaciones' },
  { category: 'Ceremonia',     concepto: 'Ceremonia (oficiante)' },
  { category: 'Digital',       concepto: 'Anfiora (herramienta digital del evento)' },
]

const BODA_CLASICA_EXTRA: BudgetItemTpl[] = [
  { category: 'Planeacion',    concepto: 'Coordinador del día' },
  { category: 'Audio y Video', concepto: 'Video' },
  { category: 'Imagen',        concepto: 'Hair & makeup' },
  { category: 'Bebidas',       concepto: 'Cóctel de bienvenida' },
  { category: 'Decoracion',    concepto: 'Iluminación' },
  { category: 'Entretenimiento', concepto: 'Mariachi o show' },
  { category: 'Recuerdos',     concepto: 'Recuerdos para invitados' },
  { category: 'Logistica',     concepto: 'Transporte' },
  { category: 'Banquete',      concepto: 'Mesa de postres' },
]

const BODA_PREMIUM_EXTRA: BudgetItemTpl[] = [
  { category: 'Planeacion',    concepto: 'Wedding planner' },
  { category: 'Venue',         concepto: 'Hospedaje / suite nupcial' },
  { category: 'Bebidas',       concepto: 'Barra premium / mixología' },
  { category: 'Audio y Video', concepto: 'Cabina de fotos' },
  { category: 'Audio y Video', concepto: 'Dron / video aéreo' },
  { category: 'Entretenimiento', concepto: 'Segundo show o DJ after' },
  { category: 'Decoracion',    concepto: 'Diseño floral premium' },
  { category: 'Logistica',     concepto: 'Valet parking' },
  { category: 'Logistica',     concepto: 'Seguridad' },
  { category: 'Recuerdos',     concepto: 'Mesa de dulces (candy bar)' },
  { category: 'Digital',       concepto: 'Sitio web de boda / RSVP' },
  { category: 'Imagen',        concepto: 'Cambio de vestido' },
]

const SOCIAL: BudgetItemTpl[] = [
  { category: 'Venue',         concepto: 'Lugar / Salon' },
  { category: 'Banquete',      concepto: 'Comida (catering)' },
  { category: 'Banquete',      concepto: 'Pastel' },
  { category: 'Bebidas',       concepto: 'Bebidas' },
  { category: 'Audio y Video', concepto: 'DJ o música' },
  { category: 'Audio y Video', concepto: 'Fotografía' },
  { category: 'Decoracion',    concepto: 'Decoración y temática' },
  { category: 'Papeleria',     concepto: 'Invitaciones' },
  { category: 'Entretenimiento', concepto: 'Entretenimiento o show' },
  { category: 'Recuerdos',     concepto: 'Recuerdos' },
]

const CORPORATIVO: BudgetItemTpl[] = [
  { category: 'Planeacion',    concepto: 'Organización y coordinación' },
  { category: 'Venue',         concepto: 'Sede' },
  { category: 'Banquete',      concepto: 'Catering / coffee break' },
  { category: 'Audio y Video', concepto: 'AV y producción' },
  { category: 'Audio y Video', concepto: 'Fotografia y video' },
  { category: 'Decoracion',    concepto: 'Branding y ambientación' },
  { category: 'Papeleria',     concepto: 'Material impreso y gafetes' },
  { category: 'Entretenimiento', concepto: 'Ponentes o talento' },
  { category: 'Logistica',     concepto: 'Transporte y hospedaje' },
  { category: 'Digital',       concepto: 'Plataforma de registro' },
]

export function getBodaItems(tier: BudgetTier): BudgetItemTpl[] {
  if (tier === 'esencial') return BODA_ESENCIAL
  if (tier === 'clasica') return [...BODA_ESENCIAL, ...BODA_CLASICA_EXTRA]
  return [...BODA_ESENCIAL, ...BODA_CLASICA_EXTRA, ...BODA_PREMIUM_EXTRA]
}

export function getSuggestedItems(eventType: string | null, eventCategory: string | null): { category: string; concepto: string }[] {
  if (eventType === 'boda') return getBodaItems('clasica')
  if (eventCategory === 'corporativo') return CORPORATIVO
  return SOCIAL
}

export function buildBudgetItems(
  eventId: string,
  eventType: string | null,
  eventCategory: string | null,
  tier: BudgetTier,
  existingKeys: Set<string>,
): SuggestedBudgetRow[] {
  let items: BudgetItemTpl[]
  if (eventType === 'boda') items = getBodaItems(tier)
  else if (eventCategory === 'corporativo') items = CORPORATIVO
  else items = SOCIAL

  return items
    .filter(it => !existingKeys.has(`${it.category}|${it.concepto}`.toLowerCase()))
    .map(it => ({
      event_id:          eventId,
      category:          it.category,
      subcategory:       it.concepto,
      budget_amount:     0,
      event_supplier_id: null,
      notes:             null,
    }))
}
