import { parseTimeToMinutes, formatMinutesToHHMM, addDays } from './itinerary'
import { EVENT_TYPES } from './event-types'
import type { ItineraryPhase } from './types'

export type DayTypeKey =
  | 'montaje' | 'ensayo' | 'bienvenida' | 'principal'
  | 'sesiones' | 'noche' | 'siguiente' | 'despedida'

export interface TemplateStep {
  offsetMin: number
  title: string
  durationMin: number | null
  phase: ItineraryPhase
  visible: boolean
}

export interface DayTemplate {
  key: DayTypeKey
  anchorLabel: string
  defaultAnchorTime: string
  steps: TemplateStep[]
}

export interface TemplateMoment {
  moment_date: string
  start_time: string
  title: string
  duration_min: number | null
  phase: ItineraryPhase
  visible_to_guests: boolean
}

const BASE_TEMPLATES: Record<DayTypeKey, DayTemplate> = {
  montaje: {
    key: 'montaje', anchorLabel: 'Inicio del montaje', defaultAnchorTime: '09:00',
    steps: [
      { offsetMin: 0,   title: 'Montaje del venue',  durationMin: 180, phase: 'montaje', visible: false },
      { offsetMin: 180, title: 'Prueba de audio',    durationMin: 60,  phase: 'montaje', visible: false },
      { offsetMin: 240, title: 'Llegada de flores',  durationMin: 60,  phase: 'montaje', visible: false },
      { offsetMin: 360, title: 'Revision final',     durationMin: 60,  phase: 'montaje', visible: false },
    ],
  },
  ensayo: {
    key: 'ensayo', anchorLabel: 'Ensayo', defaultAnchorTime: '17:00',
    steps: [
      { offsetMin: 0,   title: 'Ensayo de la ceremonia', durationMin: 60,  phase: 'ceremonia', visible: false },
      { offsetMin: 120, title: 'Cena de ensayo',         durationMin: 120, phase: 'cena',      visible: true },
    ],
  },
  bienvenida: {
    key: 'bienvenida', anchorLabel: 'Recepcion', defaultAnchorTime: '19:00',
    steps: [
      { offsetMin: -180, title: 'Montaje',              durationMin: 120, phase: 'montaje', visible: false },
      { offsetMin: -60,  title: 'Llegada de foraneos',  durationMin: 60,  phase: 'social',  visible: true },
      { offsetMin: 0,    title: 'Recepcion',            durationMin: 90,  phase: 'social',  visible: true },
      { offsetMin: 120,  title: 'Cena informal',        durationMin: 120, phase: 'cena',    visible: true },
      { offsetMin: 300,  title: 'Cierre',               durationMin: null, phase: 'otro',   visible: false },
    ],
  },
  principal: {
    key: 'principal', anchorLabel: 'Inicio', defaultAnchorTime: '18:00',
    steps: [
      { offsetMin: -240, title: 'Montaje',    durationMin: 180,  phase: 'montaje', visible: false },
      { offsetMin: 0,    title: 'Recepcion',  durationMin: 60,   phase: 'social',  visible: true },
      { offsetMin: 60,   title: 'Cena',       durationMin: 90,   phase: 'cena',    visible: true },
      { offsetMin: 150,  title: 'Brindis',    durationMin: 15,   phase: 'social',  visible: true },
      { offsetMin: 180,  title: 'Fiesta',     durationMin: null, phase: 'fiesta',  visible: true },
      { offsetMin: 420,  title: 'Cierre',     durationMin: null, phase: 'otro',    visible: false },
    ],
  },
  sesiones: {
    key: 'sesiones', anchorLabel: 'Apertura', defaultAnchorTime: '09:00',
    steps: [
      { offsetMin: -90, title: 'Montaje y pruebas',     durationMin: 60,  phase: 'montaje', visible: false },
      { offsetMin: -30, title: 'Registro',              durationMin: 30,  phase: 'social',  visible: true },
      { offsetMin: 0,   title: 'Apertura',              durationMin: 30,  phase: 'otro',    visible: true },
      { offsetMin: 30,  title: 'Sesion de la manana',   durationMin: 90,  phase: 'otro',    visible: true },
      { offsetMin: 120, title: 'Coffee break',          durationMin: 30,  phase: 'social',  visible: true },
      { offsetMin: 150, title: 'Panel',                 durationMin: 90,  phase: 'otro',    visible: true },
      { offsetMin: 240, title: 'Comida',                durationMin: 90,  phase: 'cena',    visible: true },
      { offsetMin: 330, title: 'Talleres',              durationMin: 120, phase: 'otro',    visible: true },
      { offsetMin: 450, title: 'Cierre del dia',        durationMin: 30,  phase: 'otro',    visible: true },
    ],
  },
  noche: {
    key: 'noche', anchorLabel: 'Inicio de la noche', defaultAnchorTime: '20:00',
    steps: [
      { offsetMin: -90, title: 'Montaje',        durationMin: 60,   phase: 'montaje', visible: false },
      { offsetMin: 0,   title: 'Coctel',         durationMin: 60,   phase: 'social',  visible: true },
      { offsetMin: 60,  title: 'Cena',           durationMin: 90,   phase: 'cena',    visible: true },
      { offsetMin: 150, title: 'Musica en vivo', durationMin: null, phase: 'fiesta',  visible: true },
      { offsetMin: 360, title: 'Cierre',         durationMin: null, phase: 'otro',    visible: false },
    ],
  },
  siguiente: {
    key: 'siguiente', anchorLabel: 'Inicio', defaultAnchorTime: '12:00',
    steps: [
      { offsetMin: -60, title: 'Montaje',    durationMin: 60,   phase: 'montaje', visible: false },
      { offsetMin: 0,   title: 'Brunch',     durationMin: 120,  phase: 'cena',    visible: true },
      { offsetMin: 120, title: 'Alberca',    durationMin: 180,  phase: 'social',  visible: true },
      { offsetMin: 300, title: 'Cierre',     durationMin: null, phase: 'otro',    visible: false },
    ],
  },
  despedida: {
    key: 'despedida', anchorLabel: 'Check-out', defaultAnchorTime: '11:00',
    steps: [
      { offsetMin: 0,   title: 'Check-out',       durationMin: 120, phase: 'otro', visible: true },
      { offsetMin: 120, title: 'Ultima comida',   durationMin: 90,  phase: 'cena', visible: true },
      { offsetMin: 300, title: 'Traslados',       durationMin: null, phase: 'otro', visible: true },
    ],
  },
}

