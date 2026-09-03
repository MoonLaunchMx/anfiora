import { describe, it, expect } from 'vitest'
import { leerMonto, planearImport, resumenImport, mensajeImportado } from './import'

const partida = (id: string, category: string, subcategory: string, budget_amount: number) =>
  ({ id, category, subcategory, budget_amount })

describe('leerMonto', () => {
  it('lee un numero tal cual', () => {
    expect(leerMonto(12500)).toBe(12500)
    expect(leerMonto(1250.5)).toBe(1250.5)
  })

  it('respeta el cero explicito', () => {
    expect(leerMonto(0)).toBe(0)
    expect(leerMonto('0')).toBe(0)
  })

  it('devuelve null cuando la celda viene vacia', () => {
    expect(leerMonto(undefined)).toBeNull()
    expect(leerMonto(null)).toBeNull()
    expect(leerMonto('')).toBeNull()
    expect(leerMonto('   ')).toBeNull()
  })

  it('lee montos escritos como texto con formato de moneda', () => {
    expect(leerMonto('$12,500.00')).toBe(12500)
    expect(leerMonto('12 500')).toBe(12500)
    expect(leerMonto('$ 1,250.50')).toBe(1250.5)
  })

  it('devuelve null cuando el texto no es un monto', () => {
    expect(leerMonto('por definir')).toBeNull()
    expect(leerMonto('pendiente')).toBeNull()
  })
})

describe('planearImport', () => {
  const categorias = ['Venue', 'Imagen', 'Decoracion', 'Fotografía y video']

  it('marca para agregar un concepto que no existe', () => {
    const plan = planearImport(
      [{ categoria: 'Venue', concepto: 'Jardín', monto: 90000 }],
      [],
      categorias,
    )
    expect(plan).toHaveLength(1)
    expect(plan[0].accion).toBe('agregar')
    expect(plan[0].montoNuevo).toBe(90000)
    expect(plan[0].partidaId).toBeNull()
  })

  it('agrega con cero el concepto nuevo que viene sin monto', () => {
    const plan = planearImport(
      [{ categoria: 'Venue', concepto: 'Jardín', monto: null }],
      [],
      categorias,
    )
    expect(plan[0].accion).toBe('agregar')
    expect(plan[0].montoNuevo).toBe(0)
  })

  it('actualiza por id aunque el concepto venga con otras mayusculas', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'VESTIDO DE NOVIA', monto: 45000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 0)],
      categorias,
    )
    expect(plan[0].accion).toBe('actualizar')
    expect(plan[0].partidaId).toBe('p1')
    expect(plan[0].montoNuevo).toBe(45000)
    expect(plan[0].montoActual).toBe(0)
  })

  it('reconoce el concepto aunque cambien los espacios', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: '  vestido de  novia ', monto: 45000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 0)],
      categorias,
    )
    expect(plan[0].accion).toBe('actualizar')
    expect(plan[0].partidaId).toBe('p1')
  })

  it('reconoce el concepto aunque el Excel venga sin acentos', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Musica en vivo', monto: 20000 }],
      [partida('p1', 'Imagen', 'Música en vivo', 12000)],
      categorias,
    )
    expect(plan[0].accion).toBe('actualizar')
    expect(plan[0].partidaId).toBe('p1')
    expect(plan[0].concepto).toBe('Música en vivo')
  })

  it('reconoce la categoria aunque el Excel venga sin acentos', () => {
    const plan = planearImport(
      [{ categoria: 'Fotografia y video', concepto: 'Album', monto: 8000 }],
      [partida('p1', 'Fotografía y video', 'Album', 5000)],
      categorias,
    )
    expect(plan[0].categoria).toBe('Fotografía y video')
    expect(plan[0].partidaId).toBe('p1')
  })

  it('no crea una categoria nueva cuando solo cambian las mayusculas', () => {
    const plan = planearImport(
      [{ categoria: 'fotografía y video', concepto: 'Album', monto: 8000 }],
      [partida('p1', 'Fotografía y video', 'Album', 5000)],
      categorias,
    )
    expect(plan[0].categoria).toBe('Fotografía y video')
    expect(plan[0].accion).toBe('actualizar')
    expect(plan[0].partidaId).toBe('p1')
  })

  it('traduce la etiqueta de la plantilla a la categoria guardada', () => {
    const plan = planearImport(
      [{ categoria: 'Decoración', concepto: 'Centros de mesa', monto: 15000 }],
      [],
      categorias,
    )
    expect(plan[0].categoria).toBe('Decoracion')
  })

  it('deja pasar una categoria que no conoce como categoria nueva', () => {
    const plan = planearImport(
      [{ categoria: 'Transporte aereo', concepto: 'Vuelos', monto: 30000 }],
      [],
      categorias,
    )
    expect(plan[0].categoria).toBe('Transporte aereo')
    expect(plan[0].accion).toBe('agregar')
  })

  it('no borra el monto existente cuando la celda viene vacia', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Vestido de novia', monto: null }],
      [partida('p1', 'Imagen', 'Vestido de novia', 45000)],
      categorias,
    )
    expect(plan[0].accion).toBe('sin_cambios')
    expect(plan[0].montoNuevo).toBe(45000)
  })

  it('no toca la partida cuando el monto es el mismo', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Vestido de novia', monto: 45000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 45000)],
      categorias,
    )
    expect(plan[0].accion).toBe('sin_cambios')
  })

  it('pone cero solo cuando el cero es explicito', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Vestido de novia', monto: 0 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 45000)],
      categorias,
    )
    expect(plan[0].accion).toBe('actualizar')
    expect(plan[0].montoNuevo).toBe(0)
  })

  it('junta en una sola las filas repetidas del mismo archivo y se queda con la ultima', () => {
    const plan = planearImport(
      [
        { categoria: 'Venue', concepto: 'Jardín', monto: 80000 },
        { categoria: 'Venue', concepto: 'JARDÍN', monto: 90000 },
      ],
      [],
      categorias,
    )
    expect(plan).toHaveLength(1)
    expect(plan[0].montoNuevo).toBe(90000)
  })

  it('conserva el monto anterior si la fila repetida viene vacia', () => {
    const plan = planearImport(
      [
        { categoria: 'Venue', concepto: 'Jardín', monto: 80000 },
        { categoria: 'Venue', concepto: 'Jardín', monto: null },
      ],
      [],
      categorias,
    )
    expect(plan).toHaveLength(1)
    expect(plan[0].montoNuevo).toBe(80000)
  })

  it('descarta las filas sin categoria o sin concepto', () => {
    const plan = planearImport(
      [
        { categoria: '', concepto: 'Jardín', monto: 1 },
        { categoria: 'Venue', concepto: '   ', monto: 1 },
      ],
      [],
      categorias,
    )
    expect(plan).toHaveLength(0)
  })

  it('guarda el concepto tal como lo escribio el planner, no como venia en el Excel', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'VESTIDO DE NOVIA', monto: 1 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 0)],
      categorias,
    )
    expect(plan[0].concepto).toBe('Vestido de novia')
  })
})

