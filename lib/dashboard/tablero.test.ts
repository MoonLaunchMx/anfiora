import { describe, it, expect } from 'vitest'
import {
  CATALOGO, CIFRAS_BASE, CIFRAS_EN_BANNER, COLUMNAS,
  acomodoInicial, agregarCaja, cajasDisponibles, cambiarCifra, cifrasDisponibles,
  mezclarAcomodo, mezclarCifras, mismasCajas, parseAcomodo, quitarCaja,
  type Acomodo, type Caja, type CajaId, type CifraId,
} from './tablero'

describe('cifrasDisponibles', () => {
  it('el dueno de una boda puede elegir las ocho', () => {
    expect(cifrasDisponibles('boda', null, true)).toHaveLength(8)
  })

  it('sin acceso a montos desaparecen presupuesto, proveedores y regalos', () => {
    const ids = cifrasDisponibles('boda', null, false)
    expect(ids).not.toContain('presupuesto')
    expect(ids).not.toContain('proveedores')
    expect(ids).not.toContain('regalos')
    expect(ids).toContain('invitados')
    expect(ids).toContain('tareas')
  })

  it('una herramienta apagada saca su cifra', () => {
    expect(cifrasDisponibles('boda', { mesas: false }, true)).not.toContain('mesas')
  })

  it('una llave ausente no significa apagada: cae al default del tipo', () => {
    expect(cifrasDisponibles('boda', { playlist: true }, true)).toContain('mesas')
  })
})

describe('mezclarCifras', () => {
  it('sin nada guardado devuelve las de fabrica disponibles', () => {
    expect(mezclarCifras(null, cifrasDisponibles('boda', null, true))).toEqual(CIFRAS_BASE)
  })

  it('conserva la eleccion guardada y su orden', () => {
    const elegidas: CifraId[] = ['mesas', 'tareas', 'invitados', 'organizacion']
    expect(mezclarCifras(elegidas, cifrasDisponibles('boda', null, true))).toEqual(elegidas)
  })

  it('siempre devuelve exactamente cuatro', () => {
    expect(mezclarCifras(['invitados'], cifrasDisponibles('boda', null, true))).toHaveLength(CIFRAS_EN_BANNER)
    const seis: CifraId[] = ['invitados', 'tareas', 'mesas', 'regalos', 'atencion', 'organizacion']
    expect(mezclarCifras(seis, cifrasDisponibles('boda', null, true))).toHaveLength(CIFRAS_EN_BANNER)
  })

  it('una cifra que dejo de aplicar cae a la siguiente de fabrica y no deja hueco', () => {
    const elegidas: CifraId[] = ['presupuesto', 'proveedores', 'invitados', 'tareas']
    const r = mezclarCifras(elegidas, cifrasDisponibles('boda', null, false))
    expect(r).toHaveLength(CIFRAS_EN_BANNER)
    expect(r).not.toContain('presupuesto')
    expect(r).not.toContain('proveedores')
    expect(new Set(r).size).toBe(CIFRAS_EN_BANNER)
  })
})

describe('cambiarCifra', () => {
  const base: Acomodo = { v: 1, cifras: [...CIFRAS_BASE], cajas: [], ocultas: [] }

  it('reemplaza la cifra de esa posicion', () => {
    expect(cambiarCifra(base, 1, 'mesas').cifras).toEqual(['invitados', 'mesas', 'proveedores', 'tareas'])
  })

  it('si la nueva ya estaba en otra posicion, las intercambia en vez de duplicar', () => {
    const r = cambiarCifra(base, 0, 'tareas')
    expect(r.cifras).toEqual(['tareas', 'presupuesto', 'proveedores', 'invitados'])
    expect(new Set(r.cifras).size).toBe(CIFRAS_EN_BANNER)
  })

  it('un indice fuera de rango no cambia nada', () => {
    expect(cambiarCifra(base, 9, 'mesas')).toBe(base)
  })
})

