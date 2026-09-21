import { describe, it, expect } from 'vitest'
import {
  leerMonto, planearImport, resumenImport, mensajeImportado,
  sonParecidos, decidirRenombre, fechaDelArchivo, avisoArchivoViejo, selloDeFecha,
} from './import'

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

describe('sonParecidos', () => {
  it('reconoce cuando uno esta contenido en el otro', () => {
    expect(sonParecidos('Vestido', 'Vestido de novia')).toBe(true)
    expect(sonParecidos('DJ y audio', 'DJ')).toBe(true)
  })

  it('reconoce cuando comparten la mayoria de las palabras', () => {
    expect(sonParecidos('Vestdio de novia', 'Vestido de novia')).toBe(true)
    expect(sonParecidos('Menú 3 tiempos', 'Menu de 3 tiempos')).toBe(true)
  })

  it('no confunde conceptos distintos', () => {
    expect(sonParecidos('Vestido de novia', 'Ramo de novia')).toBe(false)
    expect(sonParecidos('Pastel', 'Mesa de dulces')).toBe(false)
    expect(sonParecidos('DJ', 'Mariachi')).toBe(false)
  })

  it('no se engancha de palabras cortas o vacias', () => {
    expect(sonParecidos('Renta de sillas', 'Renta de mesas')).toBe(false)
    expect(sonParecidos('', 'Vestido')).toBe(false)
  })
})

