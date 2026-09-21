import { DEFAULT_CATEGORIES_BY_TYPE } from '@/app/events/[id]/presupuesto/lib/categories'

// El vocabulario de categorias es del PLANNER, no de la boda. Sirve al Rolodex y
// a todos sus presupuestos: lo que teclea en una boda le queda para siempre.
// Cada evento sigue eligiendo cuales muestra — un corporativo y una boda no
// tienen los mismos cajones — pero el idioma es uno solo.

export const CATEGORIAS_BASE: string[] = [...DEFAULT_CATEGORIES_BY_TYPE.boda]

// Normaliza una cadena removiendo acentos, espacios y mayusculas.
// Las categorias base se guardan sin acento (ej: 'Decoracion') pero se muestran
// con acento, por lo que sin esta normalizacion el planner que ve "Decoracion"
// con acento y la tipea creyendo que falta terminaria duplicando la entrada.
// La normalizacion tambien junta la ene con tilde (n~) con la ene simple: es
// a proposito, ya que un dedazo sin tilde es mucho mas probable que dos
// categorias que solo se distingan por ella.
export function normalizarCategoria(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function mismaCategoria(a: string, b: string): boolean {
  return normalizarCategoria(a) === normalizarCategoria(b)
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
