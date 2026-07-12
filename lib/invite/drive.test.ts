import { describe, it, expect } from 'vitest'
import { parseDriveUrl } from './drive'

const ID = '1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUv'

describe('parseDriveUrl', () => {
  it('parses a /file/d/{id}/view URL', () => {
    const d = parseDriveUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)
    expect(d?.id).toBe(ID)
    expect(d?.embedUrl).toBe(`https://drive.google.com/file/d/${ID}/preview`)
  })

  it('parses a /file/d/{id}/preview URL', () => {
    const d = parseDriveUrl(`https://drive.google.com/file/d/${ID}/preview`)
    expect(d?.id).toBe(ID)
  })

  it('parses a /file/d/{id} URL without suffix', () => {
    const d = parseDriveUrl(`https://drive.google.com/file/d/${ID}`)
    expect(d?.id).toBe(ID)
  })

  it('parses an open?id={id} URL', () => {
    const d = parseDriveUrl(`https://drive.google.com/open?id=${ID}`)
    expect(d?.id).toBe(ID)
  })

  it('parses a uc?id={id} URL', () => {
    const d = parseDriveUrl(`https://drive.google.com/uc?export=download&id=${ID}`)
    expect(d?.id).toBe(ID)
  })

  it('accepts a URL without protocol', () => {
    const d = parseDriveUrl(`drive.google.com/file/d/${ID}/view`)
    expect(d?.id).toBe(ID)
  })

  it('returns null for empty or invalid input', () => {
    expect(parseDriveUrl('')).toBeNull()
    expect(parseDriveUrl('   ')).toBeNull()
    expect(parseDriveUrl('not a url')).toBeNull()
    expect(parseDriveUrl('https://example.com/file/d/abc/view')).toBeNull()
    expect(parseDriveUrl('https://drive.google.com/drive/folders/xyz')).toBeNull()
  })
})
