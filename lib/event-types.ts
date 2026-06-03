import type React from 'react'
import {
  Gem, Crown, Cake, GraduationCap, Sun, PartyPopper, Wine,
  Presentation, Monitor, UsersRound, Rocket, Building2,
  Tent, Mic, Flame, HeartHandshake, CalendarDays,
} from 'lucide-react'

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
}

export const EVENT_TYPES: EventTypeConfig[] = [
  { value: 'boda',         label: 'Boda',          category: 'social',      icon: Gem,            hostLabel: 'Novia',                 host2Label: 'Novio',  showVenue: true },
  { value: 'xv',           label: 'XV años',        category: 'social',      icon: Crown,          hostLabel: 'Festejada',             showVenue: true },
  { value: 'cumpleanos',   label: 'Cumpleaños',     category: 'social',      icon: Cake,           hostLabel: 'Festejado/a',           showVenue: true },
  { value: 'graduacion',   label: 'Graduación',     category: 'social',      icon: GraduationCap,  hostLabel: 'Graduado/a',            showVenue: true },
  { value: 'bautizo',      label: 'Bautizo',        category: 'social',      icon: Sun,            hostLabel: 'Nombre del bautizado/a', showVenue: true },
  { value: 'fiesta',       label: 'Fiesta',         category: 'social',      icon: PartyPopper,    hostLabel: 'Anfitrión/a',           showVenue: true },
  { value: 'despedida',    label: 'Despedida',      category: 'social',      icon: Wine,           hostLabel: 'Festejado/a',           showVenue: true },
  { value: 'conferencia',  label: 'Conferencia',    category: 'corporativo', icon: Presentation,   hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'capacitacion', label: 'Capacitación',   category: 'corporativo', icon: Monitor,        hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'teambuilding', label: 'Team Building',  category: 'corporativo', icon: UsersRound,     hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'lanzamiento',  label: 'Lanzamiento',    category: 'corporativo', icon: Rocket,         hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'asamblea',     label: 'Asamblea',       category: 'corporativo', icon: Building2,      hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'retiro',       label: 'Retiro',         category: 'impacto',     icon: Tent,           hostLabel: 'Organizador principal' },
  { value: 'congreso',     label: 'Congreso',       category: 'impacto',     icon: Mic,            hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'campamento',   label: 'Campamento',     category: 'impacto',     icon: Flame,          hostLabel: 'Organizador principal' },
  { value: 'caridad',      label: 'Caridad',        category: 'impacto',     icon: HeartHandshake, hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'otro',         label: 'Otro',           category: 'social',      icon: CalendarDays,   hostLabel: 'Anfitrión/a',           showVenue: true },
]

export const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'social',      label: 'Social' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'impacto',     label: 'Impacto' },
]
