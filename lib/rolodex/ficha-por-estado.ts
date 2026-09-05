import type { SupplierStatus } from '@/lib/types'

export type Accion = {
  texto: string
  tono?: 'principal' | 'mala'
  nuevoEstado?: SupplierStatus
  separador?: boolean
}

const SEPARADOR: Accion = { texto: '', separador: true }

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

// La primera siempre es la que mueve el trato hacia adelante. Las que no traen
// nuevoEstado abren el formulario completo.
export function accionesDe(estado: SupplierStatus, bodaPaso: boolean): Accion[] {
  if (estado === 'nuevo') {
    return [
      { texto: 'Ya me cotizó', tono: 'principal', nuevoEstado: 'cotizado' },
      { texto: 'Descartar', tono: 'mala', nuevoEstado: 'descartado' },
    ]
  }

  if (estado === 'cotizado') {
    return [
      { texto: 'Contratar', tono: 'principal', nuevoEstado: 'contratado' },
      { texto: 'Descartar', tono: 'mala', nuevoEstado: 'descartado' },
      SEPARADOR,
      { texto: 'Volver a nuevo', nuevoEstado: 'nuevo' },
    ]
  }

  if (estado === 'descartado') {
    return [
      { texto: 'Recuperar', tono: 'principal', nuevoEstado: 'cotizado' },
    ]
  }

  const contratado: Accion[] = bodaPaso
    ? [
        { texto: 'Calificar', tono: 'principal' },
        { texto: 'Registrar un pago' },
      ]
    : [
        { texto: 'Registrar un pago', tono: 'principal' },
      ]

  return [...contratado, SEPARADOR, { texto: 'Deshacer contrato', nuevoEstado: 'cotizado' }]
}
