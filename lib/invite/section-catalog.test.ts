import { describe, it, expect } from 'vitest'
import type { SectionType } from './schema'
import { groupSectionTypes, SECTION_TYPE_CATEGORY, SECTION_CATEGORY_ORDER } from './section-catalog'

describe('groupSectionTypes', () => {
  it('groups types into ordered categories', () => {
    const types: SectionType[] = ['portada', 'media', 'audio', 'rsvp', 'video', 'texto']
    const groups = groupSectionTypes(types)
    expect(groups.map(g => g.key)).toEqual(['texto', 'visuales', 'audio', 'evento'])
    expect(groups.find(g => g.key === 'texto')?.types).toEqual(['portada', 'texto'])
    expect(groups.find(g => g.key === 'visuales')?.types).toEqual(['media', 'video'])
    expect(groups.find(g => g.key === 'audio')?.types).toEqual(['audio'])
    expect(groups.find(g => g.key === 'evento')?.types).toEqual(['rsvp'])
  })

  it('omits empty categories', () => {
    const groups = groupSectionTypes(['audio'])
    expect(groups.map(g => g.key)).toEqual(['audio'])
  })

  it('returns nothing for an empty input', () => {
    expect(groupSectionTypes([])).toEqual([])
  })

  it('categorizes every section type', () => {
    for (const key of Object.keys(SECTION_TYPE_CATEGORY) as SectionType[]) {
      expect(SECTION_CATEGORY_ORDER).toContain(SECTION_TYPE_CATEGORY[key])
    }
  })
})
