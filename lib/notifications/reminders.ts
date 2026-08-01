import type { PushType } from '@/lib/types'

// task_date es `date` y task_time es `time without time zone`: no guardan zona.
// Mexico no aplica horario de verano desde 2022, asi que un offset fijo es
// exacto para el mercado actual. Solo afecta la caducidad, no el momento del
// envio, que lo gobierna reminder_date (timestamptz).
export const EVENT_UTC_OFFSET = '-06:00'

export const DEFAULT_REMINDER_TTL = 24 * 60 * 60

export type ReminderTask = {
  id: string
  event_id: string
  title: string | null
  category: string | null
  task_date: string | null
  task_time: string | null
  assigned_to_user_id: string | null
}

export type ReminderEvent = {
  id: string
  user_id: string | null
  name: string | null
  event_status: string | null
}

export type ReminderCollaborator = {
  user_id: string | null
  status: string | null
}

export type SkipReason = 'evento_no_activo' | 'tarea_ya_paso' | null

function normalizeTime(raw: string): string {
  return raw.length === 5 ? `${raw}:00` : raw.slice(0, 8)
}

export function taskMoment(task: ReminderTask): Date | null {
  if (!task.task_date) return null
  const time = task.task_time ? normalizeTime(task.task_time) : '23:59:59'
  const parsed = new Date(`${task.task_date}T${time}${EVENT_UTC_OFFSET}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function ttlSeconds(moment: Date | null, now: Date): number {
  if (!moment) return DEFAULT_REMINDER_TTL
  return Math.max(0, Math.floor((moment.getTime() - now.getTime()) / 1000))
}

export function reminderSkipReason(
  task: ReminderTask,
  event: ReminderEvent | null,
  now: Date,
): SkipReason {
  if (!event) return 'evento_no_activo'
  if (event.event_status === 'cancelled' || event.event_status === 'completed') {
    return 'evento_no_activo'
  }
  const moment = taskMoment(task)
  if (moment && moment.getTime() <= now.getTime()) return 'tarea_ya_paso'
  return null
}

export function resolveReminderRecipient(
  task: ReminderTask,
  event: ReminderEvent,
  collaborators: ReminderCollaborator[],
): string | null {
  const assigned = task.assigned_to_user_id
  if (assigned) {
    if (assigned === event.user_id) return assigned
    if (collaborators.some((c) => c.user_id === assigned && c.status === 'active')) return assigned
  }
  return event.user_id ?? null
}

export function reminderPushType(task: ReminderTask): PushType {
  return task.category === 'pago' ? 'payment_due' : 'task_reminders'
}

export function pushTopic(id: string): string {
  return id.replace(/-/g, '')
}
