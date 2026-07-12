import type { SectionType } from './schema'

export type SectionCategoryKey = 'texto' | 'visuales' | 'audio' | 'evento'

export const SECTION_CATEGORY_LABEL: Record<SectionCategoryKey, string> = {
  texto: 'Texto',
  visuales: 'Visuales',
  audio: 'Audio',
  evento: 'Del evento',
}

export const SECTION_CATEGORY_ORDER: SectionCategoryKey[] = ['texto', 'visuales', 'audio', 'evento']

// Record<SectionType, ...> obliga a categorizar TODOS los tipos (falla el tipado
// si se agrega un tipo nuevo al schema y se olvida mapearlo).
export const SECTION_TYPE_CATEGORY: Record<SectionType, SectionCategoryKey> = {
  portada: 'texto',
  saludo: 'texto',
  detalles: 'texto',
  texto: 'texto',
  cierre: 'texto',
  media: 'visuales',
  video: 'visuales',
  audio: 'audio',
  rsvp: 'evento',
  itinerario: 'evento',
  playlist: 'evento',
  mesa: 'evento',
  dress_code: 'evento',
  enganche: 'evento',
}

export type GroupedSectionTypes = {
  key: SectionCategoryKey
  label: string
  types: SectionType[]
}

export function groupSectionTypes(types: SectionType[]): GroupedSectionTypes[] {
  return SECTION_CATEGORY_ORDER
    .map(key => ({
      key,
      label: SECTION_CATEGORY_LABEL[key],
      types: types.filter(t => SECTION_TYPE_CATEGORY[t] === key),
    }))
    .filter(group => group.types.length > 0)
}
