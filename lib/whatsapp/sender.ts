import type { SupabaseClient } from '@supabase/supabase-js'

// Contexto del numero emisor del planner. Hoy solo `from`; en Fase 3, cuando
// exista un subaccount real, esto crece (accountSid/subaccount + auth-ref) y
// transport.ts lo consume. No ensanchar especulativamente antes de eso.
export type SenderContext = {
  from: string // formato whatsapp:+52...
}

// Resuelve la linea emisora del planner dueno del evento.
// Falla en SILENCIO: cualquier error de query -> null, nunca throw. El fallback
// al env global en enqueueOutbound es la red de seguridad; un hipo de DB no debe
// bloquear un envio. Devuelve null tambien si el planner no tiene linea conectada.
export async function getSenderForEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SenderContext | null> {
  try {
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('user_id')
      .eq('id', eventId)
      .maybeSingle()
    if (eventErr || !event?.user_id) return null

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('wa_sender_phone, wa_sender_status')
      .eq('id', event.user_id)
      .maybeSingle()
    if (userErr || !user) return null
    if (user.wa_sender_status !== 'connected' || !user.wa_sender_phone) return null

    const phone = user.wa_sender_phone as string
    const from = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
    return { from }
  } catch {
    return null
  }
}
