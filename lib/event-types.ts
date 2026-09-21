import type React from 'react'
import {
  Gem, Crown, Cake, GraduationCap, Sun, PartyPopper, Wine,
  Presentation, Monitor, UsersRound, Rocket, Building2,
  Tent, Mic, Flame, HeartHandshake, CalendarDays,
} from 'lucide-react'
import type { FeatureKey, AccessMode } from './features'

export type EventCategory = 'social' | 'corporativo' | 'impacto'

export interface EventTypeConfig {
  value: string
  label: string
  category: EventCategory
  icon: React.ElementType
  hostLabel?: string
  host2Label?: string
  showOrg?: boolean
  showVenue?: boolean
  defaultFeatures?: FeatureKey[]
  defaultAccessMode: AccessMode
  defaultRequiresApproval: boolean
  defaultMaxCompanions: number
}

// defaultMaxCompanions: cuantos acompanantes puede traer quien se registra por
// la puerta publica. En los tipos publicos 'invitacion' es obligatoria: la
// puerta ES la invitacion en modo compartido, sin ella no hay puerta que abrir.
export const EVENT_TYPES: EventTypeConfig[] = [
  { value: 'boda',         label: 'Boda',          category: 'social',      icon: Gem,            hostLabel: 'Novia',                 host2Label: 'Novio',  showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'xv',           label: 'XV años',        category: 'social',      icon: Crown,          hostLabel: 'Festejada',             showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'cumpleanos',   label: 'Cumpleaños',     category: 'social',      icon: Cake,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'graduacion',   label: 'Graduación',     category: 'social',      icon: GraduationCap,  hostLabel: 'Graduado/a',            showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'bautizo',      label: 'Bautizo',        category: 'social',      icon: Sun,            hostLabel: 'Nombre del bautizado/a', showVenue: true, defaultFeatures: ['mesas', 'regalos', 'album', 'vestimenta', 'invitacion'], defaultAccessMode: 'privada', defaultRequiresApproval: false, defaultMaxCompanions: 1 },
  { value: 'fiesta',       label: 'Fiesta',         category: 'social',      icon: PartyPopper,    hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 2 },
  { value: 'despedida',    label: 'Despedida',      category: 'social',      icon: Wine,           hostLabel: 'Festejado/a',           showVenue: true, defaultFeatures: ['regalos', 'album', 'playlist', 'vestimenta', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 1 },
  { value: 'conferencia',  label: 'Conferencia',    category: 'corporativo', icon: Presentation,   hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 0 },
  { value: 'capacitacion', label: 'Capacitación',   category: 'corporativo', icon: Monitor,        hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'teambuilding', label: 'Team Building',  category: 'corporativo', icon: UsersRound,     hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['album', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'lanzamiento',  label: 'Lanzamiento',    category: 'corporativo', icon: Rocket,         hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 1 },
  { value: 'asamblea',     label: 'Asamblea',       category: 'corporativo', icon: Building2,      hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'retiro',       label: 'Retiro',         category: 'impacto',     icon: Tent,           hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'congreso',     label: 'Congreso',       category: 'impacto',     icon: Mic,            hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 0 },
  { value: 'campamento',   label: 'Campamento',     category: 'impacto',     icon: Flame,          hostLabel: 'Organizador principal',  defaultFeatures: ['album', 'playlist', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 0 },
  { value: 'caridad',      label: 'Caridad',        category: 'impacto',     icon: HeartHandshake, hostLabel: 'Organizador principal',  showOrg: true, defaultFeatures: ['mesas', 'album', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: false, defaultMaxCompanions: 2 },
  { value: 'otro',         label: 'Otro',           category: 'social',      icon: CalendarDays,   hostLabel: 'Anfitrión/a',           showVenue: true, defaultFeatures: ['mesas', 'album', 'playlist', 'invitacion'], defaultAccessMode: 'publica', defaultRequiresApproval: true, defaultMaxCompanions: 1 },
]

export const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'social',      label: 'Social' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'impacto',     label: 'Impacto' },
]
