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

// Las tres reviews de la ficha: se muestran siempre, aunque no exista alguna
// todavia. El orden es fijo, no depende del estado del proveedor.
export type TipoReviewFicha = 'contratacion' | 'descarte' | 'post_evento'

export const ORDEN_REVIEWS_FICHA: TipoReviewFicha[] = ['contratacion', 'descarte', 'post_evento']

export const TITULO_REVIEW_FICHA: Record<TipoReviewFicha, string> = {
  contratacion: 'Al contratarlo',
  descarte:     'Al descartarlo',
  post_evento:  'Después de la boda',
}

export const DESCRIPCION_REVIEW_FICHA: Record<TipoReviewFicha, string> = {
  contratacion: 'Cómo evaluaste la propuesta antes de contratarlo.',
  descarte:     'Por qué no siguió en el trato.',
  post_evento:  'Cómo se desempeñó el día de la boda.',
}

export const BOTON_REVIEW_FICHA: Record<TipoReviewFicha, string> = {
  contratacion: 'Calificar la contratación',
  descarte:     'Calificar el descarte',
  post_evento:  'Calificar el desempeño',
}

const RAZON_NO_LLENABLE_FICHA: Record<TipoReviewFicha, string> = {
  contratacion: 'Se llena al contratarlo',
  descarte:     'Se llena al descartarlo',
  post_evento:  'Se llena cuando pase la boda',
}

// Cada review solo tiene sentido para el estado que el proveedor de verdad
// alcanzo: calificar la propuesta de alguien que nunca gano el trato no aplica,
// y la de la boda no se puede llenar antes de que la boda pase.
export function esReviewLlenable(tipo: TipoReviewFicha, estado: SupplierStatus, bodaPaso: boolean): boolean {
  if (tipo === 'contratacion') return estado === 'contratado'
  if (tipo === 'descarte')     return estado === 'descartado'
  return estado === 'contratado' && bodaPaso
}

export function razonNoLlenableFicha(tipo: TipoReviewFicha): string {
  return RAZON_NO_LLENABLE_FICHA[tipo]
}
