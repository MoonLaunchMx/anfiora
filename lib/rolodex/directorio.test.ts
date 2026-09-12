import { describe, it, expect } from 'vitest'
import {
  armarDirectorio,
  coincideBusqueda,
  normalizar,
  filtrosDirectorioVacios,
  contarFiltrosDirectorio,
  aplicarFiltrosDirectorio,
  ordenarDirectorio,
  ordenInicial,
  resumenDirectorio,
  estadisticasDirectorio,
  ciudadesDe,
  categoriasDe,
} from './directorio'
import type { FilaDirectorio, ProveedorCrudo, ReviewDirectorio, VinculoDirectorio } from './directorio'
import type { EventoCrudo, PagoCrudo, PartidaCruda } from './expediente'

const HOY = '2026-09-11'

const eventos: EventoCrudo[] = [
  { id: 'e-ana',    name: 'Ana & Rodrigo',   event_date: '2026-11-14', event_end_date: null, venue: 'Hacienda San José', currency: 'MXN' },
  { id: 'e-pau',    name: 'Paulina & Marco', event_date: '2025-11-09', event_end_date: null, venue: null,                currency: 'MXN' },
  { id: 'e-ren',    name: 'Renata & Iker',   event_date: '2025-08-17', event_end_date: null, venue: null,                currency: 'MXN' },
]

const proveedores: ProveedorCrudo[] = [
  { id: 'p-foto',  name: 'Lente Norte',       category_id: 'c-imagen', city: 'San Pedro', state_region: 'Nuevo León', tags: ['boutique'] },
  { id: 'p-audio', name: 'Sonido Delta',      category_id: 'c-audio',  city: 'Guadalupe', state_region: 'Nuevo León', tags: [] },
  { id: 'p-flor',  name: 'Floreria Cenicienta', category_id: null,     city: null,        state_region: null,         tags: null },
]

const vinculos: VinculoDirectorio[] = [
  { id: 'v-foto-ana', supplier_id: 'p-foto',  event_id: 'e-ana', status: 'contratado', quoted_amount: 62000 },
  { id: 'v-foto-pau', supplier_id: 'p-foto',  event_id: 'e-pau', status: 'contratado', quoted_amount: 44000 },
  { id: 'v-foto-ren', supplier_id: 'p-foto',  event_id: 'e-ren', status: 'descartado', quoted_amount: 61000 },
  { id: 'v-audio',    supplier_id: 'p-audio', event_id: 'e-pau', status: 'nuevo',      quoted_amount: null },
]

const partidas: PartidaCruda[] = [
  { event_supplier_id: 'v-foto-ana', contract_amount: 58000 },
  { event_supplier_id: 'v-foto-pau', contract_amount: 38000 },
]

const pagos: PagoCrudo[] = [
  { event_supplier_id: 'v-foto-ana', amount: 20000 },
]

const vacia = { precio_valor: null, calidad: null, comunicacion: null, servicio_trato: null, manejo_imprevistos: null, razones_seleccion: null, motivo_descarte: null, comentarios: null }

const reviews: ReviewDirectorio[] = [
  { ...vacia, supplier_id: 'p-foto', event_supplier_id: 'v-foto-pau', review_type: 'post_evento', autor: 'planner', precio_valor: 4, calidad: 4, comunicacion: 4, servicio_trato: 4, manejo_imprevistos: 4 },
  { ...vacia, supplier_id: 'p-foto', event_supplier_id: 'v-foto-pau', review_type: 'post_evento', autor: 'cliente', precio_valor: 5, calidad: 5, comunicacion: 5, servicio_trato: 5, manejo_imprevistos: 5 },
  { ...vacia, supplier_id: 'p-foto', event_supplier_id: 'v-foto-ren', review_type: 'descarte',    autor: 'planner', motivo_descarte: 'precio' },
]

const filas = armarDirectorio({ proveedores, vinculos, eventos, partidas, pagos, reviews, hoy: HOY })
const porId = (id: string) => filas.find(f => f.id === id)!