describe('cajasDisponibles', () => {
  it('las cajas sin herramienta siempre estan', () => {
    const ids = cajasDisponibles('boda', {})
    expect(ids).toEqual(expect.arrayContaining(['atencion', 'pendientes', 'equipo']))
  })

  it('una caja marcada como oculta no se ofrece', () => {
    expect(cajasDisponibles('boda', {})).not.toContain('actividad')
  })

  it('una herramienta apagada explicitamente saca su caja', () => {
    const ids = cajasDisponibles('boda', { regalos: false })
    expect(ids).not.toContain('regalos')
    expect(ids).toContain('mesas')
  })

  it('enabled_features null cae a legacy: mesas y regalos encendidas', () => {
    const ids = cajasDisponibles('boda', null)
    expect(ids).toContain('mesas')
    expect(ids).toContain('regalos')
  })

  it('respeta el orden del catalogo', () => {
    const ids = cajasDisponibles('boda', null)
    expect(ids).toEqual(CATALOGO.map(c => c.id).filter(id => ids.includes(id)))
  })
})

describe('acomodoInicial', () => {
  it('coloca cada caja dentro de la cuadricula', () => {
    const a = acomodoInicial(CIFRAS_BASE, cajasDisponibles('boda', null))
    for (const c of a.cajas) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x + c.w).toBeLessThanOrEqual(COLUMNAS)
    }
  })

  it('no encima dos cajas en la misma casilla', () => {
    const a = acomodoInicial(CIFRAS_BASE, cajasDisponibles('boda', null))
    const ocupadas = new Set<string>()
    for (const c of a.cajas) {
      for (let x = c.x; x < c.x + c.w; x++) {
        for (let y = c.y; y < c.y + c.h; y++) {
          const llave = `${x},${y}`
          expect(ocupadas.has(llave)).toBe(false)
          ocupadas.add(llave)
        }
      }
    }
  })

  it('nace en version 1, sin ocultas y con las cifras que le dieron', () => {
    const a = acomodoInicial(CIFRAS_BASE, ['atencion'])
    expect(a.v).toBe(1)
    expect(a.ocultas).toEqual([])
    expect(a.cifras).toEqual(CIFRAS_BASE)
  })
})

describe('parseAcomodo', () => {
  it('acepta un acomodo bien formado', () => {
    const raw = {
      v: 1,
      cifras: ['invitados', 'mesas', 'tareas', 'atencion'],
      cajas: [{ id: 'atencion', x: 0, y: 0, w: 2, h: 2 }],
      ocultas: ['regalos'],
    }
    expect(parseAcomodo(raw)).toEqual(raw)
  })

  it('devuelve null con null, con basura y con otra version', () => {
    expect(parseAcomodo(null)).toBeNull()
    expect(parseAcomodo('{}')).toBeNull()
    expect(parseAcomodo({ v: 2, cajas: [], ocultas: [] })).toBeNull()
    expect(parseAcomodo({ v: 1, cajas: 'no', ocultas: [] })).toBeNull()
  })

  it('un acomodo viejo sin cifras se lee con la lista vacia, no se descarta', () => {
    const a = parseAcomodo({ v: 1, cajas: [{ id: 'equipo', x: 0, y: 0, w: 2, h: 2 }], ocultas: [] })
    expect(a).not.toBeNull()
    expect(a!.cifras).toEqual([])
    expect(a!.cajas).toHaveLength(1)
  })

  it('descarta ids desconocidos y medidas invalidas', () => {
    const a = parseAcomodo({
      v: 1,
      cifras: ['invitados', 'inventada'],
      ocultas: ['inventada'],
      cajas: [
        { id: 'atencion', x: 0, y: 0, w: 2, h: 2 },
        { id: 'inventada', x: 0, y: 2, w: 2, h: 2 },
        { id: 'equipo', x: 0, y: 4, w: 0, h: 2 },
      ],
    })
    expect(a?.cajas.map(c => c.id)).toEqual(['atencion'])
    expect(a?.cifras).toEqual(['invitados'])
    expect(a?.ocultas).toEqual([])
  })
})

