import type { SupplierStatus } from '@/lib/types'

// Las cuatro carpetas son fijas: lo que cambia es su contenido, no su
// presencia. Ocultarlas por estado obligaba a mover el estado antes de poder
// guardar una cotizacion que ya llego por correo -- el orden real es al reves.
export function carpetasDe(): string[] {
  return ['Contacto', 'Cotización', 'Pagos', 'Review']
}

// El camino del trato. Descartado no es un paso: es salirse de el.
export const CAMINO: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado']

export const QUE_SIGNIFICA: Record<SupplierStatus, string> = {
  nuevo:      'Lo tienes en la mira, todavía no cotiza',
  cotizado:   'Ya te pasó precio',
  contratado: 'Cerrado: se le puede pagar',
  descartado: 'Fuera del trato, sin borrar su historia',
}

// El menu ofrece DESTINOS, no verbos: mezclar avanzar, retroceder y descartar en
// una sola lista de acciones es lo que confundia. Van en el orden del camino y
// descartado al final, porque es la salida.
export function destinosDe(actual: SupplierStatus): SupplierStatus[] {
  return [...CAMINO, 'descartado' as SupplierStatus].filter(estado => estado !== actual)
}

// Cuantos pasos del camino ya se recorrieron, para las palomitas.
export function pasosAlcanzados(estado: SupplierStatus): SupplierStatus[] {
  if (estado === 'descartado') return []
  const hasta = CAMINO.indexOf(estado)
  return hasta === -1 ? [] : CAMINO.slice(0, hasta + 1)
}

export type TipoReviewFicha = 'contratacion' | 'descarte' | 'post_evento'

export const ORDEN_REVIEWS_FICHA: TipoReviewFicha[] = ['contratacion', 'descarte', 'post_evento']

export const TITULO_REVIEW_FICHA: Record<TipoReviewFicha, string> = {
  contratacion: 'Contratación',
  descarte:     'Descarte',
  post_evento:  'Desempeño',
}

export const DESCRIPCION_REVIEW_FICHA: Record<TipoReviewFicha, string> = {
  contratacion: 'La propuesta',
  descarte:     'Por qué no siguió',
  post_evento:  'El día del evento',
}

export const BOTON_REVIEW_FICHA: Record<TipoReviewFicha, string> = {
  contratacion: 'Calificar ahora',
  descarte:     'Calificar ahora',
  post_evento:  'Calificar ahora',
}

// Cada review sigue al estado que el proveedor de verdad alcanzo: no se
// califica la propuesta de quien nunca gano el trato. La fecha del evento NO
// entra: el desempeno se puede calificar desde el dia que se contrata y se
// corrige cuando haga falta, sin candado.
export function esReviewLlenable(tipo: TipoReviewFicha, estado: SupplierStatus): boolean {
  if (tipo === 'contratacion') return estado === 'contratado'
  if (tipo === 'descarte')     return estado === 'descartado'
  return estado === 'contratado'
}

export type FilaDeReview = { tipo: TipoReviewFicha; hecha: boolean }

// La lista "Que falta" de la ficha: lo que ya se califico (aunque el estado
// haya cambiado despues: una review hecha no se esconde) mas lo que el estado
// actual permite llenar. En el orden fijo de ORDEN_REVIEWS_FICHA.
export function filasDeReview(estado: SupplierStatus, existentes: TipoReviewFicha[]): FilaDeReview[] {
  return ORDEN_REVIEWS_FICHA
    .filter(tipo => existentes.includes(tipo) || esReviewLlenable(tipo, estado))
    .map(tipo => ({ tipo, hecha: existentes.includes(tipo) }))
}

export function pendientesDe(filas: FilaDeReview[]): number {
  return filas.filter(f => !f.hecha).length
}

export function resumenPendientes(filas: FilaDeReview[]): string {
  const n = pendientesDe(filas)
  if (filas.length === 0) return 'Nada que calificar todavía'
  if (n === 0) return 'Al día'
  return n === 1 ? '1 pendiente' : `${n} pendientes`
}
