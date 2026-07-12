import { describe, it, expect } from 'vitest'
import { buildMapsUrl } from './maps'

describe('buildMapsUrl', () => {
  it('uses the explicit link when present', () => {
    expect(buildMapsUrl('https://maps.app.goo.gl/abc', 'Av. Reforma 1')).toBe('https://maps.app.goo.gl/abc')
  })

  it('trims the explicit link', () => {
    expect(buildMapsUrl('  https://maps.app.goo.gl/abc  ', null)).toBe('https://maps.app.goo.gl/abc')
  })

  it('builds a search URL from the address when no link', () => {
    expect(buildMapsUrl('', 'Av. Reforma 1, CDMX')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Reforma%201%2C%20CDMX',
    )
  })

  it('returns null when there is neither link nor address', () => {
    expect(buildMapsUrl('', '')).toBeNull()
    expect(buildMapsUrl('   ', null)).toBeNull()
    expect(buildMapsUrl('', undefined)).toBeNull()
  })
})
