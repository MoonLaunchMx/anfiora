export type FechaModo = 'auto' | 'inicio' | 'libre'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function partes(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

export function esVariosDias(inicio: string | null, fin: string | null): boolean {
  const a = partes(inicio)
  const b = partes(fin)
  if (!a || !b) return false
  return `${a.y}-${a.m}-${a.d}` !== `${b.y}-${b.m}-${b.d}`
}

// Un solo dia: "viernes, 9 de octubre de 2026" (con dia de la semana, que ubica
// mas que la fecha sola). Varios dias: el rango, sin repetir mes ni año.
export function formatFechaEvento(inicio: string | null, fin: string | null): string {
  const a = partes(inicio)
  if (!a) return ''
  const b = partes(fin)

  if (!b || !esVariosDias(inicio, fin)) {
    return new Date(a.y, a.m - 1, a.d).toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  }
  if (a.y !== b.y) return `${a.d} de ${MESES[a.m - 1]} de ${a.y} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`
  if (a.m !== b.m) return `${a.d} de ${MESES[a.m - 1]} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`
  return `${a.d} al ${b.d} de ${MESES[a.m - 1]} de ${a.y}`
}

export function textoFechaPortada(
  modo: FechaModo,
  textoPropio: string,
  inicio: string | null,
  fin: string | null,
): string {
  if (modo === 'libre') return textoPropio.trim()
  if (modo === 'inicio') return formatFechaEvento(inicio, null)
  return formatFechaEvento(inicio, fin)
}

// En un evento de varios dias el itinerario ya cuenta el cuando dia por dia, asi
// que el bloque de detalles se queda solo con como llegar. Sin itinerario cargado
// conserva fecha y hora: si no, la invitacion nunca diria cuando empieza.
export function detallesSoloLugar(
  inicio: string | null,
  fin: string | null,
  momentosVisibles: number,
): boolean {
  return esVariosDias(inicio, fin) && momentosVisibles > 0
}
