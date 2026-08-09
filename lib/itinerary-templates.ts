import { parseTimeToMinutes, formatMinutesToHHMM, addDays } from './itinerary'
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
