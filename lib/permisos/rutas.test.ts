import { describe, it, expect } from 'vitest'
import { MODULO_POR_RUTA, moduloDeRutaNav, filtrarPorPermiso } from './rutas'
import { MODULOS_CONFIG, type Modulo, type Nivel } from './catalogo'

type Entrada =
  | { type: 'item'; path: string }
  | { type: 'group'; defaultPath: string; children: { path: string }[] }

const NAV: Entrada[] = [
  { type: 'item', path: '' },
  { type: 'item', path: '/timeline' },
  { type: 'item', path: '/configuracion' },
  { type: 'group', defaultPath: '/presupuesto', children: [
    { path: '/presupuesto' }, { path: '/proveedores' }, { path: '/pagos' },
  ] },
]

describe('MODULO_POR_RUTA', () => {
  it('cubre las rutas de los doce modulos', () => {
    for (const m of MODULOS_CONFIG) {
      for (const r of m.rutas) expect(MODULO_POR_RUTA[r]).toBe(m.key)
    }
  })

  it('la raiz del evento es invitados', () => {
    expect(moduloDeRutaNav('')).toBe('invitados')
  })

  it('configuracion y comida no son modulos', () => {
    expect(moduloDeRutaNav('/configuracion')).toBeNull()
    expect(moduloDeRutaNav('/comida')).toBeNull()
  })
})

describe('filtrarPorPermiso', () => {
  it('con todo en total no esconde nada', () => {
    expect(filtrarPorPermiso(NAV, () => 'total' as Nivel)).toHaveLength(4)
  })

  it('sin ningun permiso solo sobrevive lo que no es modulo', () => {
    expect(filtrarPorPermiso(NAV, () => 'ninguno' as Nivel))
      .toEqual([{ type: 'item', path: '/configuracion' }])
  })

  it('esconde el modulo que esta en ninguno y deja los demas', () => {
    const nivel = (m: Modulo): Nivel => (m === 'timeline' ? 'ninguno' : 'ver')
    const paths = filtrarPorPermiso(NAV, nivel)
      .filter((e): e is Extract<Entrada, { type: 'item' }> => e.type === 'item')
      .map(e => e.path)
    expect(paths).not.toContain('/timeline')
    expect(paths).toContain('')
  })

  it('un grupo se queda con los hijos permitidos', () => {
    const nivel = (m: Modulo): Nivel => (m === 'pagos' ? 'ninguno' : 'ver')
    const grupo = filtrarPorPermiso(NAV, nivel)
      .find((e): e is Extract<Entrada, { type: 'group' }> => e.type === 'group')!
    expect(grupo.children.map(c => c.path)).toEqual(['/presupuesto', '/proveedores'])
  })

  it('un grupo sin hijos permitidos desaparece entero', () => {
    const nivel = (m: Modulo): Nivel =>
      (['presupuesto', 'proveedores', 'pagos'] as Modulo[]).includes(m) ? 'ninguno' : 'ver'
    expect(filtrarPorPermiso(NAV, nivel).some(e => e.type === 'group')).toBe(false)
  })

  it('si el destino del grupo se escondio, apunta al primer hijo que quedo', () => {
    const nivel = (m: Modulo): Nivel => (m === 'presupuesto' ? 'ninguno' : 'ver')
    const grupo = filtrarPorPermiso(NAV, nivel)
      .find((e): e is Extract<Entrada, { type: 'group' }> => e.type === 'group')!
    expect(grupo.defaultPath).toBe('/proveedores')
  })
})
