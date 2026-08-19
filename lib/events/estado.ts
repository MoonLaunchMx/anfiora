export type EstadoEvento = 'activo' | 'pasado' | 'archivado'

export type EventoParaEstado = {
  event_status: string | null
  event_date: string | null
  event_end_date: string | null
}

export const ESTADO_LABEL: Record<EstadoEvento, string> = {
  activo: 'Activo',
  pasado: 'Pasado',
  archivado: 'Archivado',
}

// Cualquier valor distinto de 'active' se trata como archivado: asi el codigo
// funciona igual antes y despues de la migracion de paused/cancelled/completed.
export function esArchivado(status: string | null | undefined): boolean {
  return !!status && status !== 'active'
}

function ultimoDia(e: EventoParaEstado): Date | null {
  const raw = e.event_end_date || e.event_date
  if (!raw) return null
  const [year, month, day] = raw.split('T')[0].split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function estadoEvento(e: EventoParaEstado, hoy: Date): EstadoEvento {
  if (esArchivado(e.event_status)) return 'archivado'
  const fin = ultimoDia(e)
  if (!fin) return 'activo'
  const corte = new Date(hoy)
  corte.setHours(0, 0, 0, 0)
  return fin < corte ? 'pasado' : 'activo'
}

export function ocupaLugar(e: EventoParaEstado, hoy: Date): boolean {
  return estadoEvento(e, hoy) === 'activo'
}