describe('armarDirectorio', () => {
  it('una fila por proveedor, aunque nunca haya estado en un evento', () => {
    expect(filas).toHaveLength(3)
    expect(porId('p-flor').eventos).toBe(0)
    expect(porId('p-flor').ultimaVez).toBeNull()
  })

  it('cuenta los eventos del proveedor y cuantos siguen activos', () => {
    expect(porId('p-foto').eventos).toBe(3)
    expect(porId('p-foto').activos).toBe(1)
    expect(porId('p-audio').eventos).toBe(1)
    expect(porId('p-audio').activos).toBe(0)
  })

  it('la tasa de cierre solo cuenta a los que llegaron a cotizar', () => {
    expect(porId('p-foto').tasa).toBe(67)
    expect(porId('p-foto').contratados).toBe(2)
    expect(porId('p-foto').cotizados).toBe(3)
    expect(porId('p-audio').tasa).toBeNull()
  })

  it('promedia el ahorro de los eventos con cotizado y contratado', () => {
    expect(porId('p-foto').ahorro).toBe(-10)
    expect(porId('p-foto').ahorroN).toBe(2)
    expect(porId('p-audio').ahorro).toBeNull()
    expect(porId('p-audio').ahorroN).toBe(0)
  })

  it('separa la calificacion del planner de la del cliente', () => {
    expect(porId('p-foto').planner).toBe(4)
    expect(porId('p-foto').cliente).toBe(5)
    expect(porId('p-audio').planner).toBeNull()
    expect(porId('p-audio').cliente).toBeNull()
  })

  it('el rango de inversion sale de lo contratado', () => {
    expect(porId('p-foto').rango).toEqual({ min: 38000, max: 58000 })
    expect(porId('p-audio').rango).toBeNull()
  })

  it('la ultima vez es el evento mas reciente, con cualquier estatus', () => {
    expect(porId('p-foto').ultimaVez).toEqual({
      eventoId: 'e-ana', nombre: 'Ana & Rodrigo', fecha: '2026-11-14', estatus: 'contratado',
    })
    expect(porId('p-audio').ultimaVez?.estatus).toBe('nuevo')
  })

  it('esta activo si sigue vivo en algun evento', () => {
    expect(porId('p-foto').activo).toBe(true)
    expect(porId('p-audio').activo).toBe(true)
  })

  it('sin ningun evento no esta activo', () => {
    expect(porId('p-flor').activo).toBe(false)
  })

  it('solo descartado tampoco es estar activo', () => {
    const soloDescartado = armarDirectorio({
      proveedores: [proveedores[1]],
      vinculos: [{ id: 'v-x', supplier_id: 'p-audio', event_id: 'e-ana', status: 'descartado', quoted_amount: null }],
      eventos, partidas, pagos, reviews: [], hoy: HOY,
    })
    expect(soloDescartado[0].activo).toBe(false)
    expect(soloDescartado[0].eventos).toBe(1)
  })

  it('estar activo no es lo mismo que tener eventos por venir', () => {
    // Solo estuvo en una boda que ya paso, pero la relacion nunca se descarto.
    expect(porId('p-audio').activos).toBe(0)
    expect(porId('p-audio').activo).toBe(true)
  })

  it('las resenas de un proveedor no se le cuentan a otro', () => {
    expect(porId('p-audio').planner).toBeNull()
    expect(porId('p-flor').cliente).toBeNull()
  })

  it('sin etiquetas devuelve lista vacia, nunca null', () => {
    expect(porId('p-flor').tags).toEqual([])
  })
})

describe('normalizar y coincideBusqueda', () => {
  it('ignora acentos y mayusculas', () => {
    expect(normalizar('Nuevo León')).toBe('nuevo leon')
  })
  it('pega contra nombre, ciudad, estado y etiquetas', () => {
    const f = porId('p-foto')
    expect(coincideBusqueda(f, 'lente')).toBe(true)
    expect(coincideBusqueda(f, 'san pedro')).toBe(true)
    expect(coincideBusqueda(f, 'leon')).toBe(true)
    expect(coincideBusqueda(f, 'boutique')).toBe(true)
    expect(coincideBusqueda(f, 'mariachi')).toBe(false)
  })
  it('sin texto no filtra nada', () => {
    expect(coincideBusqueda(porId('p-flor'), '   ')).toBe(true)
  })
})

describe('filtros', () => {
  it('arranca vacio y cuenta lo activo', () => {
    const f = filtrosDirectorioVacios()
    expect(contarFiltrosDirectorio(f)).toBe(0)
    f.categoria.add('c-audio')
    f.ciudad.add('Guadalupe')
    expect(contarFiltrosDirectorio(f)).toBe(2)
  })

  it('filtra por categoria', () => {
    const f = filtrosDirectorioVacios()
    f.categoria.add('c-imagen')
    expect(aplicarFiltrosDirectorio(filas, f, '').map(x => x.id)).toEqual(['p-foto'])
  })

  it('filtra por ciudad y deja fuera a los que no tienen', () => {
    const f = filtrosDirectorioVacios()
    f.ciudad.add('Guadalupe')
    expect(aplicarFiltrosDirectorio(filas, f, '').map(x => x.id)).toEqual(['p-audio'])
  })

  it('combina filtro y busqueda', () => {
    const f = filtrosDirectorioVacios()
    f.categoria.add('c-imagen')
    expect(aplicarFiltrosDirectorio(filas, f, 'sonido')).toHaveLength(0)
  })
})

