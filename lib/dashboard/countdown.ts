export type Countdown =
  | { estado: 'faltan'; dias: number; hrs: string; min: string; seg: string }
  | { estado: 'hoy'; hrs: string; min: string; seg: string }
  | { estado: 'pasado' }

export function fechaHoraEvento(event: { event_date: string | null; event_time: string | null }, hoy: Date): Date {
  if (!event.event_date) return hoy
  const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number)
  const base = new Date(year, month - 1, day)
  if (event.event_time) {
    const [h, m] = event.event_time.split(':').map(Number)
    base.setHours(h, m, 0, 0)
  } else {
    base.setHours(0, 0, 0, 0)
  }
  return base
}

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// El dia del evento manda sobre el reloj: aunque la hora ya haya pasado sigue
// siendo hoy, y el reloj baja hasta 00:00:00 en vez de desaparecer. Solo se da
// por pasado cuando el calendario ya cambio de dia.
export function cuentaRegresiva(objetivo: Date, now: Date): Countdown {
  const restante = Math.max(0, objetivo.getTime() - now.getTime())
  const dosDigitos = (n: number) => String(n).padStart(2, '0')

  const reloj = {
    hrs: dosDigitos(Math.floor(restante / 3600000) % 24),
    min: dosDigitos(Math.floor(restante / 60000) % 60),
    seg: dosDigitos(Math.floor(restante / 1000) % 60),
  }

  if (mismoDia(objetivo, now)) return { estado: 'hoy', ...reloj }
  if (objetivo.getTime() <= now.getTime()) return { estado: 'pasado' }

  return { estado: 'faltan', dias: Math.floor(restante / 86400000), ...reloj }
}
