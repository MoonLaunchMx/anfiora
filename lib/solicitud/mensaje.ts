export interface DatosSolicitud {
  nombre: string
  email: string
  telefono: string
  tipoDeCuenta: string
  planActual: string
  sello: string | null
  eventosVigentes: number | null
  personasEnEvento: number | null
  motivo: 'eventos' | 'invitados'
  eventosAlAno: string
  tipoDeEventos: string
  tamanoDeEquipo: string
  contactoPreferido: string
  ciudad: string
  mensaje: string
}

// Telegram rechaza mensajes de mas de 4096 caracteres. La suma de estos topes
// mas las etiquetas fijas de armarMensajeSolicitud queda muy por debajo, asi
// que un campo largo nunca tumba el envio de los demas.
export const LIMITES_CAMPO = {
  nombre: 120,
  email: 180,
  telefono: 40,
  tipoDeCuenta: 40,
  planActual: 40,
  eventosAlAno: 60,
  tipoDeEventos: 150,
  tamanoDeEquipo: 60,
  contactoPreferido: 60,
  ciudad: 120,
  mensaje: 1500,
} as const

export type CampoLibre = keyof typeof LIMITES_CAMPO

// Recorta sin partir la marca a la mitad, y avisa que se corto: sin esto el
// destinatario cree que la persona escribio justo lo que le llego.
export function acotarCampo(valor: unknown, campo: CampoLibre): string {
  const texto = typeof valor === 'string' ? valor.trim() : ''
  const max = LIMITES_CAMPO[campo]
  if (texto.length <= max) return texto
  return texto.slice(0, max).trim() + ' (cortado)'
}

export function armarMensajeSolicitud(d: DatosSolicitud): string {
  return [
    'SOLICITUD DE ACCESO',
    'Correo: ' + d.email,
    'Nombre: ' + d.nombre,
    'Tipo de cuenta: ' + d.tipoDeCuenta,
    'Plan actual: ' + d.planActual + (d.sello ? ' (' + d.sello + ')' : ''),
    'Tope que topo: ' + d.motivo,
    'Eventos vigentes: ' + (d.eventosVigentes ?? 'no disponible'),
    'Personas en el evento: ' + (d.personasEnEvento ?? 'no disponible'),
    'Eventos al ano: ' + d.eventosAlAno,
    'Tipo de eventos: ' + d.tipoDeEventos,
    'Tamano de equipo: ' + d.tamanoDeEquipo,
    'Contactar por: ' + d.contactoPreferido,
    'WhatsApp: ' + d.telefono,
    'Ciudad: ' + d.ciudad,
    'Mensaje: ' + (d.mensaje || 'sin mensaje'),
  ].join('\n')
}
