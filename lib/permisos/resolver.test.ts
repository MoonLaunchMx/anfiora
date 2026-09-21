import { describe, it, expect } from 'vitest'
import {
  normalizarPermisos, nivelDe, puede, nivelEfectivo, resumir, aplicarKit,
  permisosDeRol, ponerNivel,
  type ContextoPermiso,
} from './resolver'
import { MODULOS, NIVELES, type Nivel, type PermisosEvento } from './catalogo'
import { LEGACY_FEATURES } from '@/lib/features'

const TODO_PRENDIDO = { ...LEGACY_FEATURES }

function ctx(over: Partial<ContextoPermiso> = {}): ContextoPermiso {
  return {
    esDuenoDelEvento: false,
    rolCuenta: 'colaborador',
    permisos: {},
    features: TODO_PRENDIDO,
    ...over,
  }
}

describe('normalizarPermisos', () => {
  it('deja pasar lo valido', () => {
    expect(normalizarPermisos({ mesas: 'editar', pagos: 'ver' }))
      .toEqual({ mesas: 'editar', pagos: 'ver' })
  })

  it('tira modulos que no existen y niveles que no existen', () => {
    expect(normalizarPermisos({ mesas: 'editar', inventado: 'total', pagos: 'jefe' }))
      .toEqual({ mesas: 'editar' })
  })

  it('convierte basura en objeto vacio, sin reventar', () => {
    for (const basura of [null, undefined, 'texto', 42, [], true]) {
      expect(normalizarPermisos(basura)).toEqual({})
    }
  })
})

describe('puede — la escalera', () => {
  const tabla: Array<[Nivel, boolean, boolean, boolean]> = [
    // nivel      ver    editar borrar
    ['ninguno',   false, false, false],
    ['ver',       true,  false, false],
    ['editar',    true,  true,  false],
    ['total',     true,  true,  true ],
  ]

  for (const [nivel, ver, editar, borrar] of tabla) {
    it(`${nivel}: ver=${ver} editar=${editar} borrar=${borrar}`, () => {
      expect(puede(nivel, 'ver')).toBe(ver)
      expect(puede(nivel, 'editar')).toBe(editar)
      expect(puede(nivel, 'borrar')).toBe(borrar)
    })
  }

  it('editar nunca implica borrar', () => {
    expect(puede('editar', 'borrar')).toBe(false)
  })
})

describe('nivelDe', () => {
  it('una clave ausente es sin acceso; nunca se infiere nada', () => {
    expect(nivelDe({}, 'pagos')).toBe('ninguno')
    expect(nivelDe(null, 'pagos')).toBe('ninguno')
    expect(nivelDe({ mesas: 'total' }, 'pagos')).toBe('ninguno')
  })

  it('lee el nivel guardado', () => {
    expect(nivelDe({ pagos: 'editar' }, 'pagos')).toBe('editar')
  })
})

describe('nivelEfectivo', () => {
  it('el dueno del evento tiene total en todo', () => {
    for (const m of MODULOS) {
      expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, permisos: {} }), m)).toBe('total')
    }
  })

  it('el dueno y el admin del despacho tienen total en todo', () => {
    for (const rol of ['dueno', 'admin'] as const) {
      for (const m of MODULOS) {
        expect(nivelEfectivo(ctx({ rolCuenta: rol, permisos: {} }), m)).toBe('total')
      }
    }
  })

  it('el colaborador solo tiene lo que le dieron', () => {
    const c = ctx({ permisos: { mesas: 'editar' } })
    expect(nivelEfectivo(c, 'mesas')).toBe('editar')
    expect(nivelEfectivo(c, 'pagos')).toBe('ninguno')
  })

  it('el ajeno no tiene nada', () => {
    const c = ctx({ rolCuenta: null, permisos: null })
    for (const m of MODULOS) expect(nivelEfectivo(c, m)).toBe('ninguno')
  })

  it('una herramienta apagada en la boda no existe para NADIE, ni el dueno', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: apagada }), 'playlist')).toBe('ninguno')
    expect(nivelEfectivo(ctx({ rolCuenta: 'admin', features: apagada }), 'playlist')).toBe('ninguno')
    expect(nivelEfectivo(ctx({ permisos: { playlist: 'total' }, features: apagada }), 'playlist')).toBe('ninguno')
  })

  it('apagar una herramienta no toca a las demas', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: apagada }), 'mesas')).toBe('total')
  })

  it('mientras las features no cargan, nadie ve nada de lo que se prende por boda', () => {
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: null }), 'playlist')).toBe('ninguno')
    expect(nivelEfectivo(ctx({ esDuenoDelEvento: true, features: null }), 'invitados')).toBe('total')
  })

  it('un nivel guardado que no existe se lee como sin acceso', () => {
    const c = ctx({ permisos: normalizarPermisos({ mesas: 'jefe' }) })
    expect(nivelEfectivo(c, 'mesas')).toBe('ninguno')
  })
})

