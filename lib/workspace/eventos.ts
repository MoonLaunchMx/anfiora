// Que evento se ofrece al repartir accesos. Puro a proposito: no importa
// lib/supabase, para que se pueda probar con Vitest.

const TERMINADOS = new Set(['cancelled', 'completed', 'archived'])

export interface EventoElegible {
  id: string
  event_date: string | null
  event_status: string | null
}

// Vigente = ni terminado ni con fecha ya pasada. El del dia de hoy SI cuenta:
// el evento se esta trabajando justo ese dia, que es cuando mas se reparte
// acceso. Las fechas son 'YYYY-MM-DD', asi que comparan bien como texto.
export function esEventoVigente(evento: EventoElegible, hoy: string): boolean {
  if (TERMINADOS.has(evento.event_status ?? '')) return false
  if (evento.event_date && evento.event_date < hoy) return false
  return true
}

export function hoyISO(ahora: Date = new Date()): string {
  const y = ahora.getFullYear()
  const m = String(ahora.getMonth() + 1).padStart(2, '0')
  const d = String(ahora.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// `conservar` son los eventos donde la persona YA tiene acceso. Se quedan
// aunque hayan pasado: esconder uno que ya tiene lo dejaria sin manera de
// quitarselo, y desaparecer accesos de la pantalla nunca es lo correcto.
export function eventosParaRepartir<T extends EventoElegible>(
  eventos: T[],
  hoy: string,
  conservar: ReadonlySet<string> = new Set(),
): T[] {
  return eventos.filter(e => conservar.has(e.id) || esEventoVigente(e, hoy))
}
