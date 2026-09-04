import { DEFAULT_CATEGORIES_BY_TYPE } from '@/app/events/[id]/presupuesto/lib/categories'

// El vocabulario de categorias es del PLANNER, no de la boda. Sirve al Rolodex y
// a todos sus presupuestos: lo que teclea en una boda le queda para siempre.
// Cada evento sigue eligiendo cuales muestra — un corporativo y una boda no
// tienen los mismos cajones — pero el idioma es uno solo.

export const CATEGORIAS_BASE: string[] = [...DEFAULT_CATEGORIES_BY_TYPE.boda]

export function mismaCategoria(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function resolverVocabulario(guardado: string[] | null | undefined): string[] {
  const base = guardado && guardado.length > 0 ? [...guardado] : []
  for (const c of CATEGORIAS_BASE) {
    if (!base.some(x => mismaCategoria(x, c))) base.push(c)
  }
  return base
}

export function agregarAlVocabulario(vocabulario: string[], nombre: string): string[] {
  const limpio = nombre.trim()
  if (!limpio) return vocabulario
  if (vocabulario.some(c => mismaCategoria(c, limpio))) return vocabulario
  return [...vocabulario, limpio]
}
