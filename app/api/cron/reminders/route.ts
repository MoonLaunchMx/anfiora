import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUsers } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/notifications/cron-auth'
import {
  taskMoment,
  ttlSeconds,
  reminderSkipReason,
  resolveReminderRecipient,
  reminderPushType,
  pushTopic,
  type ReminderTask,
  type ReminderEvent,
  type ReminderCollaborator,
} from '@/lib/notifications/reminders'

const MAX_ROWS = 200

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = admin()
  const now = new Date()
  const stats = {
    claimed: 0,
    sent: 0,
    evento_no_activo: 0,
    tarea_ya_paso: 0,
    sin_destinatario: 0,
  }

  try {
    const { data, error } = await db.rpc('claim_due_reminders', { max_rows: MAX_ROWS })
    if (error) {
      console.error('[cron/reminders] el reclamo fallo:', error.message)
      return NextResponse.json({ error: 'el reclamo fallo' }, { status: 500 })
    }

    const claimed = (data ?? []) as ReminderTask[]
    stats.claimed = claimed.length
    if (claimed.length === 0) return NextResponse.json(stats)

    if (claimed.length === MAX_ROWS) {
      console.warn(`[cron/reminders] tope de ${MAX_ROWS} alcanzado; el resto va en la siguiente corrida`)
    }

    const eventIds = [...new Set(claimed.map((t) => t.event_id))]

    const [eventsRes, collabsRes] = await Promise.all([
      db.from('events').select('id, user_id, name, event_status').in('id', eventIds),
      db.from('event_collaborators').select('event_id, user_id, status').in('event_id', eventIds),
    ])

    if (eventsRes.error) console.error('[cron/reminders] eventos:', eventsRes.error.message)
    if (collabsRes.error) console.error('[cron/reminders] colaboradores:', collabsRes.error.message)

    const eventById = new Map<string, ReminderEvent>()
    for (const e of eventsRes.data ?? []) eventById.set(e.id, e as ReminderEvent)

    const collabsByEvent = new Map<string, ReminderCollaborator[]>()
    for (const c of collabsRes.data ?? []) {
      const list = collabsByEvent.get(c.event_id) ?? []
      list.push({ user_id: c.user_id, status: c.status })
      collabsByEvent.set(c.event_id, list)
    }

    for (const task of claimed) {
      const event = eventById.get(task.event_id) ?? null
      const skip = reminderSkipReason(task, event, now)
      if (skip) {
        stats[skip]++
        continue
      }

      const found = event as ReminderEvent
      const recipient = resolveReminderRecipient(
        task,
        found,
        collabsByEvent.get(task.event_id) ?? [],
      )
      if (!recipient) {
        stats.sin_destinatario++
        continue
      }

      await sendPushToUsers(
        [recipient],
        {
          title: found.name ?? 'Anfiora',
          body: task.title ?? 'Tienes una tarea pendiente',
          url: `/events/${task.event_id}/timeline`,
          tag: `task-${task.id}`,
          renotify: true,
          ttl: ttlSeconds(taskMoment(task), now),
          topic: pushTopic(task.id),
        },
        reminderPushType(task),
      )

      stats.sent++
    }

    return NextResponse.json(stats)
  } catch (e) {
    console.error('[cron/reminders] fallo:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ...stats, error: 'fallo parcial' })
  }
}
