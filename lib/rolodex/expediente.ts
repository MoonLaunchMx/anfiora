import type { Currency, MotivoDescarte, RazonSeleccion, SupplierStatus } from '@/lib/types'
import { MOTIVO_DESCARTE_LABEL, RAZON_SELECCION_LABEL } from '@/lib/types'
import { calcularScores } from '@/lib/reviews/scores'
import type { ReviewParaScore } from '@/lib/reviews/scores'
import { contratadoDelProveedor } from '@/lib/presupuesto/derivados'
import { MESES_CORTOS } from './fecha-corta'

export type VinculoCrudo = {
  id: string
  event_id: string
  status: SupplierStatus
  quoted_amount: number | null
}

export type EventoCrudo = {
  id: string
  name: string
  event_date: string | null
  event_end_date: string | null
  venue: string | null
  currency: Currency
}

export type PartidaCruda = { event_supplier_id: string | null; contract_amount: number | null }
export type PagoCrudo = { event_supplier_id: string; amount: number }

export type ReviewCruda = ReviewParaScore & {
  event_supplier_id: string
  razones_seleccion: RazonSeleccion[] | null
  motivo_descarte: MotivoDescarte | null
  comentarios: string | null
}

export type FilaExpediente = {
  vinculoId: string
  eventoId: string
  nombre: string
  fecha: string | null
  fechaFin: string | null
  lugar: string | null
  estatus: SupplierStatus
  moneda: Currency
  cotizado: number | null
  contratado: number | null
  pagado: number
  porPagar: number | null
  porcentajePagado: number | null
  ahorro: number | null
  porQue: string | null
  planner: number | null
  cliente: number | null
  comentario: string | null
}

const LLEGO_A_COTIZAR: SupplierStatus[] = ['cotizado', 'contratado', 'descartado']

