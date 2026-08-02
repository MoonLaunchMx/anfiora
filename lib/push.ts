import 'server-only'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import type { PushType } from '@/lib/types'
import { isTypeEnabled } from '@/lib/notifications/prefs'

const VAPID_SUBJECT = process.env.VAPID_SUBJECT
const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

let configured = false

function ensureConfigured(): boolean {
  if (configured) return true
  if (!VAPID_SUBJECT || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys ausentes - push deshabilitado')
    return false
  }
  const subject =
    VAPID_SUBJECT.startsWith('mailto:') || VAPID_SUBJECT.startsWith('http')
      ? VAPID_SUBJECT
      : `mailto:${VAPID_SUBJECT}`
  webpush.setVapidDetails(subject, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  renotify?: boolean
  ttl?: number
  topic?: string
}

const DEFAULT_TTL_SECONDS = 3 * 24 * 60 * 60

const URGENCY_BY_TYPE: Record<PushType, 'normal' | 'high'> = {
  guest_replies:  'normal',
  task_reminders: 'high',
  payment_due:    'high',
}

// RFC 8030 limita Topic a 32 caracteres del alfabeto base64url. Un valor
// invalido haria fallar el envio entero, asi que se descarta en vez de mandarse.
const TOPIC_RE = /^[A-Za-z0-9_-]{1,32}$/

async function deliver(
  userIds: string[],
  payload: PushPayload,
  urgency: 'normal' | 'high',
): Promise<void> {
  if (userIds.length === 0) return

  const supabase = admin()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (error) {
    console.error('[push] no se pudieron leer las suscripciones:', error.message)
    return
  }
  if (!subs || subs.length === 0) return

  const { ttl, topic, ...clientPayload } = payload
  const body = JSON.stringify(clientPayload)

  const options: { TTL: number; urgency: 'normal' | 'high'; topic?: string } = {
    TTL: ttl ?? DEFAULT_TTL_SECONDS,
    urgency,
  }
  if (topic) {
    if (TOPIC_RE.test(topic)) options.topic = topic
    else console.warn('[push] topic invalido, se omite:', topic)
  }

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          options
        )
      } catch (err: any) {
        const status = err?.statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[push] envio fallido', status, err?.message ?? err)
        }
      }
    })
  )
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  type: PushType,
): Promise<void> {
  if (!ensureConfigured()) return

  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return

  const { data: users, error } = await admin()
    .from('users')
    .select('id, settings')
    .in('id', ids)

  if (error) {
    console.error('[push] no se pudieron leer las preferencias:', error.message)
    return
  }

  const wanted = (users ?? []).filter((u) => isTypeEnabled(u.settings, type)).map((u) => u.id)
  await deliver(wanted, payload, URGENCY_BY_TYPE[type])
}

// Diagnostico: debe llegar aunque el usuario haya apagado tipos, o el boton de
// prueba mentiria justo cuando mas se necesita.
export async function sendTestPush(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return
  await deliver([userId], payload, 'high')
}

export async function resolveEventRecipients(eventId: string, actorUserId?: string): Promise<string[]> {
  const supabase = admin()
  const recipients = new Set<string>()

  const { data: event } = await supabase
    .from('events')
    .select('user_id')
    .eq('id', eventId)
    .single()
  if (event?.user_id) recipients.add(event.user_id)

  const { data: collaborators } = await supabase
    .from('event_collaborators')
    .select('user_id, role')
    .eq('event_id', eventId)
    .eq('status', 'active')
    .in('role', ['admin', 'editor'])
  for (const c of collaborators ?? []) {
    if (c.user_id) recipients.add(c.user_id)
  }

  if (actorUserId) recipients.delete(actorUserId)
  return [...recipients]
}
