import { describe, it, expect } from 'vitest'
import { ThemeSchema, DEFAULT_THEME } from './theme'

describe('ThemeSchema', () => {
  it('parses the default theme unchanged', () => {
    const parsed = ThemeSchema.parse(DEFAULT_THEME)
    expect(parsed.vibeId).toBe('clasico')
    expect(parsed.colores.acento).toBe('#d4a853')
    expect(parsed.boton.forma).toBe('pill')
  })

  it('fills defaults for a partial theme', () => {
    const parsed = ThemeSchema.parse({ vibeId: 'fiesta' })
    expect(parsed.vibeId).toBe('fiesta')
    expect(parsed.colores.fondo).toBeTypeOf('string')
    expect(parsed.fonts.cuerpo).toBeTypeOf('string')
    expect(parsed.boton.estilo).toBeTypeOf('string')
  })

  it('rejects an invalid button forma', () => {
    const bad = { ...DEFAULT_THEME, boton: { forma: 'circulo', estilo: 'relleno' } }
    expect(ThemeSchema.safeParse(bad).success).toBe(false)
  })
})
