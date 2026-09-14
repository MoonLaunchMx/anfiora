import { describe, expect, it } from 'vitest'
import { elegirActivo, esAdministrador, type FilaMembresia } from './activo'

const dueno = (id: string): FilaMembresia => ({ workspace_id: id, rol: 'dueno', es_dueno_principal: true })
const admin = (id: string): FilaMembresia => ({ workspace_id: id, rol: 'admin', es_dueno_principal: false })
const colaborador = (id: string): FilaMembresia => ({ workspace_id: id, rol: 'colaborador', es_dueno_principal: false })

describe('esAdministrador', () => {
  it('deja pasar a dueno y admin', () => {
    expect(esAdministrador('dueno')).toBe(true)
    expect(esAdministrador('admin')).toBe(true)
  })
  it('frena a los demas y al nulo', () => {
    expect(esAdministrador('colaborador')).toBe(false)
    expect(esAdministrador(null)).toBe(false)
  })
})

describe('elegirActivo', () => {
  it('prefiere el workspace pedido por query param', () => {
    const r = elegirActivo([dueno('propio'), admin('otro')], new Set(['propio', 'otro']), 'otro')
    expect(r).toEqual({ ok: true, activoId: 'otro', mia: admin('otro') })
  })

  it('sin pedido, cae al workspace donde es dueno principal', () => {
    const r = elegirActivo([admin('otro'), dueno('propio')], new Set(['propio', 'otro']), null)
    expect(r.ok && r.activoId).toBe('propio')
  })

  it('sin pedido y sin dueno principal, cae al primero que exista', () => {
    const r = elegirActivo([admin('a'), admin('b')], new Set(['a', 'b']), null)
    expect(r.ok && r.activoId).toBe('a')
  })

  it('rechaza un workspace donde no es administrador', () => {
    const r = elegirActivo([colaborador('a')], new Set(['a']), 'a')
    expect(r).toEqual({ ok: false, razon: 'sin-permiso' })
  })

  it('rechaza un workspace donde no tiene membresia', () => {
    const r = elegirActivo([dueno('propio')], new Set(['propio', 'ajeno']), 'ajeno')
    expect(r).toEqual({ ok: false, razon: 'sin-permiso' })
  })

  it('sin membresias no hay nada que activar', () => {
    expect(elegirActivo([], new Set(), null)).toEqual({ ok: false, razon: 'sin-permiso' })
  })

  // El crash de produccion (JAVASCRIPT-NEXTJS-T): la consulta a workspaces no
  // trajo la fila, la membresia si existia, y el codigo daba por hecho que el
  // workspace estaba ahi. Distinguirlo importa: es un tropiezo de la consulta,
  // no una falta de permisos, y el dueno no debe leer que no administra lo suyo.
  it('distingue el workspace que falta del que no le toca', () => {
    const r = elegirActivo([dueno('propio')], new Set(), null)
    expect(r).toEqual({ ok: false, razon: 'workspace-ausente' })
  })

  it('tambien lo distingue cuando el que falta es el pedido', () => {
    const r = elegirActivo([dueno('propio'), admin('otro')], new Set(['propio']), 'otro')
    expect(r).toEqual({ ok: false, razon: 'workspace-ausente' })
  })

  it('no deja que un workspace ausente secuestre la eleccion', () => {
    const r = elegirActivo([admin('vivo'), dueno('ausente')], new Set(['vivo']), null)
    expect(r).toEqual({ ok: false, razon: 'workspace-ausente' })
  })
})
