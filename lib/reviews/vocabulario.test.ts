import { describe, it, expect } from 'vitest'
import {
  MOTIVOS_DESCARTE, RAZONES_SELECCION,
  MOTIVO_DESCARTE_LABEL, RAZON_SELECCION_LABEL,
  MAX_RAZONES_SELECCION, MAX_COMENTARIOS,
} from '@/lib/types'

describe('motivos de descarte', () => {
  it('son exactamente siete', () => {
    expect(MOTIVOS_DESCARTE).toHaveLength(7)
  })

  it('todos tienen etiqueta visible', () => {
    for (const motivo of MOTIVOS_DESCARTE) {
      expect(MOTIVO_DESCARTE_LABEL[motivo]).toBeTruthy()
    }
  })

  it('incluye el caso de que el cliente eligio a otro', () => {
    expect(MOTIVOS_DESCARTE).toContain('cliente_eligio_otro')
    expect(MOTIVO_DESCARTE_LABEL.cliente_eligio_otro).toBe('El cliente eligió a otro')
  })
})

describe('razones de seleccion', () => {
  it('son exactamente ocho', () => {
    expect(RAZONES_SELECCION).toHaveLength(8)
  })

  it('todas tienen etiqueta visible', () => {
    for (const razon of RAZONES_SELECCION) {
      expect(RAZON_SELECCION_LABEL[razon]).toBeTruthy()
    }
  })

  it('se pueden elegir maximo dos', () => {
    expect(MAX_RAZONES_SELECCION).toBe(2)
  })
})

describe('limite de comentarios', () => {
  it('son 500 caracteres', () => {
    expect(MAX_COMENTARIOS).toBe(500)
  })
})
