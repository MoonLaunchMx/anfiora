import { describe, it, expect } from 'vitest'
import { armarMensajeSolicitud } from './mensaje'

describe('mensaje de solicitud', () => {
  it('incluye lo que Diego necesita para decidir sin preguntar', () => {
    const texto = armarMensajeSolicitud({
      nombre: 'Bodas Planner',
      email: 'patty@ejemplo.com',
      telefono: '+528111111111',
      tipoDeCuenta: 'planner',
      planActual: 'free',
      sello: null,
      eventosVigentes: 2,
      personasEnEvento: 151,
      motivo: 'invitados',
      eventosAlAno: '12',
      tipoDeEventos: 'Bodas',
      tamanoDeEquipo: '3',
      contactoPreferido: 'WhatsApp',
      ciudad: 'Monterrey',
      mensaje: 'Necesito mas invitados',
    })
    expect(texto).toContain('patty@ejemplo.com')
    expect(texto).toContain('planner')
    expect(texto).toContain('free')
    expect(texto).toContain('151')
    expect(texto).toContain('+528111111111')
  })

  it('avisa el plan y el sello juntos cuando hay sello', () => {
    const texto = armarMensajeSolicitud({
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      telefono: '+528122222222',
      tipoDeCuenta: 'anfitrion',
      planActual: 'free',
      sello: 'fundador',
      eventosVigentes: 1,
      personasEnEvento: 30,
      motivo: 'eventos',
      eventosAlAno: '1',
      tipoDeEventos: 'Boda',
      tamanoDeEquipo: '1',
      contactoPreferido: 'Llamada',
      ciudad: 'CDMX',
      mensaje: '',
    })
    expect(texto).toContain('Plan actual: free (fundador)')
    expect(texto).toContain('Tope que topo: eventos')
    expect(texto).toContain('Mensaje: sin mensaje')
  })
})
