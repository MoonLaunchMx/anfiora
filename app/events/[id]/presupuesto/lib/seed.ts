import { BudgetCategory, EventBudgetInsert } from '@/lib/types'

type SeedItem = { category: BudgetCategory; subcategory: string }

const SEED_ITEMS: SeedItem[] = [
  { category: 'Venue',         subcategory: 'Recepcion' },
  { category: 'Banquete',      subcategory: 'Catering' },
  { category: 'Banquete',      subcategory: 'Pastel' },
  { category: 'Bebidas',       subcategory: 'Barra/Cocteleria' },
  { category: 'Audio y Video', subcategory: 'DJ' },
  { category: 'Audio y Video', subcategory: 'Fotografia' },
  { category: 'Imagen',        subcategory: 'Hair & Makeup' },
  { category: 'Imagen',        subcategory: 'Vestido novia' },
  { category: 'Decoracion',    subcategory: 'Floristas' },
  { category: 'Papeleria',     subcategory: 'Invitaciones' },
]

export function buildSeedBudgets(eventId: string): EventBudgetInsert[] {
  return SEED_ITEMS.map(item => ({
    event_id:          eventId,
    category:          item.category,
    subcategory:       item.subcategory,
    budget_amount:     0,
    event_supplier_id: null,
    notes:             null,
  }))
}