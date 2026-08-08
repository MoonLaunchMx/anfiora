import type { RsvpStatus } from '@/lib/types'

// Que ve el invitado en el slot del RSVP cuando vuelve a abrir su link.
export type EstadoRespuesta = 'formulario' | 'resumen' | 'resumen_cerrado'

// Solo estos dos salieron de la boca del invitado. Los otros cuatro valores de
// RsvpStatus ('pending', 'mensaje_enviado', 'respondio', 'accion_necesaria')
// describen el seguimiento del planner, no una respuesta, asi que cuentan como
// pendiente y mantienen el formulario abierto.
const RESPONDIDOS: RsvpStatus[] = ['confirmed', 'declined']

export function respondio(status: string): boolean {
  return RESPONDIDOS.includes(status as RsvpStatus)
}

// El resumen solo aparece cuando TODOS respondieron. Si el planner agrega un
// acompanante despues de que el invitado confirmo, esto reabre el formulario
// solo: el pendiente no depende de que el invitado lo descubra.
export function estadoRespuesta(
  integrantes: { rsvp_status: string }[],
  confirmacionesCerradas: boolean,
): EstadoRespuesta {
  if (integrantes.length === 0) return 'formulario'
  if (!integrantes.every(i => respondio(i.rsvp_status))) return 'formulario'
  return confirmacionesCerradas ? 'resumen_cerrado' : 'resumen'
}

// El grupo se ofrece SOLO a quien va. Basta con que vaya uno del grupo familiar:
// la tarjeta es una sola para todo el party, asi que si el invitado dice si y su
// acompanante no, el boton sale igual.
export function alguienVa(integrantes: { rsvp_status: string }[]): boolean {
  return integrantes.some(i => i.rsvp_status === 'confirmed')
}

// El link vive en el bloque de RSVP del documento, que es donde se pinta el
// boton. Si el anfitrion borro ese bloque, no hay grupo que ofrecer.
export function grupoDelDoc(doc: { sections: { type: string; content: unknown }[] }): string | null {
  const rsvp = doc.sections.find(s => s.type === 'rsvp')
  if (!rsvp) return null
  const v = (rsvp.content as { grupo_whatsapp?: unknown }).grupo_whatsapp
  return typeof v === 'string' ? v : null
}

// Un planner puede pegar cualquier cosa en el campo. Un boton que lleva a la nada
// en la invitacion de un cliente es peor que no tener boton, asi que solo pasa lo
// que de verdad es una invitacion de grupo de WhatsApp.
export function linkGrupoWhatsapp(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  if (!t) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (u.hostname.toLowerCase() !== 'chat.whatsapp.com') return null
  // chat.whatsapp.com a secas es la home, no una invitacion: el codigo del grupo
  // vive en la ruta.
  if (!u.pathname.replace(/\//g, '')) return null
  return u.toString()
}

export type ContactoPlanner = {
  nombre: string | null
  telefono: string | null
  email: string | null
}

type ContactoInput = {
  plannerName?: string | null
  plannerPhone?: string | null
  plannerEmail?: string | null
  // Celular de la cuenta del planner (users.phone). Es respaldo, no fuente.
  hostPhone?: string | null
  tienePrecio?: boolean
}

const limpio = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim()
  return t ? t : null
}

// wa.me pide puros digitos. planner_phone se guarda en E.164 (con '+') y
// hostPhone ya llega sin el, asi que ambos pasan por aqui.
export function waDigits(v: string | null | undefined): string | null {
  const d = (v ?? '').replace(/\D/g, '')
  return d ? d : null
}

// El numero de atencion del evento es la unica fuente de verdad del contacto.
// El celular de la cuenta queda como respaldo SOLO en eventos con precio, para
// no romper el boton "Ya pague" que ya vive en produccion. En eventos gratis no
// hay respaldo: publicar el celular personal del planner en una pagina abierta
// tiene que ser una decision suya, no un default.
export function resolverContacto(input: ContactoInput): ContactoPlanner | null {
  const propio = waDigits(limpio(input.plannerPhone))
  const respaldo = input.tienePrecio ? waDigits(limpio(input.hostPhone)) : null
  const telefono = propio ?? respaldo
  const email = limpio(input.plannerEmail)

  if (!telefono && !email) return null

  return { nombre: limpio(input.plannerName), telefono, email }
}
