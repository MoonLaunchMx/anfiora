import { describe, it, expect } from 'vitest'
import { puedeAdministrarCategorias } from './administrar-categorias'

describe('puedeAdministrarCategorias', () => {
  it('el dueño de su despacho siempre entra, incluso con la fila de membresia en error', () => {
    expect(puedeAdministrarCategorias(null, new Error('caido'), true)).toBe(true)
  })

  it('el dueño de su despacho entra sin fila de membresia y sin error', () => {
    expect(puedeAdministrarCategorias(null, null, true)).toBe(true)
  })

  it('un admin del despacho entra', () => {
    expect(puedeAdministrarCategorias({ rol: 'admin' }, null, false)).toBe(true)
  })

  it('una fila con rol dueno entra aunque no se haya resuelto esDueno', () => {
    expect(puedeAdministrarCategorias({ rol: 'dueno' }, null, false)).toBe(true)
  })

  it('un editor/colaborador no entra', () => {
    expect(puedeAdministrarCategorias({ rol: 'colaborador' }, null, false)).toBe(false)
  })

  it('un error de lectura no entra', () => {
    expect(puedeAdministrarCategorias(null, new Error('caido'), false)).toBe(false)
  })

  it('sin fila de membresia no entra', () => {
    expect(puedeAdministrarCategorias(null, null, false)).toBe(false)
  })
})
