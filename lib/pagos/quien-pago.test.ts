import { describe, it, expect } from 'vitest'
import { etiquetaQuienPago, filtrarSugerencias, sugerenciasDesdeHistorial } from './quien-pago'

describe('etiquetaQuienPago', () => {
  it('traduce una clave heredada a su etiqueta', () => {
    expect(etiquetaQuienPago('papas_novia')).toBe('Papás de la novia')
    expect(etiquetaQuienPago('novia')).toBe('Novia')
  })

  it('deja pasar un valor libre sin traducir', () => {
    expect(etiquetaQuienPago('Papás de Olivia')).toBe('Papás de Olivia')
  })

  it('un valor vacio o nulo se muestra vacio', () => {
    expect(etiquetaQuienPago(null)).toBe('')
    expect(etiquetaQuienPago(undefined)).toBe('')
    expect(etiquetaQuienPago('  ')).toBe('')
  })
})

describe('sugerenciasDesdeHistorial', () => {
  it('quita duplicados y vacios, conservando la primera aparicion (la mas reciente)', () => {
    const historial = ['Ana', null, 'Luis', 'Ana', '', 'Marta', 'Luis', undefined]
    expect(sugerenciasDesdeHistorial(historial)).toEqual(['Ana', 'Luis', 'Marta'])
  })

  it('sin historial regresa vacio', () => {
    expect(sugerenciasDesdeHistorial([])).toEqual([])
  })
})

describe('filtrarSugerencias', () => {
  const sugerencias = ['Ana', 'papas_novia', 'José', 'Marta']

  it('filtra sin importar mayusculas o acentos', () => {
    expect(filtrarSugerencias(sugerencias, 'jose')).toEqual(['José'])
    expect(filtrarSugerencias(sugerencias, 'ANA')).toEqual(['Ana'])
    expect(filtrarSugerencias(sugerencias, 'JOSÉ')).toEqual(['José'])
  })

  it('busca sobre la etiqueta, no sobre la clave cruda', () => {
    expect(filtrarSugerencias(sugerencias, 'papas')).toEqual(['papas_novia'])
  })

  it('un valor libre nuevo pasa la busqueda tal cual, sin traduccion', () => {
    expect(filtrarSugerencias(['Papás de Olivia'], 'olivia')).toEqual(['Papás de Olivia'])
  })

  it('sin consulta regresa todo, en el mismo orden', () => {
    expect(filtrarSugerencias(sugerencias, '')).toEqual(sugerencias)
  })

  it('sin coincidencias regresa vacio', () => {
    expect(filtrarSugerencias(sugerencias, 'xyz')).toEqual([])
  })
})
