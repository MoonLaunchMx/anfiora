export interface DatosSolicitud {
  nombre: string
  email: string
  telefono: string
  tipoDeCuenta: string
  planActual: string
  sello: string | null
  eventosVigentes: number
  personasEnEvento: number
  motivo: 'eventos' | 'invitados'
  eventosAlAno: string
  tipoDeEventos: string
  tamanoDeEquipo: string
  contactoPreferido: string
  ciudad: string
  mensaje: string
}

export function armarMensajeSolicitud(d: DatosSolicitud): string {
  return [
    'SOLICITUD DE ACCESO',
    'Correo: ' + d.email,
    'Nombre: ' + d.nombre,
    'Tipo de cuenta: ' + d.tipoDeCuenta,
    'Plan actual: ' + d.planActual + (d.sello ? ' (' + d.sello + ')' : ''),
    'Tope que topo: ' + d.motivo,
    'Eventos vigentes: ' + d.eventosVigentes,
    'Personas en el evento: ' + d.personasEnEvento,
    'Eventos al ano: ' + d.eventosAlAno,
    'Tipo de eventos: ' + d.tipoDeEventos,
    'Tamano de equipo: ' + d.tamanoDeEquipo,
    'Contactar por: ' + d.contactoPreferido,
    'WhatsApp: ' + d.telefono,
    'Ciudad: ' + d.ciudad,
    'Mensaje: ' + (d.mensaje || 'sin mensaje'),
  ].join('\n')
}
