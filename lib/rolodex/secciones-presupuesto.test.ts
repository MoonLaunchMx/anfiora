import { describe, it, expect } from 'vitest'
import {
  SECCION_SIN_CATEGORIA, seccionesDelPresupuesto, quitarDeSeleccion, tienePartidasEnEvento,
  agruparPorSeccion,
} from './secciones-presupuesto'
import type { Categoria } from './categorias-store'

const cat = (id: string, name: string, archived_at: string | null = null): Categoria =>
  ({ id, name, archived_at })

const VENUE     = cat('1', 'Venue')
const PLANEACION = cat('2', 'Planeación')
const TRANSPORTE = cat('3', 'Transporte')

describe('seccionesDelPresupuesto', () => {
  it('una seleccion vacia o nula muestra todas las categorias activas del catalogo', () => {
    expect(seccionesDelPresupuesto([VENUE, TRANSPORTE], null)).toEqual(['Venue', 'Transporte'])
    expect(seccionesDelPresupuesto([VENUE, TRANSPORTE], [])).toEqual(['Venue', 'Transporte'])
  })

  it('una seleccion no vacia filtra: solo entra lo elegido, en ese orden', () => {
    expect(seccionesDelPresupuesto([VENUE, PLANEACION, TRANSPORTE], ['Transporte', 'Planeación']))
      .toEqual(['Transporte', 'Planeación'])
  })

  it('una seleccion sin acento no duplica la seccion acentuada de la tabla', () => {
    const secciones = seccionesDelPresupuesto([PLANEACION, VENUE], ['Planeacion', 'Venue'])
    expect(secciones).toEqual(['Planeación', 'Venue'])
    expect(secciones.filter(s => s.toLowerCase().startsWith('plane'))).toHaveLength(1)
  })

  it('una categoria archivada deja de ser seccion aunque una seleccion vacia pediria "todas"', () => {
    expect(seccionesDelPresupuesto([VENUE, cat('9', 'Vieja', '2026-01-01')], null))
      .toEqual(['Venue'])
  })

  it('issue #67: una categoria viva con partidas se muestra aunque no este en la seleccion', () => {
    expect(seccionesDelPresupuesto([VENUE, PLANEACION, TRANSPORTE], ['Venue'], [{ category_id: '3' }]))
      .toEqual(['Venue', 'Transporte'])
  })

  it('la seleccion sigue escondiendo las categorias vacias', () => {
    expect(seccionesDelPresupuesto([VENUE, PLANEACION, TRANSPORTE], ['Venue'], [{ category_id: '1' }]))
      .toEqual(['Venue'])
  })

  it('una categoria archivada con partidas no revive por tenerlas: cae al cajon de rescate', () => {
    const archivada = cat('9', 'Vieja', '2026-01-01')
    expect(seccionesDelPresupuesto([VENUE, archivada], ['Venue'], [{ category_id: '9' }]))
      .toEqual(['Venue'])
  })

  it('un nombre de la seleccion que ya no existe en la tabla no inventa seccion', () => {
    expect(seccionesDelPresupuesto([VENUE], ['Venue', 'Borrada'])).toEqual(['Venue'])
  })
})

describe('quitarDeSeleccion', () => {
  it('sobre una seleccion vacia, materializa el catalogo completo menos la quitada', () => {
    expect(quitarDeSeleccion([VENUE, PLANEACION, TRANSPORTE], null, 'Venue'))
      .toEqual(['Planeación', 'Transporte'])
  })

  it('sobre una seleccion explicita, solo quita el nombre pedido', () => {
    expect(quitarDeSeleccion([VENUE, PLANEACION, TRANSPORTE], ['Transporte', 'Venue'], 'Venue'))
      .toEqual(['Transporte'])
  })

  it('quitar un nombre que ya no esta en la seleccion no hace nada', () => {
    expect(quitarDeSeleccion([VENUE, PLANEACION], ['Venue'], 'Planeación')).toEqual(['Venue'])
  })

  it('ignora acentos al quitar', () => {
    expect(quitarDeSeleccion([PLANEACION, VENUE], null, 'Planeacion')).toEqual(['Venue'])
  })
})

describe('tienePartidasEnEvento', () => {
  it('reporta true cuando alguna partida usa esa categoria', () => {
    expect(tienePartidasEnEvento([{ category_id: '1' }, { category_id: '2' }], '1')).toBe(true)
  })

  it('reporta false cuando ninguna partida la usa', () => {
    expect(tienePartidasEnEvento([{ category_id: '2' }], '1')).toBe(false)
  })

  it('ignora partidas sin categoria', () => {
    expect(tienePartidasEnEvento([{ category_id: null }], '1')).toBe(false)
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
