import { describe, it, expect } from 'vitest'
import { acotarCampo, armarMensajeSolicitud, LIMITES_CAMPO, type DatosSolicitud } from './mensaje'

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

describe('acotarCampo', () => {
  it('deja intacto un texto que ya cabe', () => {
    expect(acotarCampo('Monterrey', 'ciudad')).toBe('Monterrey')
  })

  it('recorta y no deja pasar espacios sueltos', () => {
    expect(acotarCampo('  Monterrey  ', 'ciudad')).toBe('Monterrey')
  })

  it('cuando no cabe, corta y lo dice', () => {
    const largo = 'a'.repeat(LIMITES_CAMPO.mensaje + 500)
    const resultado = acotarCampo(largo, 'mensaje')
    expect(resultado.length).toBeLessThanOrEqual(LIMITES_CAMPO.mensaje + ' (cortado)'.length)
    expect(resultado.endsWith('(cortado)')).toBe(true)
  })

  it('lo que no es texto se vuelve vacio', () => {
    expect(acotarCampo(undefined, 'nombre')).toBe('')
    expect(acotarCampo(42, 'nombre')).toBe('')
  })
})

describe('el mensaje completo nunca pasa el limite de Telegram', () => {
  it('con los 11 campos de texto al maximo, sigue debajo de 4096', () => {
    const datos: DatosSolicitud = {
      nombre: acotarCampo('a'.repeat(9999), 'nombre'),
      email: acotarCampo('a'.repeat(9999), 'email'),
      telefono: acotarCampo('a'.repeat(9999), 'telefono'),
      tipoDeCuenta: acotarCampo('a'.repeat(9999), 'tipoDeCuenta'),
      planActual: acotarCampo('a'.repeat(9999), 'planActual'),
      sello: 'fundador',
      eventosVigentes: 999,
      personasEnEvento: 999999,
      motivo: 'invitados',
      eventosAlAno: acotarCampo('a'.repeat(9999), 'eventosAlAno'),
      tipoDeEventos: acotarCampo('a'.repeat(9999), 'tipoDeEventos'),
      tamanoDeEquipo: acotarCampo('a'.repeat(9999), 'tamanoDeEquipo'),
      contactoPreferido: acotarCampo('a'.repeat(9999), 'contactoPreferido'),
      ciudad: acotarCampo('a'.repeat(9999), 'ciudad'),
      mensaje: acotarCampo('a'.repeat(9999), 'mensaje'),
    }
    expect(armarMensajeSolicitud(datos).length).toBeLessThan(4096)
  })
})
