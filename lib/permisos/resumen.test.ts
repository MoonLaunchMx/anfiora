import { describe, it, expect } from 'vitest'
import { resumenPermisos } from './resumen'
import type { PermisosEvento } from './catalogo'

describe('resumenPermisos', () => {
  it('sin nada dice Sin acceso', () => {
    expect(resumenPermisos({}).texto).toBe('Sin acceso')
    expect(resumenPermisos(null).texto).toBe('Sin acceso')
    expect(resumenPermisos(undefined).texto).toBe('Sin acceso')
  })

  it('los ninguno explicitos tampoco cuentan', () => {
    const p = { invitados: 'ninguno', mesas: 'ninguno' } as PermisosEvento
    expect(resumenPermisos(p)).toMatchObject({ entra: 0, texto: 'Sin acceso' })
  })

  it('cuenta cuantas herramientas alcanza', () => {
    const p = { invitados: 'ver', mesas: 'ver', timeline: 'ver' } as PermisosEvento
    expect(resumenPermisos(p)).toMatchObject({ entra: 3, texto: 'Ve 3' })
  })

  it('manda el nivel mas alto, no el mas comun', () => {
    const p = { invitados: 'ver', mesas: 'ver', timeline: 'editar' } as PermisosEvento
    expect(resumenPermisos(p).texto).toBe('Edita 3')
  })

  it('un solo total pesa mas que diez ver', () => {
    const p = {
      invitados: 'ver', mesas: 'ver', timeline: 'ver', presupuesto: 'ver',
      proveedores: 'ver', pagos: 'total',
    } as PermisosEvento
    expect(resumenPermisos(p)).toMatchObject({ nivelTope: 'total', entra: 6, texto: 'Total 6' })
  })

  it('una sola herramienta se lee igual', () => {
    expect(resumenPermisos({ pagos: 'editar' } as PermisosEvento).texto).toBe('Edita 1')
  })

  it('ignora llaves que no son modulos del catalogo', () => {
    const p = { invitados: 'ver', inventado: 'total' } as unknown as PermisosEvento
    expect(resumenPermisos(p)).toMatchObject({ entra: 1, texto: 'Ve 1' })
  })
})