const BODA_PRINCIPAL: DayTemplate = {
  key: 'principal', anchorLabel: 'Ceremonia', defaultAnchorTime: '17:30',
  steps: [
    { offsetMin: -480, title: 'Montaje del venue',   durationMin: 240,  phase: 'montaje',   visible: false },
    { offsetMin: -30,  title: 'Llegada de invitados', durationMin: 30,  phase: 'social',    visible: true },
    { offsetMin: 0,    title: 'Ceremonia',            durationMin: 45,  phase: 'ceremonia', visible: true },
    { offsetMin: 45,   title: 'Sesion de fotos',      durationMin: 30,  phase: 'otro',      visible: false },
    { offsetMin: 60,   title: 'Coctel',               durationMin: 120, phase: 'social',    visible: true },
    { offsetMin: 180,  title: 'Cena',                 durationMin: 75,  phase: 'cena',      visible: true },
    { offsetMin: 255,  title: 'Primer baile',         durationMin: 15,  phase: 'fiesta',    visible: true },
    { offsetMin: 270,  title: 'Vals',                 durationMin: 20,  phase: 'fiesta',    visible: true },
    { offsetMin: 300,  title: 'Abre la pista',        durationMin: null, phase: 'fiesta',   visible: true },
    { offsetMin: 450,  title: 'Tornafiesta',          durationMin: null, phase: 'fiesta',   visible: true },
    { offsetMin: 570,  title: 'Cierre',               durationMin: null, phase: 'otro',     visible: false },
  ],
}

