import type { SupabaseClient } from '@supabase/supabase-js'
import { DEBOUNCE_MS, OPT_OUT_KEYWORDS } from './config'
import { twilioTransport } from './transport'

// ── Idempotencia (Twilio reintenta el webhook) ──────────────────────────────
export async function isDuplicate(supabase: SupabaseClient, twilioSid: string | null): Promise<boolean> {
  if (!twilioSid) return false
  const { data } = await supabase
    .from('wa_messages')
    .select('id')
    .eq('twilio_sid', twilioSid)
    .limit(1)
  return !!(data && data.length > 0)
}

// ── Ventana de 24h (derivada del ultimo entrante) ───────────────────────────
export async function isWithinSession(supabase: SupabaseClient, guestId: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_messages')
    .select('created_at')
    .eq('guest_id', guestId)
    .eq('direction', 'received')
    .order('created_at', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return false
  const last = new Date(data[0].created_at).getTime()
  return Date.now() - last < 24 * 60 * 60 * 1000
}

// ── Opt-out ─────────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function detectOptOut(text: string): boolean {
  const t = normalize(text)
  return OPT_OUT_KEYWORDS.some(k => {
    const nk = normalize(k)
    return t === nk || t.startsWith(nk + ' ') || t === nk + '.'
  })
}

export async function applyOptOut(supabase: SupabaseClient, guestId: string): Promise<void> {
  await supabase
    .from('guests')
    .update({ wa_opt_out: true, wa_opt_out_at: new Date().toISOString() })
    .eq('id', guestId)
}

// ── Debounce "esperar-y-verificar" ──────────────────────────────────────────
// Espera DEBOUNCE_MS y devuelve true si este entrante sigue siendo el mas nuevo
// para el invitado (=> soy quien debe responder). Si llego uno mas nuevo, false.
export async function claimInboundForReply(
  supabase: SupabaseClient,
  guestId: string,
  inboundCreatedAt: string,
): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS))
  const { data } = await supabase
    .from('wa_messages')
    .select('created_at')
    .eq('guest_id', guestId)
    .eq('direction', 'received')
    .order('created_at', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return false
  return new Date(data[0].created_at).getTime() <= new Date(inboundCreatedAt).getTime()
}

// ── Envio (guard opt-out). Transporte detras de transport.send (hoy Twilio).
// El numero emisor `from` llega por parametro (multi-tenant); si no se pasa,
// cae al env global TWILIO_WHATSAPP_FROM (comportamiento single-tenant previo).
export type OutboundPayload = {
  to: string          // formato whatsapp:+52...
  body: string
  guestId: string
  eventId: string
  author: 'ia' | 'human'
  from?: string       // linea emisora; default = TWILIO_WHATSAPP_FROM
}

export async function enqueueOutbound(supabase: SupabaseClient, p: OutboundPayload): Promise<{ ok: boolean; status: string }> {
  const { data: guest } = await supabase
    .from('guests')
    .select('wa_opt_out')
    .eq('id', p.guestId)
    .maybeSingle()
  if (guest?.wa_opt_out) {
    console.log('[WA] envio bloqueado: invitado con opt-out', p.guestId)
    return { ok: false, status: 'blocked_opt_out' }
  }

  const from = p.from ?? process.env.TWILIO_WHATSAPP_FROM!
  const { status, sid } = await twilioTransport.send({ to: p.to, body: p.body, from })

  await supabase.from('wa_messages').insert({
    guest_id: p.guestId,
    event_id: p.eventId,
    direction: 'sent',
    content: p.body,
    author: p.author,
    status,
    twilio_sid: sid,
    created_at: new Date().toISOString(),
  })
  return { ok: status === 'sent', status }
}
