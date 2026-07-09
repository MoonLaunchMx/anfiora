import type { ItineraryPhase } from './types'
import { parseTimeToMinutes, formatMinutesToHHMM, ITINERARY_PHASES } from './itinerary'

export interface GenerateItineraryInput {
  eventType: string | null
  eventCategory: string | null
  ceremonyTime?: string | null
  dinnerTime?: string | null
  endTime?: string | null
  venue?: string | null
}

export interface GeneratedMoment {
  title: string
  start_time: string
  duration_min: number | null
  phase: ItineraryPhase
  location: string | null
  notes: string | null
  visible_to_guests: boolean
}

export const ITINERARY_SYSTEM_PROMPT = `Eres un coordinador de eventos experto. Diseñas el "run-of-show" (itinerario hora por hora) del DIA del evento.

Devuelve UNICAMENTE un arreglo JSON valido, sin markdown, sin backticks, sin texto antes o despues. Cada elemento es un momento:
{"title": string, "start_time": "HH:MM", "duration_min": number|null, "phase": string, "location": string|null, "notes": string|null, "visible_to_guests": boolean}

REGLAS:
- "phase" debe ser una de: montaje, ceremonia, social, cena, fiesta, otro.
- "start_time" en formato 24h "HH:MM". Los momentos van encadenados en orden cronologico coherente, sin traslapes salvo que sea intencional.
- "duration_min" en minutos. Usa null solo para el ultimo momento sin fin fijo (ej. "apertura de pista hasta cierre").
- "visible_to_guests": los momentos de montaje/logistica interna van en false; ceremonia, social, cena y fiesta que el invitado deba conocer van en true.
- Cura la lista: entre 6 y 12 momentos. Titulos cortos y claros en español.
- No inventes datos del venue si no se dan; deja "location" en null cuando no aplique.`

export function buildItineraryPrompt(input: GenerateItineraryInput): string {
  const anchors = [
    input.ceremonyTime ? `Hora de ceremonia: ${input.ceremonyTime}` : null,
    input.dinnerTime ? `Hora de cena/comida: ${input.dinnerTime}` : null,
    input.endTime ? `Hora de cierre: ${input.endTime}` : null,
    input.venue ? `Venue: ${input.venue}` : null,
  ].filter(Boolean).join('\n')

  return [
    `Tipo de evento: ${input.eventType || 'evento social'}`,
    input.eventCategory ? `Categoria: ${input.eventCategory}` : null,
    anchors ? `\nHoras ancla que da el organizador:\n${anchors}` : '\n(El organizador no dio horas ancla; usa horarios tipicos sensatos para el tipo de evento.)',
    `\nGenera el itinerario del dia como arreglo JSON:`,
  ].filter(Boolean).join('\n')
}

export function parseItineraryResponse(raw: string): GeneratedMoment[] {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let data: unknown
  try {
    data = JSON.parse(clean)
  } catch {
    throw new Error('La respuesta del modelo no es JSON valido')
  }

  const arr = Array.isArray(data)
    ? data
    : (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).moments))
      ? (data as Record<string, unknown>).moments as unknown[]
      : null

  if (!arr) throw new Error('La respuesta no contiene un arreglo de momentos')

  const out: GeneratedMoment[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>

    const title = typeof o.title === 'string' ? o.title.trim() : ''
    if (!title) continue

    const mins = parseTimeToMinutes(typeof o.start_time === 'string' ? o.start_time.trim() : '')
    if (mins === null) continue

    const phase: ItineraryPhase = ITINERARY_PHASES.includes(o.phase as ItineraryPhase)
      ? (o.phase as ItineraryPhase)
      : 'otro'

    const duration_min = typeof o.duration_min === 'number' && o.duration_min > 0
      ? Math.round(o.duration_min)
      : null

    const location = typeof o.location === 'string' && o.location.trim() ? o.location.trim() : null
    const notes = typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim() : null
    const visible_to_guests = typeof o.visible_to_guests === 'boolean'
      ? o.visible_to_guests
      : phase !== 'montaje'

    out.push({ title, start_time: formatMinutesToHHMM(mins), duration_min, phase, location, notes, visible_to_guests })
  }
  return out
}
