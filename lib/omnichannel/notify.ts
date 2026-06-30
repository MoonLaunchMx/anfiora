import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUsers, resolveEventRecipients } from '@/lib/push'

// Disparador de notificaciones del nucleo omnicanal. Agnostico de canal: cuenta
// quien respondio leyendo el modelo canonico (conversations), no la tabla de un
// canal concreto. Cualquier adaptador (WhatsApp, Telegram, IG/FB...) que aterrice
// un inbound en conversations queda cubierto por esta unica pieza. Fallo
// SILENCIOSO: nunca lanza, nunca rompe el webhook que lo invoca.

const WINDOW_MS = 2 * 60 * 60 * 1000

function statusLabel(intent: string): string {
  if (intent === 'confirmed') return 'confirmó asistencia'
  if (intent === 'declined') return 'no podrá asistir'
  return 'respondió'
}

export async function notifyInboundRsvp(
  supabase: SupabaseClient,
  a: { eventId: string; guestId: string; guestName: string; eventName: string; intent: string },
): Promise<void> {
  try {
    const recipients = await resolveEventRecipients(a.eventId)
    if (recipients.length === 0) return

    if (a.intent === 'accion_necesaria') {
      await sendPushToUsers(recipients, {
        title: a.eventName,
        body: `${a.guestName} necesita tu atención.`,
        url: `/events/${a.eventId}/mensajes`,
        tag: `event-${a.eventId}-accion-${a.guestId}`,
        renotify: true,
      })
      return
    }

    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const { data: recent } = await supabase
      .from('conversations')
      .select('contact_guest_id')
      .eq('tenant_id', a.eventId)
      .gte('last_inbound_at', since)

    const distinctGuests = new Set(
      (recent ?? []).map((r) => r.contact_guest_id).filter(Boolean),
    )
    distinctGuests.add(a.guestId)
    const count = distinctGuests.size

    const body =
      count > 1
        ? `${a.guestName} y ${count - 1} más respondieron.`
        : `${a.guestName} ${statusLabel(a.intent)}.`

    await sendPushToUsers(recipients, {
      title: a.eventName,
      body,
      url: `/events/${a.eventId}/mensajes`,
      tag: `event-${a.eventId}`,
      renotify: true,
    })
  } catch (e) {
    console.error('[notify] notifyInboundRsvp fallo:', e instanceof Error ? e.message : e)
  }
}
