import type { Currency, SupplierStatus } from '@/lib/types'
import {
  armarFilas, partirActivosHistorial, tasaDeCierre, ahorroNegociado,
  rangoContratado, calificaciones,
} from './expediente'
import type { EventoCrudo, PagoCrudo, PartidaCruda, ReviewCruda, VinculoCrudo } from './expediente'
import type { ColumnaDirectorioKey } from './columnas-directorio'

export type ProveedorCrudo = {
  id: string
  name: string
  category_id: string | null
  city: string | null
  state_region: string | null
  tags: string[] | null
}

export type VinculoDirectorio = VinculoCrudo & { supplier_id: string }
export type ReviewDirectorio = ReviewCruda & { supplier_id: string }

export type UltimaVez = {
  eventoId: string
  nombre: string
  fecha: string | null
  estatus: SupplierStatus
}

export type FilaDirectorio = {
  id: string
  nombre: string
  categoriaId: string | null
  ciudad: string | null
  estadoRegion: string | null
  tags: string[]
  eventos: number
  activos: number
  contratados: number
  cotizados: number
  tasa: number | null
  ahorro: number | null
  ahorroN: number
  // La suma de los ahorros por evento, sin promediar: es lo que deja sacar el
  // promedio de toda la cuenta sin promediar promedios.
  ahorroSuma: number
  planner: number | null
  cliente: number | null
  rango: { min: number; max: number } | null
  moneda: Currency
  ultimaVez: UltimaVez | null
}

export function armarDirectorio(datos: {
  proveedores: ProveedorCrudo[]
  vinculos: VinculoDirectorio[]
  eventos: EventoCrudo[]
  partidas: PartidaCruda[]
  pagos: PagoCrudo[]
  reviews: ReviewDirectorio[]
  hoy: string
}): FilaDirectorio[] {
  const vinculosPorProveedor = new Map<string, VinculoDirectorio[]>()
  for (const v of datos.vinculos) {
    const lista = vinculosPorProveedor.get(v.supplier_id) ?? []
    lista.push(v)
    vinculosPorProveedor.set(v.supplier_id, lista)
  }
  const reviewsPorProveedor = new Map<string, ReviewDirectorio[]>()
  for (const r of datos.reviews) {
    const lista = reviewsPorProveedor.get(r.supplier_id) ?? []
    lista.push(r)
    reviewsPorProveedor.set(r.supplier_id, lista)
  }

  return datos.proveedores.map(p => {
    const vinculos = vinculosPorProveedor.get(p.id) ?? []
    const reviews = reviewsPorProveedor.get(p.id) ?? []
    const filas = armarFilas({
      vinculos,
      eventos: datos.eventos,
      partidas: datos.partidas,
      pagos: datos.pagos,
      reviews,
    })
    const { activos } = partirActivosHistorial(filas, datos.hoy)
    const tasa = tasaDeCierre(filas)
    const ahorro = ahorroNegociado(filas)
    const calif = calificaciones(reviews)

    const conFecha = filas.filter(f => f.fecha)
    conFecha.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
    const ultima = conFecha[0] ?? filas[0] ?? null

    return {
      id: p.id,
      nombre: p.name,
      categoriaId: p.category_id,
      ciudad: p.city,
      estadoRegion: p.state_region,
      tags: p.tags ?? [],
      eventos: filas.length,
      activos: activos.length,
      contratados: tasa.contratados,
      cotizados: tasa.cotizados,
      tasa: tasa.porcentaje,
      ahorro: ahorro.promedio,
      ahorroN: ahorro.n,
      ahorroSuma: filas.reduce((s, f) => s + (f.ahorro ?? 0), 0),
      planner: calif.planner,
      cliente: calif.cliente,
      rango: rangoContratado(filas),
      moneda: filas[0]?.moneda ?? 'MXN',
      ultimaVez: ultima
        ? { eventoId: ultima.eventoId, nombre: ultima.nombre, fecha: ultima.fecha, estatus: ultima.estatus }
        : null,
    }
  })
}

export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Buscar pega contra lo que el planner recuerda de un proveedor: como se
// llama, donde atiende y como lo etiqueto.
export function coincideBusqueda(fila: FilaDirectorio, texto: string): boolean {
  const q = normalizar(texto).trim()
  if (!q) return true
  const campos = [fila.nombre, fila.ciudad, fila.estadoRegion, ...fila.tags]
  return campos.some(c => normalizar(c).includes(q))
}

export type FiltrosDirectorio = {
  categoria: Set<string>
  ciudad: Set<string>
}

export function filtrosDirectorioVacios(): FiltrosDirectorio {
  return { categoria: new Set(), ciudad: new Set() }
}

export function contarFiltrosDirectorio(filtros: FiltrosDirectorio): number {
  return filtros.categoria.size + filtros.ciudad.size
}

export function aplicarFiltrosDirectorio(
  filas: FilaDirectorio[],
  filtros: FiltrosDirectorio,
  busqueda: string,
): FilaDirectorio[] {
  return filas.filter(f => {
    if (filtros.categoria.size > 0 && !(f.categoriaId && filtros.categoria.has(f.categoriaId))) return false
    if (filtros.ciudad.size > 0 && !(f.ciudad && filtros.ciudad.has(f.ciudad))) return false
    return coincideBusqueda(f, busqueda)
  })
}

