import { BUDGET_CATEGORY_LABELS } from '@/lib/types'

type TypeKey = 'boda' | 'social' | 'corporativo' | 'impacto'

// Semilla del vocabulario, NO la lista de secciones del presupuesto. Las
// secciones salen de la tabla `categories` (ver seccionesDelPresupuesto).
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
