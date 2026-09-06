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