// Ordenar y mostrar hablan del mismo vocabulario: la clave de una columna es la
// misma en el menu, en el encabezado y aqui.
export type ColumnaDirectorio = ColumnaDirectorioKey

// La primera vez que se pica una columna, el orden util no siempre es de mayor
// a menor: los nombres se leen de la A a la Z y en el ahorro lo bueno es lo
// mas negativo.
const PRIMER_ORDEN_ASCENDENTE: ColumnaDirectorio[] = ['proveedor', 'categoria', 'ahorro']

export function ordenInicial(columna: ColumnaDirectorio): boolean {
  return PRIMER_ORDEN_ASCENDENTE.includes(columna)
}

type Clave = { texto: string | null; numero: number | null }

function claveDe(fila: FilaDirectorio, columna: ColumnaDirectorio, nombrePorId: (id: string | null) => string): Clave {
  switch (columna) {
    case 'proveedor': return { texto: normalizar(fila.nombre), numero: null }
    case 'categoria': return { texto: fila.categoriaId ? normalizar(nombrePorId(fila.categoriaId)) : null, numero: null }
    case 'eventos':   return { texto: null, numero: fila.eventos > 0 ? fila.eventos : null }
    case 'cierre':    return { texto: null, numero: fila.tasa }
    case 'ahorro':    return { texto: null, numero: fila.ahorro }
    case 'rango':     return { texto: null, numero: fila.rango ? fila.rango.max : null }
    case 'planner':   return { texto: null, numero: fila.planner }
    case 'cliente':   return { texto: null, numero: fila.cliente }
    case 'ultima':    return { texto: fila.ultimaVez?.fecha ?? null, numero: null }
  }
}

// Lo que no tiene dato se va al final en los dos sentidos: un proveedor sin
// eventos no es "el peor", es uno del que todavia no sabes nada.
export function ordenarDirectorio(
  filas: FilaDirectorio[],
  columna: ColumnaDirectorio,
  ascendente: boolean,
  nombrePorId: (id: string | null) => string = () => '',
): FilaDirectorio[] {
  const copia = [...filas]
  copia.sort((a, b) => {
    const ka = claveDe(a, columna, nombrePorId)
    const kb = claveDe(b, columna, nombrePorId)
    const vacioA = ka.texto === null && ka.numero === null
    const vacioB = kb.texto === null && kb.numero === null
    if (vacioA !== vacioB) return vacioA ? 1 : -1
    if (!vacioA) {
      let c = 0
      if (ka.texto !== null && kb.texto !== null) c = ka.texto.localeCompare(kb.texto, 'es')
      else if (ka.numero !== null && kb.numero !== null) c = ka.numero - kb.numero
      if (c !== 0) return ascendente ? c : -c
    }
    return normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es')
  })
  return copia
}

export function resumenDirectorio(filas: FilaDirectorio[]): {
  total: number
  conEvento: number
  sinEvento: number
  contratados: number
} {
  const conEvento = filas.filter(f => f.eventos > 0).length
  return {
    total: filas.length,
    conEvento,
    sinEvento: filas.length - conEvento,
    contratados: filas.filter(f => f.contratados > 0).length,
  }
}

export type EstadisticasDirectorio = {
  total: number
  sinEvento: number
  conEvento: number
  contratados: number
  tasa: number | null
  tasaContratados: number
  tasaCotizados: number
  ahorro: number | null
  ahorroN: number
  categorias: number
  eventos: number
  planner: number | null
  cliente: number | null
}

function promedioDe(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null)
  if (v.length === 0) return null
  return Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10
}

// Las mismas cuatro cifras que el expediente muestra de un proveedor, pero de
// toda la cuenta, para que un numero signifique lo mismo en las dos pantallas.
// La tasa se saca de los totales, no promediando las tasas de cada proveedor:
// un proveedor con una sola cotizacion pesaria igual que uno con diez.
export function estadisticasDirectorio(filas: FilaDirectorio[]): EstadisticasDirectorio {
  const resumen = resumenDirectorio(filas)
  const tasaContratados = filas.reduce((s, f) => s + f.contratados, 0)
  const tasaCotizados = filas.reduce((s, f) => s + f.cotizados, 0)
  const ahorroN = filas.reduce((s, f) => s + f.ahorroN, 0)
  const ahorroSuma = filas.reduce((s, f) => s + f.ahorroSuma, 0)
  return {
    total: resumen.total,
    sinEvento: resumen.sinEvento,
    conEvento: resumen.conEvento,
    contratados: resumen.contratados,
    tasa: tasaCotizados > 0 ? Math.round((tasaContratados / tasaCotizados) * 100) : null,
    tasaContratados,
    tasaCotizados,
    ahorro: ahorroN > 0 ? Math.round(ahorroSuma / ahorroN) : null,
    ahorroN,
    categorias: new Set(filas.map(f => f.categoriaId).filter(Boolean)).size,
    eventos: filas.reduce((s, f) => s + f.eventos, 0),
    planner: promedioDe(filas.map(f => f.planner)),
    cliente: promedioDe(filas.map(f => f.cliente)),
  }
}

export function ciudadesDe(filas: FilaDirectorio[]): string[] {
  return [...new Set(filas.map(f => f.ciudad).filter((c): c is string => !!c))]
    .sort((a, b) => a.localeCompare(b, 'es'))
}

export function categoriasDe(filas: FilaDirectorio[]): string[] {
  return [...new Set(filas.map(f => f.categoriaId).filter((c): c is string => !!c))]
}