const BODA_ROMPEHIELOS: DayTemplate = {
  key: 'bienvenida', anchorLabel: 'Rompehielos', defaultAnchorTime: '20:00',
  steps: [
    { offsetMin: -180, title: 'Montaje',             durationMin: 120,  phase: 'montaje', visible: false },
    { offsetMin: -60,  title: 'Llegada de foraneos', durationMin: 60,   phase: 'social',  visible: true },
    { offsetMin: 0,    title: 'Rompehielos',         durationMin: 90,   phase: 'social',  visible: true },
    { offsetMin: 90,   title: 'Cena informal',       durationMin: 120,  phase: 'cena',    visible: true },
    { offsetMin: 300,  title: 'Cierre',              durationMin: null, phase: 'otro',    visible: false },
  ],
}

const BODA_TORNABODA: DayTemplate = {
  key: 'siguiente', anchorLabel: 'Tornaboda', defaultAnchorTime: '12:00',
  steps: [
    { offsetMin: -60, title: 'Montaje',   durationMin: 60,   phase: 'montaje', visible: false },
    { offsetMin: 0,   title: 'Tornaboda', durationMin: 180,  phase: 'social',  visible: true },
    { offsetMin: 60,  title: 'Comida',    durationMin: 90,   phase: 'cena',    visible: true },
    { offsetMin: 240, title: 'Cierre',    durationMin: null, phase: 'otro',    visible: false },
  ],
}

// Programa de inmersion (retiro/campamento): dia completo con fogata. Va como
// plantilla propia de esos dos eventos y no de la categoria impacto entera,
// porque un congreso de impacto sigue siendo un evento de sala con coffee break.
const INMERSION_SESIONES: DayTemplate = {
  key: 'sesiones', anchorLabel: 'Inicio del programa', defaultAnchorTime: '08:00',
  steps: [
    { offsetMin: -60, title: 'Montaje',              durationMin: 60,   phase: 'montaje', visible: false },
    { offsetMin: 0,   title: 'Desayuno',             durationMin: 60,   phase: 'cena',    visible: true },
    { offsetMin: 60,  title: 'Sesion de la manana',  durationMin: 120,  phase: 'otro',    visible: true },
    { offsetMin: 180, title: 'Descanso',             durationMin: 30,   phase: 'social',  visible: true },
    { offsetMin: 210, title: 'Dinamica grupal',      durationMin: 90,   phase: 'otro',    visible: true },
    { offsetMin: 330, title: 'Comida',               durationMin: 90,   phase: 'cena',    visible: true },
    { offsetMin: 420, title: 'Tiempo libre',         durationMin: 120,  phase: 'social',  visible: true },
    { offsetMin: 540, title: 'Sesion de la tarde',   durationMin: 90,   phase: 'otro',    visible: true },
    { offsetMin: 690, title: 'Cena',                 durationMin: 90,   phase: 'cena',    visible: true },
    { offsetMin: 810, title: 'Fogata',               durationMin: null, phase: 'fiesta',  visible: true },
  ],
}

const EVENT_TEMPLATES: Record<string, Partial<Record<DayTypeKey, DayTemplate>>> = {
  boda:       { principal: BODA_PRINCIPAL, bienvenida: BODA_ROMPEHIELOS, siguiente: BODA_TORNABODA },
  retiro:     { sesiones: INMERSION_SESIONES },
  campamento: { sesiones: INMERSION_SESIONES },
}

const CATEGORY_TEMPLATES: Record<string, Partial<Record<DayTypeKey, DayTemplate>>> = {
  social:      {},
  corporativo: {},
  impacto:     {},
}

