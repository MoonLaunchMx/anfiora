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
      planDeseado: 'pro',
      motivo: 'invitados',
      eventosAlAno: '12',
      tipoDeEventos: 'Bodas',
      tamanoDeEquipo: '3',
      contactoPreferido: 'WhatsApp',
      pais: 'México',
      ciudad: 'Monterrey',
      mensaje: 'Necesito mas invitados',
    }, 'SOL-2409')
    expect(texto).toContain('patty@ejemplo.com')
    expect(texto).toContain('planner')
    expect(texto).toContain('free')
    expect(texto).toContain('151')
    expect(texto).toContain('+528111111111')
    expect(texto).toContain('Pais: México')
    expect(texto).toContain('Ciudad: Monterrey')
  })

  it('pone el folio arriba de todo', () => {
    const texto = armarMensajeSolicitud({
      nombre: 'Bodas Planner',
      email: 'patty@ejemplo.com',
      telefono: '+528111111111',
      tipoDeCuenta: 'planner',
      planActual: 'free',
      sello: null,
      eventosVigentes: 2,
      personasEnEvento: 151,
      planDeseado: 'pro',
      motivo: 'invitados',
      eventosAlAno: '12',
      tipoDeEventos: 'Bodas',
      tamanoDeEquipo: '3',
      contactoPreferido: 'WhatsApp',
      pais: 'México',
      ciudad: 'Monterrey',
      mensaje: '',
    }, 'SOL-2409')
    const lineas = texto.split('\n')
    expect(lineas[0]).toBe('Folio: SOL-2409')
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
      planDeseado: 'studio',
      motivo: 'eventos',
      eventosAlAno: '1',
      tipoDeEventos: 'Boda',
      tamanoDeEquipo: '1',
      contactoPreferido: 'Llamada',
      pais: 'México',
      ciudad: 'CDMX',
      mensaje: '',
    }, 'SOL-1000')
    expect(texto).toContain('Plan actual: free (fundador)')
    expect(texto).toContain('Tope que topo: eventos')
    expect(texto).toContain('Mensaje: sin mensaje')
  })

  it('el plan que la persona eligio va arriba, junto al correo', () => {
    const texto = armarMensajeSolicitud({
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      telefono: '+528122222222',
      tipoDeCuenta: 'anfitrion',
      planActual: 'free',
      sello: null,
      eventosVigentes: 1,
      personasEnEvento: 30,
      planDeseado: 'studio',
      motivo: 'equipo',
      eventosAlAno: '1',
      tipoDeEventos: 'Boda',
      tamanoDeEquipo: '5',
      contactoPreferido: 'Llamada',
      pais: 'México',
      ciudad: 'CDMX',
      mensaje: '',
    }, 'SOL-1001')
    const lineas = texto.split('\n')
    expect(lineas).toContain('Plan que quiere: Studio')
    const idxPlan = lineas.indexOf('Plan que quiere: Studio')
    const idxCorreo = lineas.findIndex(l => l.startsWith('Correo:'))
    expect(idxPlan).toBeGreaterThanOrEqual(0)
    expect(idxCorreo - idxPlan).toBe(1)
  })
})

describe('mensaje de solicitud con datos no disponibles', () => {
  it('nunca fabrica un numero: null se dice "no disponible"', () => {
    const texto = armarMensajeSolicitud({
      nombre: 'Bodas Planner',
      email: 'patty@ejemplo.com',
      telefono: '+528111111111',
      tipoDeCuenta: 'planner',
      planActual: 'free',
      sello: null,
      eventosVigentes: null,
      personasEnEvento: null,
      planDeseado: 'pro',
      motivo: 'invitados',
      eventosAlAno: '',
      tipoDeEventos: '',
      tamanoDeEquipo: '',
      contactoPreferido: 'WhatsApp',
      pais: '',
      ciudad: '',
      mensaje: '',
    }, 'SOL-1234')
    expect(texto).toContain('Eventos vigentes: no disponible')
    expect(texto).toContain('Personas en el evento: no disponible')
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
  it('con los campos de texto al maximo, sigue debajo de 4096', () => {
    const datos: DatosSolicitud = {
      nombre: acotarCampo('a'.repeat(9999), 'nombre'),
      email: acotarCampo('a'.repeat(9999), 'email'),
      telefono: acotarCampo('a'.repeat(9999), 'telefono'),
      tipoDeCuenta: acotarCampo('a'.repeat(9999), 'tipoDeCuenta'),
      planActual: acotarCampo('a'.repeat(9999), 'planActual'),
      sello: 'fundador',
      eventosVigentes: 999,
      personasEnEvento: 999999,
      planDeseado: 'studio',
      motivo: 'invitados',
      eventosAlAno: acotarCampo('a'.repeat(9999), 'eventosAlAno'),
      tipoDeEventos: acotarCampo('a'.repeat(9999), 'tipoDeEventos'),
      tamanoDeEquipo: acotarCampo('a'.repeat(9999), 'tamanoDeEquipo'),
      contactoPreferido: acotarCampo('a'.repeat(9999), 'contactoPreferido'),
      pais: acotarCampo('a'.repeat(9999), 'pais'),
      ciudad: acotarCampo('a'.repeat(9999), 'ciudad'),
      mensaje: acotarCampo('a'.repeat(9999), 'mensaje'),
    }
    expect(armarMensajeSolicitud(datos, 'SOL-9999').length).toBeLessThan(4096)
  })
})