function monto(valor: number | null | undefined): number | null {
  if (valor == null) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

// Porcentaje entero de lo que bajo (negativo) o subio (positivo) del cotizado
// al contratado. Solo tiene sentido con los dos montos.
export function ahorroDe(cotizado: number | null, contratado: number | null): number | null {
  if (!cotizado || !contratado || cotizado <= 0 || contratado <= 0) return null
  return Math.round(((contratado - cotizado) / cotizado) * 100)
}

function porQueDe(reviews: ReviewCruda[]): string | null {
  const contratacion = reviews.find(r => r.review_type === 'contratacion')
  if (contratacion?.razones_seleccion?.length) {
    return contratacion.razones_seleccion.map(r => RAZON_SELECCION_LABEL[r] ?? r).join(' · ')
  }
  const descarte = reviews.find(r => r.review_type === 'descarte')
  if (descarte?.motivo_descarte) return MOTIVO_DESCARTE_LABEL[descarte.motivo_descarte] ?? descarte.motivo_descarte
  return null
}

function comentarioDe(reviews: ReviewCruda[]): string | null {
  const orden: ReviewCruda['review_type'][] = ['post_evento', 'contratacion', 'descarte']
  for (const tipo of orden) {
    const r = reviews.find(x => x.review_type === tipo && x.autor === 'planner' && x.comentarios?.trim())
    if (r) return r.comentarios!.trim()
  }
  return null
}

export function armarFilas(datos: {
  vinculos: VinculoCrudo[]
  eventos: EventoCrudo[]
  partidas: PartidaCruda[]
  pagos: PagoCrudo[]
  reviews: ReviewCruda[]
}): FilaExpediente[] {
  const porEvento = new Map(datos.eventos.map(e => [e.id, e]))
  const pagosPorVinculo = new Map<string, number>()
  for (const p of datos.pagos) {
    pagosPorVinculo.set(p.event_supplier_id, (pagosPorVinculo.get(p.event_supplier_id) ?? 0) + (Number(p.amount) || 0))
  }
  const reviewsPorVinculo = new Map<string, ReviewCruda[]>()
  for (const r of datos.reviews) {
    const lista = reviewsPorVinculo.get(r.event_supplier_id) ?? []
    lista.push(r)
    reviewsPorVinculo.set(r.event_supplier_id, lista)
  }

  const filas: FilaExpediente[] = []
  for (const v of datos.vinculos) {
    const evento = porEvento.get(v.event_id)
    if (!evento) continue
    const reviews = reviewsPorVinculo.get(v.id) ?? []
    const scores = calcularScores(reviews)
    const cotizado = monto(v.quoted_amount)
    const contratado = contratadoDelProveedor({ id: v.id }, datos.partidas)
    const pagado = pagosPorVinculo.get(v.id) ?? 0
    filas.push({
      vinculoId: v.id,
      eventoId: v.event_id,
      nombre: evento.name,
      fecha: evento.event_date,
      fechaFin: evento.event_end_date,
      lugar: evento.venue,
      estatus: v.status,
      moneda: evento.currency,
      cotizado,
      contratado,
      pagado,
      porPagar: contratado != null ? Math.max(0, contratado - pagado) : null,
      porcentajePagado: contratado && contratado > 0 ? Math.min(100, Math.round((pagado / contratado) * 100)) : null,
      ahorro: ahorroDe(cotizado, contratado),
      porQue: porQueDe(reviews),
      planner: scores.desempeno,
      cliente: scores.clientes,
      comentario: comentarioDe(reviews),
    })
  }
  return filas
}

// La fecha local de hoy como 'YYYY-MM-DD', para comparar contra fechas de
// evento sin pasar por new Date(iso) y su corrimiento UTC.
export function hoyISO(ahora: Date = new Date()): string {
  const y = ahora.getFullYear()
  const m = String(ahora.getMonth() + 1).padStart(2, '0')
  const d = String(ahora.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function finDe(fila: Pick<FilaExpediente, 'fecha' | 'fechaFin'>): string | null {
  return fila.fechaFin ?? fila.fecha
}

// Activo = el evento no ha terminado. Sin fecha tambien es activo: nada dice
// que ya paso. Activos del mas cercano al mas lejano; historial del mas
// reciente al mas viejo.
export function partirActivosHistorial<T extends Pick<FilaExpediente, 'fecha' | 'fechaFin'>>(
  filas: T[],
  hoy: string,
): { activos: T[]; historial: T[] } {
  const activos = filas.filter(f => { const fin = finDe(f); return !fin || fin >= hoy })
  const historial = filas.filter(f => { const fin = finDe(f); return !!fin && fin < hoy })
  activos.sort((a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999'))
  historial.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
  return { activos, historial }
}

export function tasaDeCierre(filas: Pick<FilaExpediente, 'estatus'>[]): {
  contratados: number
  cotizados: number
  porcentaje: number | null
} {
  const cotizados = filas.filter(f => LLEGO_A_COTIZAR.includes(f.estatus)).length
  const contratados = filas.filter(f => f.estatus === 'contratado').length
  return { contratados, cotizados, porcentaje: cotizados > 0 ? Math.round((contratados / cotizados) * 100) : null }
}

export function ahorroNegociado(filas: Pick<FilaExpediente, 'ahorro'>[]): { promedio: number | null; n: number } {
  const valores = filas.map(f => f.ahorro).filter((a): a is number => a != null)
  if (valores.length === 0) return { promedio: null, n: 0 }
  return { promedio: Math.round(valores.reduce((s, a) => s + a, 0) / valores.length), n: valores.length }
}

export function rangoContratado(filas: Pick<FilaExpediente, 'contratado'>[]): { min: number; max: number } | null {
  const montos = filas.map(f => f.contratado).filter((c): c is number => c != null && c > 0)
  if (montos.length === 0) return null
  return { min: Math.min(...montos), max: Math.max(...montos) }
}

export function ultimoCierre(filas: Pick<FilaExpediente, 'estatus' | 'nombre' | 'fecha'>[]): { nombre: string; fecha: string | null } | null {
  const contratados = filas.filter(f => f.estatus === 'contratado')
  if (contratados.length === 0) return null
  contratados.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
  return { nombre: contratados[0].nombre, fecha: contratados[0].fecha }
}

export function calificaciones(reviews: ReviewCruda[]): {
  planner: number | null
  cliente: number | null
  eventosCalificados: number
  opiniones: number
} {
  const scores = calcularScores(reviews)
  const conPlanner = new Set(reviews.filter(r => r.review_type === 'post_evento' && r.autor === 'planner').map(r => r.event_supplier_id))
  const conCliente = new Set(reviews.filter(r => r.review_type === 'post_evento' && r.autor === 'cliente').map(r => r.event_supplier_id))
  return { planner: scores.desempeno, cliente: scores.clientes, eventosCalificados: conPlanner.size, opiniones: conCliente.size }
}

function partes(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

export function diasEntre(desde: string, hasta: string): number | null {
  const a = partes(desde)
  const b = partes(hasta)
  if (!a || !b) return null
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)
  return Math.round(ms / 86_400_000)
}

// Lo que va debajo de la fecha: cuanto falta, o que ya paso.
export function etiquetaRelativa(fecha: string | null, fechaFin: string | null, hoy: string): string {
  if (!fecha) return ''
  const fin = fechaFin ?? fecha
  if (fin < hoy) return 'concluido'
  const dias = diasEntre(hoy, fecha)
  if (dias == null) return ''
  if (dias <= 0) return fin > hoy ? 'en curso' : 'hoy'
  if (dias === 1) return 'mañana'
  return `en ${dias} días`
}

export function fechaLarga(iso: string | null): string {
  const p = partes(iso)
  if (!p) return ''
  const mes = MESES_CORTOS[p.m - 1]
  return mes ? `${p.d} ${mes} ${p.y}` : ''
}

export function mesYAno(iso: string | null): string {
  const p = partes(iso)
  if (!p) return ''
  const mes = MESES_CORTOS[p.m - 1]
  return mes ? `${mes} ${p.y}` : String(p.y)
}

function promedio(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null)
  if (v.length === 0) return null
  return Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10
}

export function totales(filas: FilaExpediente[]): {
  eventos: number
  contratados: number
  cotizado: number
  contratado: number
  pagado: number
  porPagar: number
  ahorro: number | null
  planner: number | null
  cliente: number | null
} {
  return {
    eventos: filas.length,
    contratados: filas.filter(f => f.estatus === 'contratado').length,
    cotizado: filas.reduce((s, f) => s + (f.cotizado ?? 0), 0),
    contratado: filas.reduce((s, f) => s + (f.contratado ?? 0), 0),
    pagado: filas.reduce((s, f) => s + f.pagado, 0),
    porPagar: filas.reduce((s, f) => s + (f.porPagar ?? 0), 0),
    ahorro: ahorroNegociado(filas).promedio,
    planner: promedio(filas.map(f => f.planner)),
    cliente: promedio(filas.map(f => f.cliente)),
  }
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
}
