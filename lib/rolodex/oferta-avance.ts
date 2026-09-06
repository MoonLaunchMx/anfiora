// Un "no" se respeta: si el planner ya declino mover este proveedor una vez,
// no se le vuelve a preguntar por el mismo proveedor. Vive en localStorage,
// igual que la preferencia de useStatsToggle -- no amerita columna en la DB.
const PREFIJO = 'anfiora_oferta_avance_'

export function yaRechazoLaOferta(eventSupplierId: string): boolean {
  return window.localStorage.getItem(PREFIJO + eventSupplierId) === 'no'
}

export function recordarRechazo(eventSupplierId: string): void {
  window.localStorage.setItem(PREFIJO + eventSupplierId, 'no')
}
