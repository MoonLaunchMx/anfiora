import { describe, it, expect } from 'vitest'
import { SectionSchema } from './schema'

describe('media section', () => {
  it('parses a media section with url + caption', () => {
    const r = SectionSchema.safeParse({ id: 'm1', type: 'media', content: { url: 'https://x/y.gif', caption: 'hi' } })
    expect(r.success).toBe(true)
  })

  it('fills content defaults', () => {
    const r = SectionSchema.safeParse({ id: 'm2', type: 'media', content: {} })
    expect(r.success).toBe(true)
  })
})
