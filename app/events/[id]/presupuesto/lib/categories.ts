import { BUDGET_CATEGORY_LABELS, EventBudget } from '@/lib/types'

type TypeKey = 'boda' | 'social' | 'corporativo' | 'impacto'

export const DEFAULT_CATEGORIES_BY_TYPE: Record<TypeKey, string[]> = {
  boda:        ['Venue','Banquete','Bebidas','Audio y Video','Imagen','Decoracion','Ceremonia','Entretenimiento','Papeleria','Planeacion','Logistica','Recuerdos','Digital','Otro'],
  social:      ['Venue','Banquete','Bebidas','Audio y Video','Decoracion','Entretenimiento','Imagen','Papeleria','Recuerdos','Logistica','Digital','Otro'],
  corporativo: ['Planeacion','Venue','Banquete','Bebidas','Audio y Video','Decoracion','Papeleria','Entretenimiento','Logistica','Digital','Otro'],
  impacto:     ['Planeacion','Venue','Banquete','Bebidas','Audio y Video','Decoracion','Papeleria','Entretenimiento','Logistica','Digital','Otro'],
}

export function resolveTypeKey(eventType: string | null, eventCategory: string | null): TypeKey {
  if (eventType === 'boda') return 'boda'
  if (eventCategory === 'corporativo') return 'corporativo'
  if (eventCategory === 'impacto') return 'impacto'
  return 'social'
}

export function categoryLabel(name: string): string {
  return (BUDGET_CATEGORY_LABELS as Record<string, string>)[name] ?? name
}

export function getEventCategories(
  stored: string[] | null | undefined,
  eventType: string | null,
  eventCategory: string | null,
  budgets: Pick<EventBudget, 'category'>[],
): string[] {
  const base = (stored && stored.length > 0)
    ? [...stored]
    : [...DEFAULT_CATEGORIES_BY_TYPE[resolveTypeKey(eventType, eventCategory)]]
  const seen = new Set(base.map(c => c.toLowerCase()))
  for (const b of budgets) {
    const c = b.category as string
    if (c && !seen.has(c.toLowerCase())) { base.push(c); seen.add(c.toLowerCase()) }
  }
  return base
}
