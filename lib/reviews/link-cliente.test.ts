import { describe, it, expect } from 'vitest'
import {
  DIAS_PLAZO_CLIENTE, sumarDias, diasEntre, venceDefault, estadoDelLink,
  extenderVencimiento, textoAviso, urlOpinion, mensajeWhatsApp,
  tonoDelAviso, CLASES_TONO,
} from './link-cliente'

describe('fechas', () => {
  it('suma dias sin pasar por UTC', () => {
    expect(sumarDias('2026-07-12', 14)).toBe('2026-07-26')
    expect(sumarDias('2026-12-25', 10)).toBe('2027-01-04')
  })
  it('cuenta dias entre dos fechas', () => {
    expect(diasEntre('2026-07-14', '2026-07-26')).toBe(12)
    expect(diasEntre('2026-07-27', '2026-07-26')).toBe(-1)
  })
  it('el plazo por defecto es 14 dias despues del ultimo dia del evento', () => {
    expect(DIAS_PLAZO_CLIENTE).toBe(14)
    expect(venceDefault('2026-07-12')).toBe('2026-07-26')
  })
})

describe('estadoDelLink', () => {
  const base = { ultimoDiaEvento: '2026-07-12', token: null, expiresAt: null }

  it('antes del evento (o el mismo dia) no se puede pedir', () => {
    expect(estadoDelLink({ ...base, hoy: '2026-07-01' }).estado).toBe('antes')
    expect(estadoDelLink({ ...base, hoy: '2026-07-12' }).estado).toBe('antes')
  })
  it('sin fecha de evento no hay nada que pedir', () => {
    expect(estadoDelLink({ ...base, ultimoDiaEvento: null, hoy: '2026-07-20' }).estado).toBe('antes')
  })
  it('paso el evento y no hay token: sin pedir, con el plazo por defecto', () => {
    const info = estadoDelLink({ ...base, hoy: '2026-07-14' })
    expect(info).toEqual({ estado: 'sin_pedir', vence: '2026-07-26', diasRestantes: 12 })
  })
  it('con token y plazo vivo: enviada', () => {
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-14' }).estado).toBe('enviada')
  })
  it('a 3 dias o menos del vencimiento: por vencer', () => {
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-23' }).estado).toBe('por_vencer')
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-26' })).toEqual({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 0 })
  })
  it('pasado el vencimiento: vencida, con o sin token', () => {
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-27' }).estado).toBe('vencida')
    expect(estadoDelLink({ ...base, token: null, hoy: '2026-07-27' }).estado).toBe('vencida')
  })
  it('un vencimiento guardado manda sobre el plazo por defecto', () => {
    const info = estadoDelLink({ ...base, token: 'abc', expiresAt: '2026-08-09', hoy: '2026-07-30' })
    expect(info).toEqual({ estado: 'enviada', vence: '2026-08-09', diasRestantes: 10 })
  })
})

describe('extenderVencimiento', () => {
  it('suma a la fecha actual de vencimiento si sigue viva', () => {
    expect(extenderVencimiento({ hoy: '2026-07-20', venceActual: '2026-07-26', dias: 7 })).toBe('2026-08-02')
  })
  it('si ya vencio, suma desde hoy', () => {
    expect(extenderVencimiento({ hoy: '2026-08-01', venceActual: '2026-07-26', dias: 7 })).toBe('2026-08-08')
  })
  it('sin vencimiento actual, suma desde hoy', () => {
    expect(extenderVencimiento({ hoy: '2026-08-01', venceActual: null, dias: 14 })).toBe('2026-08-15')
  })
})

describe('textoAviso: una linea', () => {
  it('sin pedir', () => {
    expect(textoAviso({ estado: 'sin_pedir', vence: '2026-07-26', diasRestantes: 12 }, 0, 8))
      .toBe('Pide la opinión de tu cliente · vence el 26 jul')
  })
  it('enviada', () => {
    expect(textoAviso({ estado: 'enviada', vence: '2026-07-26', diasRestantes: 9 }, 3, 8))
      .toBe('Tu cliente lleva 3 de 8 · vence el 26 jul')
  })
  it('por vencer: hoy, manana, en N dias', () => {
    expect(textoAviso({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 0 }, 3, 8)).toBe('Vence hoy · 3 de 8')
    expect(textoAviso({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 1 }, 3, 8)).toBe('Vence mañana · 3 de 8')
    expect(textoAviso({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 2 }, 3, 8)).toBe('Vence en 2 días · 3 de 8')
  })
  it('vencida', () => {
    expect(textoAviso({ estado: 'vencida', vence: '2026-07-26', diasRestantes: -3 }, 3, 8)).toBe('Venció el 26 jul · 3 de 8')
  })
})

describe('link y mensaje', () => {
  it('la url es /opinion/<token>', () => {
    expect(urlOpinion('https://anfiora.com', 'AbC123')).toBe('https://anfiora.com/opinion/AbC123')
  })
  it('el mensaje de WhatsApp trae el evento y el link', () => {
    expect(mensajeWhatsApp('Boda Ana & Luis', 'https://anfiora.com/opinion/x'))
      .toBe('¿Nos ayudan a calificar a los proveedores de Boda Ana & Luis? Les toma unos minutos: https://anfiora.com/opinion/x')
  })
})

describe('tonoDelAviso', () => {
  it('antes del evento no hay aviso que pintar', () => {
    expect(tonoDelAviso('antes')).toBeNull()
  })
  it('cada estado tiene su color, y todos tienen clases', () => {
    expect(tonoDelAviso('sin_pedir')).toBe('gold')
    expect(tonoDelAviso('enviada')).toBe('teal')
    expect(tonoDelAviso('por_vencer')).toBe('danger')
    expect(tonoDelAviso('vencida')).toBe('gris')
    for (const tono of ['gold', 'teal', 'danger', 'gris'] as const) {
      expect(CLASES_TONO[tono].length).toBeGreaterThan(0)
    }
  })
})
