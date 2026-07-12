import { supabase } from '@/lib/supabase'
import { curateForGuests } from '@/lib/itinerary'
import type { ItineraryMoment, GuestItineraryItem } from '@/lib/types'

// Contrato de solo lectura para la invitacion RSVP.
// Devuelve los momentos visibles, curados y ordenados (con cruce de medianoche).
// La invitacion NO accede a columnas internas (phase, notes, duration_min, etc).
export async function getGuestItinerary(eventId: string): Promise<GuestItineraryItem[]> {
  const { data } = await supabase
    .from('event_itinerary_moments')
    .select('id, event_id, title, start_time, duration_min, location, phase, event_supplier_id, assigned_to_name, notes, visible_to_guests, position, created_at')
    .eq('event_id', eventId)
    .eq('visible_to_guests', true)
  return curateForGuests((data || []) as ItineraryMoment[])
}
