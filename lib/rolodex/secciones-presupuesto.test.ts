import { describe, it, expect } from 'vitest'
import {
  SECCION_SIN_CATEGORIA, seccionesDelPresupuesto, agruparPorSeccion,
} from './secciones-presupuesto'
import type { Categoria } from './categorias-store'

const cat = (id: string, name: string, archived_at: string | null = null): Categoria =>
  ({ id, name, archived_at })

const VENUE     = cat('1', 'Venue')
const PLANEACION = cat('2', 'Planeación')
const TRANSPORTE = cat('3', 'Transporte')

describe('seccionesDelPresupuesto', () => {
  it('las secciones salen de la tabla, no de una lista fija', () => {
    expect(seccionesDelPresupuesto([VENUE, TRANSPORTE], null))
      .toEqual(['Venue', 'Transporte'])
  })

  it('una categoria recien creada aparece aunque el orden guardado no la mencione', () => {
    expect(seccionesDelPresupuesto([VENUE, TRANSPORTE], ['Venue']))
      .toEqual(['Venue', 'Transporte'])
  })

  it('un orden guardado sin acento no duplica la seccion acentuada de la tabla', () => {
    const secciones = seccionesDelPresupuesto([PLANEACION, VENUE], ['Planeacion', 'Venue'])
    expect(secciones).toEqual(['Planeación', 'Venue'])
    expect(secciones.filter(s => s.toLowerCase().startsWith('plane'))).toHaveLength(1)
  })

  it('el orden guardado manda sobre el alfabetico de la tabla', () => {
    expect(seccionesDelPresupuesto([VENUE, PLANEACION, TRANSPORTE], ['Transporte', 'Planeación']))
      .toEqual(['Transporte', 'Planeación', 'Venue'])
  })

  it('una categoria archivada deja de ser seccion', () => {
    expect(seccionesDelPresupuesto([VENUE, cat('9', 'Vieja', '2026-01-01')], null))
      .toEqual(['Venue'])
  })

  it('un nombre del orden guardado que ya no existe en la tabla no inventa seccion', () => {
    expect(seccionesDelPresupuesto([VENUE], ['Venue', 'Borrada']))
      .toEqual(['Venue'])
  })
})

describe('agruparPorSeccion', () => {
  const secciones = ['Venue', 'Planeación']
  const categorias = [VENUE, PLANEACION, cat('9', 'Archivada', '2026-01-01')]

  it('cada partida cae en la seccion de su categoria', () => {
    const partidas = [{ id: 'a', category_id: '1' }, { id: 'b', category_id: '2' }]
    const r = agruparPorSeccion(partidas, secciones, categorias)
    expect(r.secciones).toEqual(['Venue', 'Planeación'])
    expect(r.porSeccion['Venue'].map(p => p.id)).toEqual(['a'])
    expect(r.porSeccion['Planeación'].map(p => p.id)).toEqual(['b'])
  })

  it('una partida cuya categoria esta archivada cae en el cajon de rescate', () => {
    const r = agruparPorSeccion([{ id: 'a', category_id: '9' }], secciones, categorias)
    expect(r.secciones).toEqual(['Venue', 'Planeación', SECCION_SIN_CATEGORIA])
    expect(r.porSeccion[SECCION_SIN_CATEGORIA].map(p => p.id)).toEqual(['a'])
  })

  it('una partida sin categoria tampoco se pierde', () => {
    const r = agruparPorSeccion([{ id: 'a', category_id: null }], secciones, categorias)
    expect(r.porSeccion[SECCION_SIN_CATEGORIA].map(p => p.id)).toEqual(['a'])
  })

  it('sin huerfanas no se agrega el cajon de rescate', () => {
    const r = agruparPorSeccion([{ id: 'a', category_id: '1' }], secciones, categorias)
    expect(r.secciones).not.toContain(SECCION_SIN_CATEGORIA)
    expect(r.porSeccion[SECCION_SIN_CATEGORIA]).toBeUndefined()
  })

  it('ninguna partida se queda fuera del agrupado', () => {
    const partidas = [
      { id: 'a', category_id: '1' },
      { id: 'b', category_id: '9' },
      { id: 'c', category_id: null },
    ]
    const r = agruparPorSeccion(partidas, secciones, categorias)
    const total = r.secciones.reduce((n, s) => n + (r.porSeccion[s]?.length ?? 0), 0)
    expect(total).toBe(partidas.length)
  })
})
