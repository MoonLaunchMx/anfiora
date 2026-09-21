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

// Safari en modo privado (y cualquier navegador con el storage bloqueado)
// lanza SecurityError con solo tocar localStorage, no solo al llenarlo. Sin
// el try/catch esa excepcion tumba la promesa que la llama y se traga la
// oferta de avance entera -- el resto de accesos a storage del modulo ya
// vienen protegidos igual.
export function yaRechazoLaOferta(eventSupplierId: string, destino: SupplierStatus): boolean {
  try {
    return window.localStorage.getItem(llave(eventSupplierId, destino)) === 'no'
  } catch {
    return false
  }
}

export function recordarRechazo(eventSupplierId: string, destino: SupplierStatus): void {
  try {
    window.localStorage.setItem(llave(eventSupplierId, destino), 'no')
  } catch {}
}
