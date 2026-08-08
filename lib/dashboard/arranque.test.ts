import { describe, it, expect } from 'vitest'
import { eventoDeArranque } from './arranque'
import type { EventMetrics } from './types'

const hoy = new Date(2026, 7, 8)

function ev(id: string, event_date: string | null, event_status = 'active'): EventMetrics {
  return { event: { id, event_date, event_status } } as unknown as EventMetrics
}

describe('eventoDeArranque', () => {
  it('abre en el activo mas cercano que todavia no pasa', () => {
    expect(eventoDeArranque([
      ev('a', '2026-12-01'),
      ev('b', '2026-08-20'),
      ev('c', '2027-03-05'),
    ], hoy)).toBe('b')
  })

  it('el de hoy cuenta como proximo, no como pasado', () => {
    expect(eventoDeArranque([ev('a', '2026-09-01'), ev('b', '2026-08-08')], hoy)).toBe('b')
  })

  it('ignora los que no estan activos aunque sean los mas cercanos', () => {
    expect(eventoDeArranque([
      ev('pausado', '2026-08-10', 'paused'),
      ev('cancelado', '2026-08-11', 'cancelled'),
      ev('bueno', '2026-08-30'),
    ], hoy)).toBe('bueno')
  })

  it('si todos ya pasaron abre en el mas reciente', () => {
    expect(eventoDeArranque([ev('viejo', '2024-01-01'), ev('reciente', '2026-07-30')], hoy)).toBe('reciente')
  })

  it('uno sin fecha no le gana a uno con fecha', () => {
    expect(eventoDeArranque([ev('sinfecha', null), ev('confecha', '2026-08-20')], hoy)).toBe('confecha')
  })

  it('si el unico activo no tiene fecha, ese abre', () => {
    expect(eventoDeArranque([ev('sinfecha', null)], hoy)).toBe('sinfecha')
  })

  it('sin eventos activos no hay evento de arranque', () => {
    expect(eventoDeArranque([ev('x', '2026-08-20', 'paused')], hoy)).toBeNull()
    expect(eventoDeArranque([], hoy)).toBeNull()
  })
})
