import { supabase } from '@/lib/supabase'
import { curateForGuests, eventDays } from '@/lib/itinerary'
import type { ItineraryMoment, GuestItineraryDay } from '@/lib/types'

// Contrato de solo lectura para la invitacion RSVP.
// Devuelve los dias visibles, curados y ordenados.
// La invitacion NO accede a columnas internas (phase, notes, duration_min, etc).
export async function getGuestItinerary(
  eventId: string,
  eventDate: string | null,
  eventEndDate: string | null,
): Promise<GuestItineraryDay[]> {
  const { data } = await supabase
    .from('event_itinerary_moments')
    .select('moment_date, start_time, title, location, visible_to_guests, position')
    .eq('event_id', eventId)
    .eq('visible_to_guests', true)
  return curateForGuests((data || []) as ItineraryMoment[], eventDays(eventDate, eventEndDate))
}