describe('resumir', () => {
  it('sin nada, esta fuera de la boda', () => {
    expect(resumir(ctx({ permisos: {} }))).toMatchObject({ entra: 0, etiqueta: 'Fuera de esta boda' })
  })

  it('todo en ver es solo lectura', () => {
    const permisos = Object.fromEntries(MODULOS.map(m => [m, 'ver'])) as PermisosEvento
    expect(resumir(ctx({ permisos }))).toMatchObject({ entra: 12, borra: 0, etiqueta: 'Solo lectura' })
  })

  it('con algo en editar y nada en total, edita pero no borra', () => {
    expect(resumir(ctx({ permisos: { mesas: 'editar', pagos: 'ver' } })))
      .toMatchObject({ entra: 2, edita: 1, ve: 1, borra: 0, etiqueta: 'Edita, no borra' })
  })

  it('con un solo total, puede borrar', () => {
    expect(resumir(ctx({ permisos: { mesas: 'total', pagos: 'ver' } })))
      .toMatchObject({ borra: 1, etiqueta: 'Puede borrar' })
  })

  it('no cuenta las herramientas apagadas en la boda', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(resumir(ctx({ permisos: { playlist: 'total', mesas: 'ver' }, features: apagada })))
      .toMatchObject({ entra: 1, borra: 0 })
  })
})

describe('aplicarKit', () => {
  it('respeta el kit y descarta lo que la boda tiene apagado', () => {
    const apagada = { ...TODO_PRENDIDO, playlist: false }
    expect(aplicarKit({ mesas: 'editar', playlist: 'total', pagos: 'ver' }, apagada))
      .toEqual({ mesas: 'editar', pagos: 'ver' })
  })

  it('sin kit, no otorga nada', () => {
    expect(aplicarKit(null, TODO_PRENDIDO)).toEqual({})
  })
})

describe('cobertura', () => {
  it('la tabla de verdad cubre los cuatro niveles', () => {
    expect(NIVELES).toHaveLength(4)
  })
})

describe('permisosDeRol', () => {
  it('un editor nace pudiendo editar, nunca borrar', () => {
    const p = permisosDeRol('editor')
    expect(Object.keys(p)).toHaveLength(12)
    expect(new Set(Object.values(p))).toEqual(new Set(['editar']))
  })

  it('un viewer nace solo mirando', () => {
    expect(new Set(Object.values(permisosDeRol('viewer')))).toEqual(new Set(['ver']))
  })

  it('coincide con lo que la migracion escribio para ese rol', () => {
    expect(permisosDeRol('editor').pagos).toBe('editar')
    expect(permisosDeRol('admin').pagos).toBe('total')
  })
})

describe('ponerNivel', () => {
  it('mover presupuesto arrastra proveedores y pagos', () => {
    const out = ponerNivel({}, 'presupuesto', 'ver')
    expect(out.presupuesto).toBe('ver')
    expect(out.proveedores).toBe('ver')
    expect(out.pagos).toBe('ver')
  })

  it('arrastrar a ninguno quita las tres llaves, no las deja en ninguno', () => {
    const out = ponerNivel(
      { presupuesto: 'total', proveedores: 'total', pagos: 'total' },
      'presupuesto',
      'ninguno',
    )
    expect(out).toEqual({})
  })

  it('proveedores y pagos siguen siendo permisos aparte: no arrastran de vuelta', () => {
    const out = ponerNivel(
      { presupuesto: 'ver', proveedores: 'ver', pagos: 'ver' },
      'proveedores',
      'editar',
    )
    expect(out.proveedores).toBe('editar')
    expect(out.presupuesto).toBe('ver')
    expect(out.pagos).toBe('ver')
  })

  it('ningun otro modulo arrastra a nadie', () => {
    for (const m of MODULOS) {
      if (m === 'presupuesto') continue
      const out = ponerNivel({}, m, 'editar')
      expect(Object.keys(out)).toEqual([m])
    }
  })

  it('no otorga un modulo apagado en la boda', () => {
    const out = ponerNivel({}, 'presupuesto', 'editar', m => m !== 'pagos')
    expect(out.proveedores).toBe('editar')
    expect(out.pagos).toBeUndefined()
  })

  it('no muta el objeto que recibe', () => {
    const antes: PermisosEvento = { presupuesto: 'ver' }
    ponerNivel(antes, 'presupuesto', 'total')
    expect(antes).toEqual({ presupuesto: 'ver' })
  })
})
