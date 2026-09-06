import { describe, it, expect } from 'vitest'
import {
  EJES, EJES_PROPUESTA, EJES_DESEMPENO, ANCLAS,
  anclasDe, NOMBRE_EJE, ANCLAS_RECONTRATACION,
} from './ejes'

describe('los cinco ejes', () => {
  it('son cinco y siempre en el mismo orden', () => {
    expect(EJES).toEqual([
      'precio_valor', 'calidad', 'comunicacion', 'servicio_trato', 'manejo_imprevistos',
    ])
  })

  it('la propuesta solo observa tres', () => {
    expect(EJES_PROPUESTA).toEqual(['precio_valor', 'calidad', 'comunicacion'])
  })

  it('el desempeno observa los cinco, en el mismo orden', () => {
    expect(EJES_DESEMPENO).toEqual([...EJES])
  })

  it('todos los ejes tienen nombre visible', () => {
    for (const eje of EJES) {
      expect(NOMBRE_EJE[eje]).toBeTruthy()
    }
  })
})

describe('anclasDe', () => {
  it('cada eje observable trae exactamente cinco anclas', () => {
    for (const eje of EJES_PROPUESTA) {
      expect(anclasDe('propuesta', eje)).toHaveLength(5)
    }
    for (const eje of EJES_DESEMPENO) {
      expect(anclasDe('desempeno', eje)).toHaveLength(5)
    }
  })

  it('ningun ancla viene vacia', () => {
    for (const eje of EJES_DESEMPENO) {
      for (const texto of anclasDe('desempeno', eje)) {
        expect(texto.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('el ancla 1 de comunicacion cambia entre contextos', () => {
    expect(anclasDe('propuesta', 'comunicacion')[0]).toBe('Nunca respondió')
    expect(anclasDe('desempeno', 'comunicacion')[0]).toBe('Imposible localizarlo')
  })

  it('un eje que no aplica al contexto devuelve lista vacia', () => {
    expect(anclasDe('propuesta', 'servicio_trato')).toEqual([])
    expect(anclasDe('propuesta', 'manejo_imprevistos')).toEqual([])
  })

  it('recontratacion tiene sus cinco anclas', () => {
    expect(ANCLAS_RECONTRATACION).toHaveLength(5)
    expect(ANCLAS_RECONTRATACION[0]).toBe('No, rotundamente')
    expect(ANCLAS_RECONTRATACION[4]).toBe('Definitivamente sí, es mi primera opción')
  })
})
