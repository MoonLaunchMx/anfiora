import { describe, it, expect } from 'vitest'
import { pickAudioMime, extForMime, formatTimer } from './audio-recording'

describe('pickAudioMime', () => {
  it('prefers webm/opus when supported', () => {
    expect(pickAudioMime(() => true)).toBe('audio/webm;codecs=opus')
  })

  it('falls back to mp4 for Safari-like support', () => {
    expect(pickAudioMime(m => m === 'audio/mp4')).toBe('audio/mp4')
  })

  it('returns empty string when nothing is supported', () => {
    expect(pickAudioMime(() => false)).toBe('')
  })
})

describe('extForMime', () => {
  it('maps common audio mimes to extensions', () => {
    expect(extForMime('audio/webm;codecs=opus')).toBe('webm')
    expect(extForMime('audio/mp4')).toBe('m4a')
    expect(extForMime('audio/ogg')).toBe('ogg')
    expect(extForMime('audio/mpeg')).toBe('mp3')
    expect(extForMime('audio/wav')).toBe('wav')
  })

  it('defaults to webm for unknown or empty mime', () => {
    expect(extForMime('')).toBe('webm')
    expect(extForMime('application/octet-stream')).toBe('webm')
  })
})

describe('formatTimer', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatTimer(0)).toBe('00:00')
    expect(formatTimer(5)).toBe('00:05')
    expect(formatTimer(65)).toBe('01:05')
    expect(formatTimer(600)).toBe('10:00')
  })

  it('clamps negatives and floors decimals', () => {
    expect(formatTimer(-3)).toBe('00:00')
    expect(formatTimer(9.9)).toBe('00:09')
  })
})
