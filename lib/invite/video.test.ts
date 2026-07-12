import { describe, it, expect } from 'vitest'
import { parseVideoUrl } from './video'

describe('parseVideoUrl - YouTube', () => {
  it('parses a standard watch URL', () => {
    const v = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(v?.provider).toBe('youtube')
    expect(v?.id).toBe('dQw4w9WgXcQ')
    expect(v?.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(v?.aspect).toBe('landscape')
    expect(v?.poster).toContain('dQw4w9WgXcQ')
  })

  it('parses a youtu.be short link', () => {
    const v = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')
    expect(v?.id).toBe('dQw4w9WgXcQ')
  })

  it('parses a shorts URL', () => {
    const v = parseVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')
    expect(v?.provider).toBe('youtube')
    expect(v?.id).toBe('dQw4w9WgXcQ')
  })

  it('parses an embed URL', () => {
    const v = parseVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0')
    expect(v?.id).toBe('dQw4w9WgXcQ')
  })

  it('ignores extra query params on watch', () => {
    const v = parseVideoUrl('https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc')
    expect(v?.id).toBe('dQw4w9WgXcQ')
  })

  it('rejects a watch URL without a valid id', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=short')).toBeNull()
  })
})

describe('parseVideoUrl - TikTok', () => {
  it('parses a full video URL', () => {
    const v = parseVideoUrl('https://www.tiktok.com/@usuario/video/7212345678901234567')
    expect(v?.provider).toBe('tiktok')
    expect(v?.id).toBe('7212345678901234567')
    expect(v?.embedUrl).toBe('https://www.tiktok.com/embed/v2/7212345678901234567')
    expect(v?.aspect).toBe('portrait')
  })

  it('parses an embed URL', () => {
    const v = parseVideoUrl('https://www.tiktok.com/embed/v2/7212345678901234567')
    expect(v?.id).toBe('7212345678901234567')
  })

  it('rejects a vm short link with no numeric id', () => {
    expect(parseVideoUrl('https://vm.tiktok.com/ZMabcd123/')).toBeNull()
  })
})

describe('parseVideoUrl - Instagram', () => {
  it('parses a reel URL', () => {
    const v = parseVideoUrl('https://www.instagram.com/reel/CxYz-123_ab/')
    expect(v?.provider).toBe('instagram')
    expect(v?.id).toBe('CxYz-123_ab')
    expect(v?.embedUrl).toBe('https://www.instagram.com/reel/CxYz-123_ab/embed')
    expect(v?.aspect).toBe('portrait')
  })

  it('normalizes reels to reel', () => {
    const v = parseVideoUrl('https://www.instagram.com/reels/CxYz-123_ab/')
    expect(v?.embedUrl).toBe('https://www.instagram.com/reel/CxYz-123_ab/embed')
  })

  it('parses a post URL', () => {
    const v = parseVideoUrl('https://instagram.com/p/CxYz-123_ab/')
    expect(v?.embedUrl).toBe('https://www.instagram.com/p/CxYz-123_ab/embed')
  })
})

describe('parseVideoUrl - invalid', () => {
  it('returns null for empty', () => {
    expect(parseVideoUrl('')).toBeNull()
    expect(parseVideoUrl('   ')).toBeNull()
  })

  it('returns null for unrelated URLs', () => {
    expect(parseVideoUrl('https://example.com/video/123')).toBeNull()
    expect(parseVideoUrl('not a url')).toBeNull()
  })

  it('accepts a URL without protocol', () => {
    const v = parseVideoUrl('youtu.be/dQw4w9WgXcQ')
    expect(v?.id).toBe('dQw4w9WgXcQ')
  })
})
