import type { EventMetrics } from './types'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fecha(m: EventMetrics): string | null {
  return m.event.event_date ? m.event.event_date.split('T')[0] : null
}

// Con que evento abre el dashboard: el activo mas cercano que todavia no pasa.
// Si todos ya pasaron, el ultimo; los que no tienen fecha van al final, porque
// un evento sin fecha no es "el mas proximo" de nadie. Null = no hay activos,
// y entonces toca la cartera (que ahi si es el lugar correcto: crear uno).
export function eventoDeArranque(metrics: EventMetrics[], hoy: Date): string | null {
  const activos = metrics.filter(m => m.event.event_status === 'active')
  if (activos.length === 0) return null

  const hoyStr = ymd(hoy)
  const conFecha = activos.filter(m => fecha(m) !== null)

  const proximos = conFecha
    .filter(m => (fecha(m) as string) >= hoyStr)
    .sort((a, b) => (fecha(a) as string).localeCompare(fecha(b) as string))
  if (proximos[0]) return proximos[0].event.id

  const pasados = conFecha
    .slice()
    .sort((a, b) => (fecha(b) as string).localeCompare(fecha(a) as string))
  if (pasados[0]) return pasados[0].event.id

  return activos[0].event.id
}
