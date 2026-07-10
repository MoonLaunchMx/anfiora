import { describe, it, expect } from 'vitest'
import { fontStack, googleFontsHref, FONTS } from './fonts'

describe('fonts', () => {
  it('every vibe/toolkit font id is defined', () => {
    for (const id of ['josefin-sans', 'pacifico', 'bungee-inline', 'monoton', 'anton', 'abril-fatface', 'cormorant-garamond-italic']) {
      expect(FONTS[id]).toBeTruthy()
    }
  })

  it('fontStack falls back for unknown id', () => {
    expect(fontStack('no-existe')).toContain('sans-serif')
  })

  it('googleFontsHref builds one url with the requested families and display=swap', () => {
    const href = googleFontsHref(['pacifico', 'monoton'])
    expect(href).toContain('family=Pacifico')
    expect(href).toContain('family=Monoton')
    expect(href).toContain('display=swap')
  })

  it('googleFontsHref returns null when no google fonts requested', () => {
    expect(googleFontsHref(['general-sans'])).toBeNull()
  })
})
