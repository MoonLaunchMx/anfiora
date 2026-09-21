export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// created_at es un timestamptz de verdad (con hora y zona), a diferencia de
// las fechas de evento ('YYYY-MM-DD') que se parten a mano en otras partes
// del codigo para no caer en el corrimiento UTC. Aqui new Date() si es seguro.
export function formatFechaCorta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dia = d.getDate()
  const mes = MESES_CORTOS[d.getMonth()]
  const ano = String(d.getFullYear()).slice(-2)
  return `${dia} ${mes} ${ano}`
}

// Para fechas de evento ('YYYY-MM-DD'): se parten a mano para no caer en el
// corrimiento UTC de new Date('2026-07-26'), que en Mexico da el 25.
export function fechaCortaISO(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  const mes = MESES_CORTOS[Number(m[2]) - 1]
  if (!mes) return ''
  return `${Number(m[3])} ${mes}`
}
