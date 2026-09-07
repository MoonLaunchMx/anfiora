import { describe, it, expect } from 'vitest'
import {
  nivelMayor, kitDesde, filasDeAlta, validarAltaEquipo, validarCliente,
  filasParaActivar, normalizarCorreo,
} from './invitacion'

describe('nivelMayor y kit', () => {
  it('escoge el nivel mas alto', () => {
    expect(nivelMayor('ver', 'editar')).toBe('editar')
    expect(nivelMayor('total', 'ninguno')).toBe('total')
    expect(nivelMayor('ninguno', 'ninguno')).toBe('ninguno')
  })

  it('el kit es el maximo por modulo de lo que ya tiene en otras bodas', () => {
    const kit = kitDesde([
      { permisos: { invitados: 'ver', mesas: 'editar' } },
      { permisos: { invitados: 'total', pagos: 'ver' } },
      { permisos: null },
    ])
    expect(kit).toEqual({ invitados: 'total', mesas: 'editar', pagos: 'ver' })
  })

  it('kit vacio si no hay filas', () => {
    expect(kitDesde([])).toEqual({})
  })
})

describe('filasDeAlta', () => {
  const base = {
    workspaceId: 'ws1', email: '  Regina@Moonlaunch.mx ', invitedBy: 'u-diego', token: 'tok',
  }

  it('colaboradora: miembro pendiente y una fila por boda, correo normalizado', () => {
    const r = filasDeAlta({
      ...base, rol: 'colaborador',
      bodas: [
        { eventId: 'e1', permisos: { mesas: 'editar' } },
        { eventId: 'e2', permisos: { pagos: 'ver' } },
      ],
    })
    expect(r.miembro).toEqual({
      workspace_id: 'ws1', email: 'regina@moonlaunch.mx', rol: 'colaborador',
      es_dueno_principal: false, status: 'pending', invite_token: 'tok',
      invited_by: 'u-diego', kit_habitual: { mesas: 'editar', pagos: 'ver' },
    })
    expect(r.colaboradores).toEqual([
      { event_id: 'e1', email: 'regina@moonlaunch.mx', invited_by: 'u-diego', status: 'pending',
        tipo: 'equipo', role: 'editor', permisos: { mesas: 'editar' } },
      { event_id: 'e2', email: 'regina@moonlaunch.mx', invited_by: 'u-diego', status: 'pending',
        tipo: 'equipo', role: 'viewer', permisos: { pagos: 'ver' } },
    ])
  })

  it('admin: entra por rol, sin filas de colaborador', () => {
    const r = filasDeAlta({ ...base, rol: 'admin', bodas: [{ eventId: 'e1', permisos: { mesas: 'editar' } }] })
    expect(r.miembro.rol).toBe('admin')
    expect(r.colaboradores).toEqual([])
    expect(r.miembro.kit_habitual).toBeNull()
  })

  it('una boda sin ningun modulo no produce fila', () => {
    const r = filasDeAlta({ ...base, rol: 'colaborador', bodas: [{ eventId: 'e1', permisos: {} }] })
    expect(r.colaboradores).toEqual([])
  })
})

describe('validaciones', () => {
  const miembros = [
    { email: 'daniela@moonlaunch.mx', status: 'active' },
    { email: 'juan@moonlaunch.mx', status: 'revoked' },
  ]

  it('equipo: rechaza correo invalido, ya miembro; acepta revocado', () => {
    expect(validarAltaEquipo({ email: 'nada', miembros })).toEqual({ ok: false, error: 'Escribe un correo válido' })
    expect(validarAltaEquipo({ email: 'Daniela@moonlaunch.mx', miembros }))
      .toEqual({ ok: false, error: 'Esa persona ya es de tu equipo' })
    expect(validarAltaEquipo({ email: 'juan@moonlaunch.mx', miembros })).toEqual({ ok: true, error: null })
  })

  it('cliente: una boda por correo en el workspace, y no si es del equipo', () => {
    const colaboradores = [
      { email: 'mafer@gmail.com', event_id: 'e1', tipo: 'cliente', status: 'active' },
      { email: 'vieja@gmail.com', event_id: 'e1', tipo: 'cliente', status: 'revoked' },
    ]
    expect(validarCliente({ email: 'mafer@gmail.com', eventId: 'e2', colaboradores, miembros }))
      .toEqual({ ok: false, error: 'Ese correo ya es cliente de otra boda. Un cliente solo tiene una' })
    expect(validarCliente({ email: 'mafer@gmail.com', eventId: 'e1', colaboradores, miembros }))
      .toEqual({ ok: false, error: 'Ese correo ya tiene acceso a esta boda' })
    expect(validarCliente({ email: 'daniela@moonlaunch.mx', eventId: 'e1', colaboradores, miembros }))
      .toEqual({ ok: false, error: 'Es de tu equipo: dale acceso desde su ficha' })
    expect(validarCliente({ email: 'vieja@gmail.com', eventId: 'e2', colaboradores, miembros }))
      .toEqual({ ok: true, error: null })
  })
})

describe('filasParaActivar', () => {
  it('solo las pendientes de ese correo en bodas del workspace', () => {
    const ids = filasParaActivar({
      email: 'Regina@moonlaunch.mx',
      colaboradores: [
        { id: 'c1', email: 'regina@moonlaunch.mx', status: 'pending', event_id: 'e1' },
        { id: 'c2', email: 'regina@moonlaunch.mx', status: 'active',  event_id: 'e2' },
        { id: 'c3', email: 'regina@moonlaunch.mx', status: 'pending', event_id: 'ajena' },
        { id: 'c4', email: 'otra@x.com',           status: 'pending', event_id: 'e1' },
      ],
      eventosDelWorkspace: ['e1', 'e2'],
    })
    expect(ids).toEqual(['c1'])
  })

  it('no activa una fila de cliente pendiente del mismo correo', () => {
    const ids = filasParaActivar({
      email: 'regina@moonlaunch.mx',
      colaboradores: [
        { id: 'c1', email: 'regina@moonlaunch.mx', status: 'pending', event_id: 'e1', tipo: 'equipo' },
        { id: 'c2', email: 'regina@moonlaunch.mx', status: 'pending', event_id: 'e1', tipo: 'cliente' },
      ],
      eventosDelWorkspace: ['e1'],
    })
    expect(ids).toEqual(['c1'])
  })
})

describe('normalizarCorreo', () => {
  it('minusculas y sin espacios', () => {
    expect(normalizarCorreo('  A@B.com ')).toBe('a@b.com')
  })
})
