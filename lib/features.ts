import type React from 'react'
import { LayoutGrid, Gift, Images, Music2, UtensilsCrossed, Shirt } from 'lucide-react'
import { EVENT_TYPES } from './event-types'

export type FeatureKey = 'mesas' | 'regalos' | 'album' | 'playlist' | 'comida' | 'vestimenta'

export type EnabledFeatures = Partial<Record<FeatureKey, boolean>>

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
]

export const ALWAYS_ON_FEATURES = ['Invitados', 'Mensajes', 'Timeline', 'Finanzas'] as const

// Eventos existentes (columna null): exactamente el nav actual — comida oculta
export const LEGACY_FEATURES: Record<FeatureKey, boolean> = {
  mesas: true, regalos: true, album: true, playlist: true, comida: false, vestimenta: true,
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
  }
}