describe('el caso que reporto Diego', () => {
  it('un presupuesto sin montos + un Excel con montos no marca todo como duplicado muerto', () => {
    const existentes = [
      partida('p1', 'Venue', 'Jardín', 0),
      partida('p2', 'Banquete', 'Menú por persona', 0),
      partida('p3', 'Imagen', 'Vestido de novia', 0),
    ]
    const plan = planearImport(
      [
        { categoria: 'Venue', concepto: 'Jardin', monto: 180000 },
        { categoria: 'Banquete', concepto: 'MENÚ POR PERSONA', monto: 950 },
        { categoria: 'Imagen', concepto: 'Vestido de novia', monto: 45000 },
      ],
      existentes,
      ['Venue', 'Banquete', 'Imagen'],
    )

    expect(resumenImport(plan)).toEqual({ agregar: 0, actualizar: 3, sinCambios: 0 })
    expect(plan.map(f => f.partidaId)).toEqual(['p1', 'p2', 'p3'])
    expect(plan.map(f => f.montoNuevo)).toEqual([180000, 950, 45000])
  })

  it('un Excel sin columna de montos no pone el presupuesto en ceros', () => {
    const existentes = [
      partida('p1', 'Venue', 'Jardín', 180000),
      partida('p2', 'Banquete', 'Menú por persona', 950),
    ]
    const plan = planearImport(
      [
        { categoria: 'Venue', concepto: 'Jardín', monto: null },
        { categoria: 'Banquete', concepto: 'Menú por persona', monto: null },
      ],
      existentes,
      ['Venue', 'Banquete'],
    )

    expect(resumenImport(plan)).toEqual({ agregar: 0, actualizar: 0, sinCambios: 2 })
    expect(plan.map(f => f.montoNuevo)).toEqual([180000, 950])
  })
})

describe('mensajeImportado', () => {
  it('cuenta las dos cosas cuando hubo de las dos', () => {
    expect(mensajeImportado(2, 3)).toBe('Se agregaron 2 conceptos y se actualizaron 3 montos.')
  })

  it('habla en singular cuando fue uno solo', () => {
    expect(mensajeImportado(1, 1)).toBe('Se agregó 1 concepto y se actualizó 1 monto.')
  })

  it('no menciona lo que no pasó', () => {
    expect(mensajeImportado(1, 0)).toBe('Se agregó 1 concepto.')
    expect(mensajeImportado(0, 2)).toBe('Se actualizaron 2 montos.')
  })

  it('lo dice claro cuando no hubo nada que guardar', () => {
    expect(mensajeImportado(0, 0)).toBe('Tu presupuesto ya estaba al día: no hubo nada que cambiar.')
  })
})

describe('resumenImport', () => {
  it('cuenta cada accion por separado', () => {
    const plan = planearImport(
      [
        { categoria: 'Venue', concepto: 'Jardín', monto: 90000 },
        { categoria: 'Imagen', concepto: 'Vestido de novia', monto: 45000 },
        { categoria: 'Imagen', concepto: 'Velo', monto: null },
      ],
      [
        partida('p1', 'Imagen', 'Vestido de novia', 0),
        partida('p2', 'Imagen', 'Velo', 3000),
      ],
      ['Venue', 'Imagen'],
    )
    expect(resumenImport(plan)).toEqual({ agregar: 1, actualizar: 1, sinCambios: 1 })
  })
})