describe('mezclarAcomodo', () => {
  const guardado: Acomodo = {
    v: 1,
    cifras: ['mesas', 'tareas', 'invitados', 'atencion'],
    cajas: [{ id: 'atencion', x: 0, y: 0, w: 2, h: 2 }],
    ocultas: ['equipo'],
  }
  const todas = cifrasDisponibles('boda', null, true)

  it('sin nada guardado devuelve el acomodo inicial', () => {
    const cajas: CajaId[] = ['atencion', 'equipo']
    expect(mezclarAcomodo(null, todas, cajas)).toEqual(acomodoInicial(CIFRAS_BASE, cajas))
  })

  it('conserva la posicion y las cifras guardadas', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion', 'equipo'])
    expect(r.cajas.find(c => c.id === 'atencion')).toEqual({ id: 'atencion', x: 0, y: 0, w: 2, h: 2 })
    expect(r.cifras).toEqual(guardado.cifras)
  })

  it('respeta lo que el usuario oculto', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion', 'equipo'])
    expect(r.cajas.some(c => c.id === 'equipo')).toBe(false)
    expect(r.ocultas).toContain('equipo')
  })

  it('una caja nueva se agrega sola, debajo de todo', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion', 'equipo', 'actividad'])
    const nueva = r.cajas.find(c => c.id === 'actividad')
    expect(nueva).toBeDefined()
    expect(nueva!.y).toBeGreaterThanOrEqual(2)
  })

  it('una caja que ya no aplica desaparece de cajas y de ocultas', () => {
    const r = mezclarAcomodo(guardado, todas, ['atencion'])
    expect(r.cajas.map(c => c.id)).toEqual(['atencion'])
    expect(r.ocultas).toEqual([])
  })
})

describe('quitarCaja y agregarCaja', () => {
  const base: Acomodo = {
    v: 1,
    cifras: [...CIFRAS_BASE],
    cajas: [{ id: 'atencion', x: 0, y: 0, w: 2, h: 2 }, { id: 'equipo', x: 2, y: 0, w: 2, h: 2 }],
    ocultas: [],
  }

  it('quitar la saca de cajas y la mete en ocultas', () => {
    const r = quitarCaja(base, 'equipo')
    expect(r.cajas.map(c => c.id)).toEqual(['atencion'])
    expect(r.ocultas).toEqual(['equipo'])
  })

  it('agregar la devuelve y la saca de ocultas', () => {
    const r = agregarCaja(quitarCaja(base, 'equipo'), 'equipo')
    expect(r.cajas.map(c => c.id)).toContain('equipo')
    expect(r.ocultas).toEqual([])
  })

  it('agregar una caja que ya esta no la duplica', () => {
    expect(agregarCaja(base, 'atencion').cajas.filter(c => c.id === 'atencion')).toHaveLength(1)
  })

  it('mover cajas no toca las cifras', () => {
    expect(quitarCaja(base, 'equipo').cifras).toEqual(CIFRAS_BASE)
  })
})

describe('mismasCajas', () => {
  const cajas: Caja[] = [
    { id: 'atencion', x: 0, y: 0, w: 2, h: 2 },
    { id: 'equipo', x: 2, y: 0, w: 2, h: 2 },
  ]

  it('el mismo acomodo en otro objeto cuenta como igual', () => {
    expect(mismasCajas(cajas, cajas.map(c => ({ ...c })))).toBe(true)
  })

  it('no le importa el orden de la lista', () => {
    expect(mismasCajas(cajas, [...cajas].reverse())).toBe(true)
  })

  it('una caja movida un lugar cuenta como distinto', () => {
    const movida = cajas.map(c => (c.id === 'equipo' ? { ...c, y: 2 } : c))
    expect(mismasCajas(cajas, movida)).toBe(false)
  })

  it('una caja mas ancha cuenta como distinto', () => {
    const ancha = cajas.map(c => (c.id === 'atencion' ? { ...c, w: 4 } : c))
    expect(mismasCajas(cajas, ancha)).toBe(false)
  })

  it('quitar una caja cuenta como distinto', () => {
    expect(mismasCajas(cajas, [cajas[0]])).toBe(false)
  })
})
