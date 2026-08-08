import { describe, it, expect } from 'vitest'
import { cuentaRegresiva, fechaHoraEvento } from './countdown'

describe('fechaHoraEvento', () => {
  it('junta la fecha con la hora del evento', () => {
    const d = fechaHoraEvento({ event_date: '2027-02-15', event_time: '18:30' }, new Date())
    expect(d.getFullYear()).toBe(2027)
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(30)
  })

  it('sin hora arranca a medianoche', () => {
    const d = fechaHoraEvento({ event_date: '2027-02-15', event_time: null }, new Date())
    expect(d.getHours()).toBe(0)
  })
})

describe('cuentaRegresiva', () => {
  it('cuenta los dias que faltan con su reloj', () => {
    const r = cuentaRegresiva(new Date(2027, 1, 15, 18, 0, 0), new Date(2027, 1, 12, 15, 30, 15))
    expect(r).toEqual({ estado: 'faltan', dias: 3, hrs: '02', min: '29', seg: '45' })
  })

  it('el dia del evento dice hoy y sigue bajando', () => {
    const r = cuentaRegresiva(new Date(2027, 1, 15, 18, 0, 0), new Date(2027, 1, 15, 15, 45, 10))
    expect(r).toEqual({ estado: 'hoy', hrs: '02', min: '14', seg: '50' })
  })

  it('pasada la hora sigue siendo hoy, con el reloj en cero', () => {
    const r = cuentaRegresiva(new Date(2027, 1, 15, 18, 0, 0), new Date(2027, 1, 15, 22, 0, 0))
    expect(r).toEqual({ estado: 'hoy', hrs: '00', min: '00', seg: '00' })
  })

  it('solo es pasado cuando el calendario cambio de dia', () => {
    expect(cuentaRegresiva(new Date(2027, 1, 15, 18, 0, 0), new Date(2027, 1, 16, 0, 1, 0)))
      .toEqual({ estado: 'pasado' })
  })

  it('un evento de madrugada manana no es hoy aunque falten horas', () => {
    const r = cuentaRegresiva(new Date(2027, 1, 16, 1, 0, 0), new Date(2027, 1, 15, 23, 0, 0))
    expect(r).toEqual({ estado: 'faltan', dias: 0, hrs: '02', min: '00', seg: '00' })
  })
})
