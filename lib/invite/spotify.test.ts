import { describe, it, expect } from 'vitest'
import { parseSpotifyUrl } from './spotify'

describe('parseSpotifyUrl', () => {
  it('parses a track URL with si param', () => {
    const s = parseSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123')
    expect(s?.type).toBe('track')
    expect(s?.id).toBe('4cOdK2wGLETKBW3PvgPWqT')
    expect(s?.embedUrl).toBe('https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT')
    expect(s?.compact).toBe(true)
  })

  it('parses an album URL', () => {
    const s = parseSpotifyUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')
    expect(s?.type).toBe('album')
    expect(s?.compact).toBe(false)
  })

  it('parses a playlist URL', () => {
    const s = parseSpotifyUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')
    expect(s?.type).toBe('playlist')
    expect(s?.embedUrl).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')
  })

  it('parses an episode URL as compact', () => {
    const s = parseSpotifyUrl('https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ')
    expect(s?.type).toBe('episode')
    expect(s?.compact).toBe(true)
  })

  it('parses a show URL', () => {
    const s = parseSpotifyUrl('https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk')
    expect(s?.type).toBe('show')
  })

  it('parses a URL with intl locale prefix', () => {
    const s = parseSpotifyUrl('https://open.spotify.com/intl-es/track/4cOdK2wGLETKBW3PvgPWqT')
    expect(s?.type).toBe('track')
    expect(s?.id).toBe('4cOdK2wGLETKBW3PvgPWqT')
  })

  it('parses a spotify: URI', () => {
    const s = parseSpotifyUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT')
    expect(s?.type).toBe('track')
    expect(s?.id).toBe('4cOdK2wGLETKBW3PvgPWqT')
  })

  it('accepts a URL without protocol', () => {
    const s = parseSpotifyUrl('open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')
    expect(s?.id).toBe('4cOdK2wGLETKBW3PvgPWqT')
  })

  it('returns null for empty or invalid input', () => {
    expect(parseSpotifyUrl('')).toBeNull()
    expect(parseSpotifyUrl('   ')).toBeNull()
    expect(parseSpotifyUrl('not a url')).toBeNull()
    expect(parseSpotifyUrl('https://example.com/track/123')).toBeNull()
    expect(parseSpotifyUrl('https://open.spotify.com/track/')).toBeNull()
  })
})