describe('planearImport: conceptos que se parecen a uno que ya existe', () => {
  it('propone el candidato en vez de meterlo callado', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Vestido', monto: 45000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
      ['Imagen'],
    )
    expect(plan[0].accion).toBe('agregar')
    expect(plan[0].candidato).toEqual({
      id: 'p1', categoria: 'Imagen', concepto: 'Vestido de novia', montoActual: 30000,
    })
  })

  it('no propone nada cuando el concepto es de verdad nuevo', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Ramo de novia', monto: 3000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
      ['Imagen'],
    )
    expect(plan[0].candidato).toBeNull()
  })

  it('no cruza categorias: solo propone dentro de la misma', () => {
    const plan = planearImport(
      [{ categoria: 'Venue', concepto: 'Vestido', monto: 45000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
      ['Venue', 'Imagen'],
    )
    expect(plan[0].candidato).toBeNull()
  })

  it('no ofrece un concepto que otra fila del archivo ya reclamo', () => {
    const plan = planearImport(
      [
        { categoria: 'Imagen', concepto: 'Vestido de novia', monto: 45000 },
        { categoria: 'Imagen', concepto: 'Vestido', monto: 12000 },
      ],
      [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
      ['Imagen'],
    )
    expect(plan[0].accion).toBe('actualizar')
    expect(plan[1].accion).toBe('agregar')
    expect(plan[1].candidato).toBeNull()
  })

  it('ofrece cada concepto existente una sola vez', () => {
    const plan = planearImport(
      [
        { categoria: 'Imagen', concepto: 'Vestido', monto: 45000 },
        { categoria: 'Imagen', concepto: 'Vestido novia', monto: 12000 },
      ],
      [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
      ['Imagen'],
    )
    expect(plan[0].candidato?.id).toBe('p1')
    expect(plan[1].candidato).toBeNull()
  })
})

describe('decidirRenombre', () => {
  const conCandidato = () => planearImport(
    [{ categoria: 'Imagen', concepto: 'Vestido', monto: 45000 }],
    [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
    ['Imagen'],
  )[0]

  it('al decir que es el mismo, actualiza esa partida y conserva el nombre del planner', () => {
    const fila = decidirRenombre(conCandidato(), true)
    expect(fila.accion).toBe('actualizar')
    expect(fila.partidaId).toBe('p1')
    expect(fila.concepto).toBe('Vestido de novia')
    expect(fila.montoNuevo).toBe(45000)
    expect(fila.montoActual).toBe(30000)
  })

  it('al decir que es otro, vuelve a entrar como concepto nuevo', () => {
    const fila = decidirRenombre(decidirRenombre(conCandidato(), true), false)
    expect(fila.accion).toBe('agregar')
    expect(fila.partidaId).toBeNull()
    expect(fila.concepto).toBe('Vestido')
    expect(fila.montoNuevo).toBe(45000)
    expect(fila.candidato?.id).toBe('p1')
  })

  it('si es el mismo y el monto coincide, no hay nada que escribir', () => {
    const fila = decidirRenombre(
      planearImport(
        [{ categoria: 'Imagen', concepto: 'Vestido', monto: 30000 }],
        [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
        ['Imagen'],
      )[0],
      true,
    )
    expect(fila.accion).toBe('sin_cambios')
  })

  it('si es el mismo y el Excel venia sin monto, no toca el monto', () => {
    const fila = decidirRenombre(
      planearImport(
        [{ categoria: 'Imagen', concepto: 'Vestido', monto: null }],
        [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
        ['Imagen'],
      )[0],
      true,
    )
    expect(fila.accion).toBe('sin_cambios')
    expect(fila.montoNuevo).toBe(30000)
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

    expect(resumenImport(plan)).toMatchObject({ agregar: 0, actualizar: 3, sinCambios: 0 })
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

    expect(resumenImport(plan)).toMatchObject({ agregar: 0, actualizar: 0, sinCambios: 2 })
    expect(plan.map(f => f.montoNuevo)).toEqual([180000, 950])
  })
})

describe('resumenImport: cuanto sube y cuanto baja', () => {
  it('separa los montos que bajan de los que suben', () => {
    const plan = planearImport(
      [
        { categoria: 'Venue', concepto: 'Jardín', monto: 150000 },
        { categoria: 'Venue', concepto: 'Mobiliario', monto: 40000 },
      ],
      [
        partida('p1', 'Venue', 'Jardín', 180000),
        partida('p2', 'Venue', 'Mobiliario', 25000),
      ],
      ['Venue'],
    )
    expect(resumenImport(plan)).toMatchObject({
      actualizar: 2, bajan: 1, suben: 1, totalBaja: 30000, totalSube: 15000,
    })
  })

  it('cuenta aparte los conceptos que hay que revisar', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Vestido', monto: 45000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
      ['Imagen'],
    )
    expect(resumenImport(plan)).toMatchObject({ agregar: 1, porRevisar: 1 })
  })

  it('deja de contarlo por revisar una vez que el planner decide', () => {
    const plan = planearImport(
      [{ categoria: 'Imagen', concepto: 'Vestido', monto: 45000 }],
      [partida('p1', 'Imagen', 'Vestido de novia', 30000)],
      ['Imagen'],
    ).map(f => decidirRenombre(f, true))
    expect(resumenImport(plan)).toMatchObject({ actualizar: 1, porRevisar: 0 })
  })
})

describe('selloDeFecha', () => {
  it('escribe la fecha en un formato que un humano entiende y nosotros podemos leer', () => {
    expect(selloDeFecha(new Date(2026, 8, 3, 14, 32))).toBe('2026-09-03 14:32')
    expect(selloDeFecha(new Date(2026, 0, 9, 7, 5))).toBe('2026-01-09 07:05')
  })

  it('lo que sellamos es exactamente lo que volvemos a leer', () => {
    const cuando = new Date(2026, 7, 13, 9, 15)
    const leida = fechaDelArchivo([['Generado', selloDeFecha(cuando)]])
    expect(leida?.getTime()).toBe(cuando.getTime())
  })
})

describe('fechaDelArchivo', () => {
  it('encuentra el sello que ponemos al generar el archivo', () => {
    const filas = [
      ['Anfiora'],
      ['Presupuesto del evento'],
      ['Generado', '2026-08-01 09:15'],
      [],
      ['Categoría', 'Concepto', 'Estimado'],
    ]
    expect(fechaDelArchivo(filas)?.getFullYear()).toBe(2026)
    expect(fechaDelArchivo(filas)?.getMonth()).toBe(7)
    expect(fechaDelArchivo(filas)?.getDate()).toBe(1)
  })

  it('devuelve null cuando el archivo no trae sello', () => {
    expect(fechaDelArchivo([['Categoría', 'Concepto', 'Estimado']])).toBeNull()
    expect(fechaDelArchivo([['Generado', 'ayer']])).toBeNull()
    expect(fechaDelArchivo([])).toBeNull()
  })
})

describe('avisoArchivoViejo', () => {
  const ahora = new Date('2026-09-03T12:00:00')

  it('avisa cuando el archivo tiene semanas y ademas baja montos', () => {
    const aviso = avisoArchivoViejo(new Date('2026-08-13T12:00:00'), ahora, true)
    expect(aviso).toContain('hace 3 semanas')
    expect(aviso).toContain('revertir')
  })

  it('no avisa si el archivo es de esta semana', () => {
    expect(avisoArchivoViejo(new Date('2026-09-01T12:00:00'), ahora, true)).toBeNull()
  })

  it('no avisa si nada baja, por viejo que sea el archivo', () => {
    expect(avisoArchivoViejo(new Date('2026-05-01T12:00:00'), ahora, false)).toBeNull()
  })

  it('no avisa cuando no hay sello que leer', () => {
    expect(avisoArchivoViejo(null, ahora, true)).toBeNull()
  })

  it('habla en meses cuando el archivo es muy viejo', () => {
    expect(avisoArchivoViejo(new Date('2026-06-03T12:00:00'), ahora, true)).toContain('hace 3 meses')
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
    expect(resumenImport(plan)).toMatchObject({ agregar: 1, actualizar: 1, sinCambios: 1 })
  })
})
