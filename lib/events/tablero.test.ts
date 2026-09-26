import { describe, it, expect } from 'vitest'
import { fusionarEventosDelTablero, type EventoDelTablero } from './tablero'

const evento = (id: string, user_id: string, extra: Partial<EventoDelTablero> = {}): EventoDelTablero => ({
  id, user_id, name: 'Evento ' + id, ...extra,
})

const YO = 'yo'
const OTRO = 'otro'

describe('fusionarEventosDelTablero', () => {
  it('sin workspaces administrados deja los propios y los compartidos como estan', () => {
    const r = fusionarEventosDelTablero({
      propios: [evento('a', YO)],
      compartidos: [{ ...evento('b', OTRO), shared_role: 'editor', is_shared: true, owner_name: 'Ana' }],
      delWorkspace: [],
    })
    expect(r.mios.map(e => e.id)).toEqual(['a'])
    expect(r.compartidos.map(e => e.id)).toEqual(['b'])
    expect(r.compartidos[0].shared_role).toBe('editor')
  })

  it('los eventos del workspace donde soy admin entran como compartidos con rol admin y el nombre del dueno', () => {
    const r = fusionarEventosDelTablero({
      propios: [],
      compartidos: [],
      delWorkspace: [evento('w1', OTRO, { owner_name: 'Ana' })],
    })
    expect(r.compartidos).toHaveLength(1)
    expect(r.compartidos[0]).toMatchObject({ id: 'w1', is_shared: true, shared_role: 'admin', owner_name: 'Ana' })
  })

  it('un evento mio que tambien viene por el workspace se queda solo en mis eventos', () => {
    const r = fusionarEventosDelTablero({
      propios: [evento('a', YO)],
      compartidos: [],
      delWorkspace: [evento('a', YO)],
    })
    expect(r.mios.map(e => e.id)).toEqual(['a'])
    expect(r.compartidos).toEqual([])
  })

  it('si ya tengo fila de colaborador y ademas soy admin del workspace, gana admin (es el nivel efectivo real)', () => {
    const r = fusionarEventosDelTablero({
      propios: [],
      compartidos: [{ ...evento('b', OTRO), shared_role: 'viewer', is_shared: true, owner_name: 'Ana' }],
      delWorkspace: [evento('b', OTRO, { owner_name: 'Ana' })],
    })
    expect(r.compartidos).toHaveLength(1)
    expect(r.compartidos[0].shared_role).toBe('admin')
  })

  it('un evento del workspace cuyo dueno soy yo nunca se duplica como compartido', () => {
    const r = fusionarEventosDelTablero({
      propios: [],
      compartidos: [],
      delWorkspace: [evento('z', YO)],
      yo: YO,
    })
    expect(r.mios).toEqual([])
    expect(r.compartidos).toEqual([])
  })

  it('conserva el orden: primero los compartidos por fila y luego los del workspace', () => {
    const r = fusionarEventosDelTablero({
      propios: [],
      compartidos: [{ ...evento('b', OTRO), shared_role: 'editor', is_shared: true, owner_name: null }],
      delWorkspace: [evento('c', OTRO), evento('d', OTRO)],
    })
    expect(r.compartidos.map(e => e.id)).toEqual(['b', 'c', 'd'])
  })
})
