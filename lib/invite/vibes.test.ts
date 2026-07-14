import { describe, it, expect } from 'vitest'
import { VIBES, VIBE_IDS, getVibe } from './vibes'
import { ThemeSchema } from './theme'

describe('vibes registry', () => {
  it('has 22 vibes with unique ids', () => {
    expect(VIBES).toHaveLength(22)
    expect(new Set(VIBE_IDS).size).toBe(22)
  })

  it('every vibe theme parses against ThemeSchema and its vibeId matches its id', () => {
    for (const v of VIBES) {
      expect(() => ThemeSchema.parse(v.theme)).not.toThrow()
      expect(v.theme.vibeId).toBe(v.id)
    }
  })

  it('getVibe returns clasico for unknown ids', () => {
    expect(getVibe('no-existe').id).toBe('clasico')
    expect(getVibe('fiesta').id).toBe('fiesta')
  })
})
