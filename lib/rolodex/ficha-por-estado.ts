import type { SupplierStatus } from '@/lib/types'

// Lo que no aplica no existe: a un proveedor que apenas contactaste no se le
// piden pagos, y a uno que descartaste no se le piden estrellas.
export function carpetasDe(estado: SupplierStatus, bodaPaso: boolean): string[] {
  if (estado === 'nuevo')      return ['Contacto']
  if (estado === 'cotizado')   return ['Contacto', 'Cotización']
  if (estado === 'descartado') return ['Contacto', 'Motivo']
  return bodaPaso
    ? ['Contacto', 'Cotización', 'Pagos', 'Reseña']
    : ['Contacto', 'Cotización', 'Pagos']
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