describe('ordenarDirectorio', () => {
  const nombreCat = (id: string | null) => (id === 'c-audio' ? 'Audio y Video' : id === 'c-imagen' ? 'Imagen' : '')

  it('por proveedor de la A a la Z', () => {
    expect(ordenarDirectorio(filas, 'proveedor', true).map(f => f.nombre))
      .toEqual(['Floreria Cenicienta', 'Lente Norte', 'Sonido Delta'])
  })

  it('manda al final lo que no tiene dato, en los dos sentidos, desempatando por nombre', () => {
    expect(ordenarDirectorio(filas, 'cierre', false).map(f => f.id)).toEqual(['p-foto', 'p-flor', 'p-audio'])
    expect(ordenarDirectorio(filas, 'cierre', true).map(f => f.id)).toEqual(['p-foto', 'p-flor', 'p-audio'])
  })

  it('los que nunca han estado en un evento van hasta abajo, alfabeticos', () => {
    const sinEventos: FilaDirectorio[] = [
      { ...porId('p-flor'), id: 'z', nombre: 'Zapateria' },
      porId('p-flor'),
      porId('p-foto'),
    ]
    expect(ordenarDirectorio(sinEventos, 'ultima', false).map(f => f.nombre))
      .toEqual(['Lente Norte', 'Floreria Cenicienta', 'Zapateria'])
  })

  it('ordena la categoria por su nombre, no por su id', () => {
    expect(ordenarDirectorio(filas, 'categoria', true, nombreCat).map(f => f.id))
      .toEqual(['p-audio', 'p-foto', 'p-flor'])
  })

  it('empata por nombre', () => {
    const empatados: FilaDirectorio[] = [
      { ...porId('p-audio'), id: 'b', nombre: 'Banda B', eventos: 2, ultimaVez: null },
      { ...porId('p-audio'), id: 'a', nombre: 'Banda A', eventos: 2, ultimaVez: null },
    ]
    expect(ordenarDirectorio(empatados, 'eventos', false).map(f => f.nombre)).toEqual(['Banda A', 'Banda B'])
  })

  it('no muta la lista que recibe', () => {
    const antes = filas.map(f => f.id)
    ordenarDirectorio(filas, 'proveedor', true)
    expect(filas.map(f => f.id)).toEqual(antes)
  })

  it('el primer clic ordena de menor a mayor solo donde es util', () => {
    expect(ordenInicial('proveedor')).toBe(true)
    expect(ordenInicial('categoria')).toBe(true)
    expect(ordenInicial('ahorro')).toBe(true)
    expect(ordenInicial('eventos')).toBe(false)
    expect(ordenInicial('ultima')).toBe(false)
  })
})

describe('estadisticasDirectorio', () => {
  it('la tasa de la cuenta sale de los totales, no del promedio de las tasas', () => {
    const e = estadisticasDirectorio(filas)
    expect(e.tasaContratados).toBe(2)
    expect(e.tasaCotizados).toBe(3)
    expect(e.tasa).toBe(67)
  })

  it('el ahorro de la cuenta promedia todos los contratos, no los promedios', () => {
    const e = estadisticasDirectorio(filas)
    expect(e.ahorroN).toBe(2)
    expect(e.ahorro).toBe(-10)
  })

  it('un proveedor con una sola cotizacion no pesa igual que uno con varias', () => {
    const muchas: FilaDirectorio = { ...porId('p-foto'), id: 'm', contratados: 1, cotizados: 9, tasa: 11 }
    const una: FilaDirectorio = { ...porId('p-audio'), id: 'u', contratados: 1, cotizados: 1, tasa: 100 }
    // Promediar 11% y 100% daria 56%; lo correcto es 2 de 10.
    expect(estadisticasDirectorio([muchas, una]).tasa).toBe(20)
  })

  it('sin datos dice null, nunca cero', () => {
    const e = estadisticasDirectorio([porId('p-flor')])
    expect(e.tasa).toBeNull()
    expect(e.ahorro).toBeNull()
    expect(e.total).toBe(1)
  })

  it('suma los eventos de la columna y cuenta las categorias distintas', () => {
    const e = estadisticasDirectorio(filas)
    expect(e.eventos).toBe(4)
    expect(e.categorias).toBe(2)
  })

  it('cuenta cuantos siguen activos', () => {
    expect(estadisticasDirectorio(filas).activos).toBe(2)
    expect(estadisticasDirectorio([porId('p-flor')]).activos).toBe(0)
  })

  it('no resume la inversion: juntar una banda con un banquete no da una cifra', () => {
    expect(estadisticasDirectorio(filas)).not.toHaveProperty('rango')
  })

  it('promedia las estrellas de los que si tienen, sin contar a los demas como cero', () => {
    const e = estadisticasDirectorio(filas)
    expect(e.planner).toBe(4)
    expect(e.cliente).toBe(5)
  })

  it('las cifras se calculan sobre las filas que recibe, para que el pie siga al filtro', () => {
    const f = filtrosDirectorioVacios()
    f.categoria.add('c-audio')
    const e = estadisticasDirectorio(aplicarFiltrosDirectorio(filas, f, ''))
    expect(e.total).toBe(1)
    expect(e.eventos).toBe(1)
    expect(e.tasa).toBeNull()
    expect(e.planner).toBeNull()
  })
})

describe('resumen y listas de filtro', () => {
  it('cuenta cuantos tienen evento y cuantos se han contratado', () => {
    expect(resumenDirectorio(filas)).toEqual({ total: 3, conEvento: 2, sinEvento: 1, contratados: 1 })
  })
  it('las ciudades salen ordenadas y sin repetir', () => {
    expect(ciudadesDe(filas)).toEqual(['Guadalupe', 'San Pedro'])
  })
  it('las categorias que de verdad se usan', () => {
    expect(categoriasDe(filas).sort()).toEqual(['c-audio', 'c-imagen'])
  })
})
