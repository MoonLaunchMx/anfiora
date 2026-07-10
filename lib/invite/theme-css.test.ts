import { describe, it, expect } from 'vitest'
import { themeCssVars, botonClass } from './theme-css'
import { DEFAULT_THEME } from './theme'

describe('theme-css', () => {
  it('maps colors and radius to CSS variables', () => {
    const vars = themeCssVars(DEFAULT_THEME)
    expect(vars['--inv-fondo']).toBe('#ffffff')
    expect(vars['--inv-acento']).toBe('#48C9B0')
    expect(vars['--inv-boton-radius']).toBe('10px') // redondo
  })

  it('uses pill radius for pill buttons', () => {
    const vars = themeCssVars({ ...DEFAULT_THEME, boton: { forma: 'pill', estilo: 'relleno' } })
    expect(vars['--inv-boton-radius']).toBe('999px')
  })

  it('botonClass includes the estilo modifier', () => {
    expect(botonClass(DEFAULT_THEME)).toBe('inv-btn inv-btn-elevado')
  })
})
