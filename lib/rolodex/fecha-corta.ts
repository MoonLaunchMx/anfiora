const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

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
