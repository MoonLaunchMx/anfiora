import { fechaCortaISO } from '@/lib/rolodex/fecha-corta'

// El cliente tiene 14 dias despues del evento para contestar. El plazo cuenta
// desde el ULTIMO dia del evento, no desde que se manda el link: mandar tarde
// deja menos dias, y el aviso lo dice antes de enviar.
export const DIAS_PLAZO_CLIENTE = 14

export type EstadoLink = 'antes' | 'sin_pedir' | 'enviada' | 'por_vencer' | 'vencida'

export type InfoLink = {
  estado: EstadoLink
  vence: string | null
  diasRestantes: number | null
}

const DIA_MS = 24 * 60 * 60 * 1000

// Todo en UTC a proposito: la fecha 'YYYY-MM-DD' se trata como un dia sin
// zona, y Date.UTC no le aplica la zona de la maquina.
function aUTC(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

function aISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function sumarDias(iso: string, dias: number): string {
  return aISO(aUTC(iso) + dias * DIA_MS)
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS)
}

export function venceDefault(ultimoDiaEvento: string): string {
  return sumarDias(ultimoDiaEvento, DIAS_PLAZO_CLIENTE)
}

export function estadoDelLink({ hoy, ultimoDiaEvento, token, expiresAt }: {
  hoy: string
  ultimoDiaEvento: string | null
  token: string | null
  expiresAt: string | null
}): InfoLink {
  if (!ultimoDiaEvento || diasEntre(ultimoDiaEvento, hoy) <= 0) {
    return { estado: 'antes', vence: null, diasRestantes: null }
  }
  const vence = expiresAt ?? venceDefault(ultimoDiaEvento)
  const diasRestantes = diasEntre(hoy, vence)
  if (diasRestantes < 0) return { estado: 'vencida', vence, diasRestantes }
  if (!token) return { estado: 'sin_pedir', vence, diasRestantes }
  if (diasRestantes <= 3) return { estado: 'por_vencer', vence, diasRestantes }
  return { estado: 'enviada', vence, diasRestantes }
}

// Suma sobre lo que siga vivo: si el plazo ya paso, desde hoy.
export function extenderVencimiento({ hoy, venceActual, dias }: {
  hoy: string
  venceActual: string | null
  dias: number
}): string {
  const base = venceActual && diasEntre(hoy, venceActual) >= 0 ? venceActual : hoy
  return sumarDias(base, dias)
}

export function textoAviso(info: InfoLink, contestados: number, total: number): string {
  const avance = `${contestados} de ${total}`
  const vence = `vence el ${fechaCortaISO(info.vence)}`
  switch (info.estado) {
    case 'sin_pedir': return `Pide la opinión de tu cliente · ${vence}`
    case 'enviada':   return `Tu cliente lleva ${avance} · ${vence}`
    case 'por_vencer': {
      const cuando =
        info.diasRestantes === 0 ? 'Vence hoy' :
        info.diasRestantes === 1 ? 'Vence mañana' :
        `Vence en ${info.diasRestantes} días`
      return `${cuando} · ${avance}`
    }
    case 'vencida':   return `Venció el ${fechaCortaISO(info.vence)} · ${avance}`
    default:          return ''
  }
}

// El color dice el estado sin leer: ambar hay algo que hacer, verde va en
// camino, rojo se acaba el tiempo, gris ya no. Vive aqui porque lo pintan
// dos pantallas -- el aviso de Proveedores y la carpeta Review de la ficha.
export type TonoAviso = 'gold' | 'teal' | 'danger' | 'gris'

export function tonoDelAviso(estado: EstadoLink): TonoAviso | null {
  if (estado === 'antes') return null
  if (estado === 'sin_pedir') return 'gold'
  if (estado === 'por_vencer') return 'danger'
  if (estado === 'vencida') return 'gris'
  return 'teal'
}

export const CLASES_TONO: Record<TonoAviso, string> = {
  gold:   'border-[#efd9a6] bg-[#fdf8ee]',
  teal:   'border-[#bdebdf] bg-[#f0faf7]',
  danger: 'border-[#f0c9c5] bg-[#fdf3f2]',
  gris:   'border-[#e8e8e8] bg-[#f5f5f3]',
}

export function urlOpinion(origin: string, token: string): string {
  return `${origin}/opinion/${token}`
}

export function mensajeWhatsApp(nombreEvento: string, url: string): string {
  return `¿Nos ayudan a calificar a los proveedores de ${nombreEvento}? Les toma unos minutos: ${url}`
}