function categoryOf(eventType: string): string {
  return EVENT_TYPES.find(t => t.value === eventType)?.category ?? 'social'
}

export function templateFor(eventType: string, key: DayTypeKey): DayTemplate {
  return EVENT_TEMPLATES[eventType]?.[key]
    ?? CATEGORY_TEMPLATES[categoryOf(eventType)]?.[key]
    ?? BASE_TEMPLATES[key]
}

type DayTypeEntry = { key: DayTypeKey; label: string }

const D = (key: DayTypeKey, label: string): DayTypeEntry => ({ key, label })

export const DAY_TYPES_BY_EVENT: Record<string, DayTypeEntry[]> = {
  boda:         [D('montaje','Montaje'), D('ensayo','Ensayo'), D('bienvenida','Rompehielos'), D('principal','Día principal'), D('siguiente','Tornaboda'), D('despedida','Despedida')],
  xv:           [D('montaje','Montaje'), D('ensayo','Ensayo'), D('principal','Día principal'), D('siguiente','Tornafiesta')],
  cumpleanos:   [D('montaje','Montaje'), D('principal','Día principal'), D('siguiente','Tornafiesta')],
  graduacion:   [D('montaje','Montaje'), D('principal','Día principal'), D('noche','Fiesta')],
  bautizo:      [D('montaje','Montaje'), D('principal','Día principal')],
  fiesta:       [D('montaje','Montaje'), D('principal','Día principal'), D('siguiente','Tornafiesta')],
  despedida:    [D('bienvenida','Bienvenida'), D('principal','Día principal'), D('noche','Noche'), D('despedida','Despedida')],
  conferencia:  [D('montaje','Montaje'), D('sesiones','Sesiones'), D('noche','Cena de gala'), D('despedida','Cierre')],
  capacitacion: [D('montaje','Montaje'), D('sesiones','Sesiones'), D('despedida','Cierre')],
  teambuilding: [D('bienvenida','Llegada'), D('sesiones','Actividades'), D('noche','Noche'), D('despedida','Salida')],
  lanzamiento:  [D('montaje','Montaje'), D('ensayo','Ensayo'), D('principal','Día del lanzamiento')],
  asamblea:     [D('montaje','Montaje'), D('sesiones','Sesiones')],
  retiro:       [D('bienvenida','Bienvenida'), D('sesiones','Programa'), D('noche','Noche'), D('despedida','Salida')],
  congreso:     [D('montaje','Montaje'), D('sesiones','Sesiones'), D('noche','Cena'), D('despedida','Cierre')],
  campamento:   [D('bienvenida','Llegada'), D('sesiones','Actividades'), D('noche','Fogata'), D('despedida','Salida')],
  caridad:      [D('montaje','Montaje'), D('principal','Día del evento')],
  otro:         [D('montaje','Montaje'), D('principal','Día principal'), D('despedida','Despedida')],
}

const FALLBACK_DAY_TYPES: DayTypeEntry[] = DAY_TYPES_BY_EVENT.otro

export function dayTypesFor(eventType: string | null): DayTypeEntry[] {
  if (!eventType) return FALLBACK_DAY_TYPES
  return DAY_TYPES_BY_EVENT[eventType] ?? FALLBACK_DAY_TYPES
}

export function expandTemplate(tpl: DayTemplate, anchorTime: string, dayDate: string): TemplateMoment[] {
  const anchor = parseTimeToMinutes(anchorTime)
  if (anchor === null) return []
  return tpl.steps.map(s => {
    const abs = anchor + s.offsetMin
    const shift = Math.floor(abs / 1440)
    return {
      moment_date: shift === 0 ? dayDate : addDays(dayDate, shift),
      start_time: formatMinutesToHHMM(abs),
      title: s.title,
      duration_min: s.durationMin,
      phase: s.phase,
      visible_to_guests: s.visible,
    }
  })
}
