import { describe, it, expect } from 'vitest'
import { velocidadAComunicacion, comentarioHeredado } from './migracion'

describe('velocidadAComunicacion', () => {
  it('mapea las cuatro velocidades viejas a la escala de cinco', () => {
    expect(velocidadAComunicacion('lentisimo')).toBe(2)
    expect(velocidadAComunicacion('normal')).toBe(3)
    expect(velocidadAComunicacion('bueno')).toBe(4)
    expect(velocidadAComunicacion('rapidos')).toBe(5)
  })

  it('nunca devuelve 1: la escala vieja no tenia ese caso', () => {
    for (const v of ['lentisimo', 'normal', 'bueno', 'rapidos'] as const) {
      expect(velocidadAComunicacion(v)).toBeGreaterThan(1)
    }
  })
})

describe('comentarioHeredado', () => {
  it('conserva las estrellas viejas como texto', () => {
    expect(comentarioHeredado(5, null, null)).toBe('Reseña anterior: 5 de 5.')
  })

  it('traduce el trato', () => {
    expect(comentarioHeredado(null, 'love', null)).toBe('Reseña anterior: trato excelente.')
    expect(comentarioHeredado(null, 'normal', null)).toBe('Reseña anterior: trato normal.')
    expect(comentarioHeredado(null, 'no', null)).toBe('Reseña anterior: mal trato.')
  })

  it('junta estrellas y trato en una sola linea', () => {
    expect(comentarioHeredado(5, 'love', null))
      .toBe('Reseña anterior: 5 de 5, trato excelente.')
  })

  it('el texto original va primero y se conserva completo', () => {
    expect(comentarioHeredado(4, 'normal', 'Llegaron tarde al montaje'))
      .toBe('Llegaron tarde al montaje\n\nReseña anterior: 4 de 5, trato normal.')
  })

  it('sin nada que heredar devuelve null', () => {
    expect(comentarioHeredado(null, null, null)).toBeNull()
    expect(comentarioHeredado(null, null, '   ')).toBeNull()
  })
})
