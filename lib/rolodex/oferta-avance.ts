import type { SupplierStatus } from '@/lib/types'

// Un "no" se respeta, pero solo para esa oferta puntual: declinar "mover a
// Cotizado" no debe silenciar, meses despues, la oferta de "mover a
// Contratado" para el mismo proveedor -- son evidencias distintas. Por eso la
// llave incluye el destino ofrecido. Vive en localStorage, igual que la
// preferencia de useStatsToggle -- no amerita columna en la DB.
const PREFIJO = 'anfiora_oferta_avance_'

function llave(eventSupplierId: string, destino: SupplierStatus): string {
  return `${PREFIJO}${eventSupplierId}:${destino}`
}

export function yaRechazoLaOferta(eventSupplierId: string, destino: SupplierStatus): boolean {
  return window.localStorage.getItem(llave(eventSupplierId, destino)) === 'no'
}

export function recordarRechazo(eventSupplierId: string, destino: SupplierStatus): void {
  window.localStorage.setItem(llave(eventSupplierId, destino), 'no')
}
