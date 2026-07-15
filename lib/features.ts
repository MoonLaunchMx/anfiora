import type React from 'react'
import { LayoutGrid, Gift, Images, Music2, UtensilsCrossed, Shirt, MailOpen, Lock, Globe } from 'lucide-react'
import { EVENT_TYPES } from './event-types'

export type FeatureKey = 'mesas' | 'regalos' | 'album' | 'playlist' | 'comida' | 'vestimenta' | 'invitacion'

export type EnabledFeatures = Partial<Record<FeatureKey, boolean>>

export type AccessMode = 'privada' | 'publica'

export interface AccessModeConfig {
  key: AccessMode
  label: string
  description: string
  icon: React.ElementType
}

export const ACCESS_MODES: AccessModeConfig[] = [
  { key: 'privada', label: 'Invitación directa', description: 'Tú armas la lista. Cada invitado recibe su propio link.', icon: Lock },
  { key: 'publica', label: 'Link público',       description: 'Compartes un link y la gente se registra sola.',        icon: Globe },
]

export interface FeatureConfig {
  key: FeatureKey
  label: string
  description: string
  icon: React.ElementType
  navPaths: string[]
}

export const FEATURES: FeatureConfig[] = [
  { key: 'mesas',    label: 'Mesas y check-in',      description: 'Asigna lugares y registra llegadas el día del evento',        icon: LayoutGrid,      navPaths: ['/mesas'] },
  { key: 'regalos',  label: 'Mesa de regalos',        description: 'Regalos, fondos y sobres con un link público para invitados', icon: Gift,            navPaths: ['/mesa-regalos'] },
  { key: 'album',    label: 'Álbum de fotos',         description: 'Tus invitados suben fotos escaneando un QR',                  icon: Images,          navPaths: ['/album'] },
  { key: 'playlist', label: 'Playlist',               description: 'Playlist colaborativa con sugerencias de los invitados',      icon: Music2,          navPaths: ['/playlist'] },
  { key: 'comida',   label: 'Planificador de comida', description: 'Planea menú y compras por persona y por día',                 icon: UtensilsCrossed, navPaths: ['/comida'] },
  { key: 'vestimenta', label: 'Dress code',           description: 'Comparte qué ponerse: nivel, colores y recomendaciones',      icon: Shirt,           navPaths: ['/vestimenta'] },
  { key: 'invitacion', label: 'Invitación',           description: 'Invitación digital por invitado con confirmación de asistencia', icon: MailOpen,      navPaths: ['/invitacion'] },
]

export const ALWAYS_ON_FEATURES = ['Invitados', 'Mensajes', 'Timeline', 'Finanzas'] as const

// Eventos existentes (columna null): exactamente el nav actual — comida oculta
export const LEGACY_FEATURES: Record<FeatureKey, boolean> = {
  mesas: true, regalos: true, album: true, playlist: true, comida: false, vestimenta: true, invitacion: true,
}

export function getDefaultFeatures(eventTypeValue: string | null): Record<FeatureKey, boolean> {
  const config =
    EVENT_TYPES.find(t => t.value === eventTypeValue) ??
    EVENT_TYPES.find(t => t.value === 'otro')!
  const defaults = config.defaultFeatures ?? []
  return {
    mesas:    defaults.includes('mesas'),
    regalos:  defaults.includes('regalos'),
    album:    defaults.includes('album'),
    playlist: defaults.includes('playlist'),
    comida:   defaults.includes('comida'),
    vestimenta: defaults.includes('vestimenta'),
    invitacion: defaults.includes('invitacion'),
  }
}

export function resolveFeatures(
  eventTypeValue: string | null,
  enabled: EnabledFeatures | null | undefined,
): Record<FeatureKey, boolean> {
  if (enabled == null) return { ...LEGACY_FEATURES }
  const defaults = getDefaultFeatures(eventTypeValue)
  return {
    mesas:    enabled.mesas    ?? defaults.mesas,
    regalos:  enabled.regalos  ?? defaults.regalos,
    album:    enabled.album    ?? defaults.album,
    playlist: enabled.playlist ?? defaults.playlist,
    comida:   enabled.comida   ?? defaults.comida,
    vestimenta: enabled.vestimenta ?? defaults.vestimenta,
    invitacion: enabled.invitacion ?? defaults.invitacion,
  }
}

export function getDefaultAccessMode(eventTypeValue: string | null): AccessMode {
  return EVENT_TYPES.find(t => t.value === eventTypeValue)?.defaultAccessMode ?? 'publica'
}

export function getDefaultRequiresApproval(eventTypeValue: string | null): boolean {
  return EVENT_TYPES.find(t => t.value === eventTypeValue)?.defaultRequiresApproval ?? true
}

// Lectura tolerante: 'abierta' y 'aprobacion' son el modelo viejo de 3 valores.
// La base tenia 0 filas con valor al migrar (verificado 14-jul), pero leerlos
// cuesta una linea y evita que un dato viejo se lea como basura.
export function resolveAccessMode(
  eventTypeValue: string | null,
  stored: string | null | undefined,
): AccessMode {
  if (stored === 'privada' || stored === 'publica') return stored
  if (stored === 'abierta' || stored === 'aprobacion') return 'publica'
  return getDefaultAccessMode(eventTypeValue)
}

export function resolveRequiresApproval(
  eventTypeValue: string | null,
  storedMode: string | null | undefined,
  storedFlag: boolean | null | undefined,
): boolean {
  if (resolveAccessMode(eventTypeValue, storedMode) === 'privada') return false
  if (storedMode === 'aprobacion') return true
  if (storedMode === 'abierta') return false
  if (typeof storedFlag === 'boolean') return storedFlag
  return getDefaultRequiresApproval(eventTypeValue)
}

// events.guest_cap es int4 y el min del input no valida (el boton es onClick, no submit):
// sin esta cota, un cupo tecleado de mas digitos tumba el insert con un error crudo de Postgres.
const MAX_GUEST_CAP = 1_000_000

function parseCap(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n <= 0 || n > MAX_GUEST_CAP) return null
  return n
}

function parsePrice(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function normalizeAccessFields(input: {
  accessMode: AccessMode
  guestCap: string
  ticketPrice: string
  requiresApproval: boolean
}): { guest_cap: number | null; ticket_price: number | null; requires_approval: boolean } {
  if (input.accessMode === 'privada') {
    return { guest_cap: null, ticket_price: null, requires_approval: false }
  }
  return {
    guest_cap: parseCap(input.guestCap),
    ticket_price: parsePrice(input.ticketPrice),
    requires_approval: input.requiresApproval,
  }
}
