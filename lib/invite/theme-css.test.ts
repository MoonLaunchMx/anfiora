import { describe, it, expect } from 'vitest'
import { themeCssVars, botonClass } from './theme-css'
import { DEFAULT_THEME } from './theme'

describe('theme-css', () => {
  it('maps colors and radius to CSS variables', () => {
    const vars = themeCssVars(DEFAULT_THEME)
    expect(vars['--inv-fondo']).toBe('#FBF7F0')
    expect(vars['--inv-acento']).toBe('#d4a853')
    expect(vars['--inv-boton-radius']).toBe('999px') // pill
    expect(vars['--inv-acento-bg']).toContain('color-mix')
    expect(vars['--inv-acento-bg']).toContain('#d4a853')
  })

  it('uses pill radius for pill buttons', () => {
    const vars = themeCssVars({ ...DEFAULT_THEME, boton: { forma: 'pill', estilo: 'relleno' } })
    expect(vars['--inv-boton-radius']).toBe('999px')
  })

  it('botonClass includes the estilo modifier', () => {
    expect(botonClass(DEFAULT_THEME)).toBe('inv-btn inv-btn-relleno')
  })
})
