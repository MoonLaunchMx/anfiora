import type { ArchivoAdjunto, SupplierStatus } from '@/lib/types'
import { visibles } from '@/lib/archivos/adjuntos'

export type EvidenciaProveedor = {
  tieneCotizacion: boolean
  tienePagos: boolean
}

export type BloqueoDeMovimiento = {
  motivo: string
  alternativa: SupplierStatus | null
}

// Cotizado por archivo o por monto: cualquiera de los dos cuenta como
// evidencia, aunque el otro este vacio -- un monto tecleado a mano sin
// cotizacion adjunta sigue siendo una cotizacion.
export function tieneCotizacionRegistrada(
  quoteFiles: ArchivoAdjunto[] | null | undefined,
  quotedAmount: number | null,
): boolean {
  return visibles(quoteFiles).length > 0 || quotedAmount != null
}

// Retroceder no borra la evidencia: si ya cotizo o ya se le pago, el estado
// no puede volver como si nada. Los pagos pesan mas que la cotizacion -- si ya
// hay un pago no hay un solo paso atras que tenga sentido, por eso ese caso no
// ofrece alternativa.
export function bloqueoDe(destino: SupplierStatus, evidencia: EvidenciaProveedor): BloqueoDeMovimiento | null {
  if ((destino === 'nuevo' || destino === 'cotizado') && evidencia.tienePagos) {
    return { motivo: 'Ya tiene pagos registrados.', alternativa: null }
  }
  if (destino === 'nuevo' && evidencia.tieneCotizacion) {
    return { motivo: 'Ya tiene una cotización registrada.', alternativa: 'cotizado' }
  }
  return null
}
