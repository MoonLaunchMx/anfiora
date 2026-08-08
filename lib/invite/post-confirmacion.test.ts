import { describe, it, expect } from 'vitest'
import { estadoRespuesta, resolverContacto, waDigits, alguienVa, linkGrupoWhatsapp } from './post-confirmacion'

const si = { rsvp_status: 'confirmed' }
const no = { rsvp_status: 'declined' }

describe('estadoRespuesta', () => {
  it('abre el formulario si alguien no ha respondido', () => {
    expect(estadoRespuesta([si, { rsvp_status: 'pending' }], false)).toBe('formulario')
  })

  it('muestra el resumen cuando todos respondieron, vayan o no', () => {
    expect(estadoRespuesta([si, no], false)).toBe('resumen')
  })

  it('cierra el resumen cuando ya paso la fecha limite', () => {
    expect(estadoRespuesta([si, no], true)).toBe('resumen_cerrado')
  })

  // La decision del 8-ago: si el planner agrega un acompanante despues de que
  // el invitado confirmo, el formulario se reabre solo. Si se quedara en el
  // resumen, el pendiente pasaria desapercibido.
  it('reabre el formulario cuando aparece un acompanante nuevo', () => {
    expect(estadoRespuesta([si, si, { rsvp_status: 'pending' }], false)).toBe('formulario')
  })

  // Solo confirmed/declined son respuesta DEL INVITADO. Los otros cuatro son
  // estados del seguimiento del planner y no cuentan como respondido.
  it.each(['pending', 'mensaje_enviado', 'respondio', 'accion_necesaria'])(
    'trata %s como pendiente',
    status => {
      expect(estadoRespuesta([{ rsvp_status: status }], false)).toBe('formulario')
    },
  )

  it('no muestra resumen sin integrantes', () => {
    expect(estadoRespuesta([], false)).toBe('formulario')
  })

  it('cierra aunque la fecha limite pase con un solo integrante', () => {
    expect(estadoRespuesta([si], true)).toBe('resumen_cerrado')
  })
})

describe('resolverContacto', () => {
  it('usa el numero de atencion del evento cuando existe', () => {
    const c = resolverContacto({
      plannerName: 'Ana',
      plannerPhone: '+528112345678',
      plannerEmail: null,
      hostPhone: '5299999999',
      tienePrecio: true,
    })
    expect(c).toEqual({ nombre: 'Ana', telefono: '528112345678', email: null })
  })

  // El respaldo existe para no romper el boton "Ya pague" que ya vive en prod.
  it('cae al telefono de la cuenta en eventos con precio', () => {
    const c = resolverContacto({
      plannerName: null,
      plannerPhone: null,
      plannerEmail: null,
      hostPhone: '5299999999',
      tienePrecio: true,
    })
    expect(c).toEqual({ nombre: null, telefono: '5299999999', email: null })
  })

  // En gratis NO hay respaldo: el celular personal del planner no se publica
  // sin que el lo haya puesto a proposito.
  it('no expone el telefono de la cuenta en eventos gratis', () => {
    expect(
      resolverContacto({
        plannerName: 'Ana',
        plannerPhone: null,
        plannerEmail: null,
        hostPhone: '5299999999',
        tienePrecio: false,
      }),
    ).toBeNull()
  })

  it('muestra la tarjeta con solo correo', () => {
    const c = resolverContacto({
      plannerName: 'Ana',
      plannerPhone: null,
      plannerEmail: 'ana@bodas.mx',
      hostPhone: null,
      tienePrecio: false,
    })
    expect(c).toEqual({ nombre: 'Ana', telefono: null, email: 'ana@bodas.mx' })
  })

  it('no pinta tarjeta sin telefono ni correo', () => {
    expect(
      resolverContacto({
        plannerName: 'Ana',
        plannerPhone: null,
        plannerEmail: null,
        hostPhone: null,
        tienePrecio: true,
      }),
    ).toBeNull()
  })

  it('ignora campos en blanco', () => {
    expect(
      resolverContacto({
        plannerName: '  ',
        plannerPhone: '  ',
        plannerEmail: '  ',
        hostPhone: null,
        tienePrecio: false,
      }),
    ).toBeNull()
  })

  it('recorta el nombre', () => {
    const c = resolverContacto({
      plannerName: '  Ana  ',
      plannerPhone: '+521',
      plannerEmail: null,
      hostPhone: null,
      tienePrecio: false,
    })
    expect(c?.nombre).toBe('Ana')
  })
})

describe('alguienVa', () => {
  it('basta con que vaya uno del party', () => {
    expect(alguienVa([si, no])).toBe(true)
  })

  it('es falso si todos dijeron que no', () => {
    expect(alguienVa([no, no])).toBe(false)
  })

  it('no cuenta a los que no han respondido', () => {
    expect(alguienVa([{ rsvp_status: 'pending' }, { rsvp_status: 'respondio' }])).toBe(false)
  })

  it('es falso sin integrantes', () => {
    expect(alguienVa([])).toBe(false)
  })
})

describe('linkGrupoWhatsapp', () => {
  it('acepta una invitacion de grupo', () => {
    expect(linkGrupoWhatsapp('https://chat.whatsapp.com/AbC123')).toBe('https://chat.whatsapp.com/AbC123')
  })

  it('completa el https faltante', () => {
    expect(linkGrupoWhatsapp('chat.whatsapp.com/AbC123')).toBe('https://chat.whatsapp.com/AbC123')
  })

  // Un boton que lleva a la nada en la invitacion de un cliente es peor que no
  // tener boton.
  it.each([
    'https://wa.me/5218112345678',
    'https://chat.whatsapp.com',
    'https://chat.whatsapp.com/',
    'https://evil.com/chat.whatsapp.com/AbC',
    'https://chat.whatsapp.com.evil.com/AbC',
    'javascript:alert(1)',
    'no soy un link',
    '',
    '   ',
  ])('rechaza %s', v => {
    expect(linkGrupoWhatsapp(v)).toBeNull()
  })

  it('rechaza null y undefined', () => {
    expect(linkGrupoWhatsapp(null)).toBeNull()
    expect(linkGrupoWhatsapp(undefined)).toBeNull()
  })
})

describe('waDigits', () => {
  it('deja solo digitos', () => {
    expect(waDigits('+52 81 1234 5678')).toBe('528112345678')
  })

  it('devuelve null si no queda nada', () => {
    expect(waDigits('abc')).toBeNull()
    expect(waDigits(null)).toBeNull()
  })
})
