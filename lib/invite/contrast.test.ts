import { describe, it, expect } from 'vitest'
import { relativeLuminance, readableTextColor } from './contrast'

describe('relativeLuminance', () => {
  it('is 1 for white and ~0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('supports shorthand hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('fff')).toBeCloseTo(1, 5)
  })

  it('returns null for invalid input', () => {
    expect(relativeLuminance('rojo')).toBeNull()
    expect(relativeLuminance('')).toBeNull()
  })
})

describe('readableTextColor', () => {
  it('picks dark text on light backgrounds', () => {
    expect(readableTextColor('#ffffff')).toBe('#1D1E20')
    expect(readableTextColor('#FBF7F0')).toBe('#1D1E20')
    expect(readableTextColor('#F4C430')).toBe('#1D1E20')
  })

  it('picks light text on dark backgrounds', () => {
    expect(readableTextColor('#000000')).toBe('#ffffff')
    expect(readableTextColor('#1D1E20')).toBe('#ffffff')
    expect(readableTextColor('#0d5a6e')).toBe('#ffffff')
  })

  it('averages the stops of a gradient', () => {
    expect(readableTextColor('linear-gradient(135deg, #000000, #111111)')).toBe('#ffffff')
    expect(readableTextColor('linear-gradient(135deg, #ffffff, #f0f0f0)')).toBe('#1D1E20')
  })

  it('falls back to dark text when no hex is present', () => {
    expect(readableTextColor('')).toBe('#1D1E20')
    expect(readableTextColor('rgb(0,0,0)')).toBe('#1D1E20')
  })

  it('honors custom dark/light candidates', () => {
    expect(readableTextColor('#000000', '#222222', '#eeeeee')).toBe('#eeeeee')
  })
})
