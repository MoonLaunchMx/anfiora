import { describe, it, expect } from 'vitest'
import { VIBES, VIBE_IDS, getVibe } from './vibes'
import { ThemeSchema } from './theme'

describe('vibes registry', () => {
  it('has 21 vibes with unique ids', () => {
    expect(VIBES).toHaveLength(21)
    expect(new Set(VIBE_IDS).size).toBe(21)
  })

  it('every vibe theme parses against ThemeSchema and its vibeId matches its id', () => {
    for (const v of VIBES) {
      expect(() => ThemeSchema.parse(v.theme)).not.toThrow()
      expect(v.theme.vibeId).toBe(v.id)
    }
  })

  it('getVibe returns anfiora-claro for unknown ids', () => {
    expect(getVibe('no-existe').id).toBe('anfiora-claro')
    expect(getVibe('fiesta').id).toBe('fiesta')
  })
})
