import { describe, it, expect } from 'vitest'
import {
  taskMoment,
  ttlSeconds,
  reminderSkipReason,
  resolveReminderRecipient,
  reminderPushType,
  pushTopic,
  DEFAULT_REMINDER_TTL,
  type ReminderTask,
  type ReminderEvent,
} from './reminders'

const task = (over: Partial<ReminderTask> = {}): ReminderTask => ({
  id: '11111111-2222-3333-4444-555555555555',
  event_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  title: 'Probar menu',
  category: 'tarea',
  task_date: '2026-08-10',
  task_time: '18:00:00',
  assigned_to_user_id: null,
  ...over,
})

const evento = (over: Partial<ReminderEvent> = {}): ReminderEvent => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  user_id: 'owner-1',
  name: 'Boda Ana y Luis',
  event_status: 'active',
  ...over,
})

describe('taskMoment', () => {
  it('combina fecha y hora en la zona del evento (UTC-6)', () => {
    expect(taskMoment(task())?.toISOString()).toBe('2026-08-11T00:00:00.000Z')
  })

  it('sin hora, la tarea vence al final del dia', () => {
    expect(taskMoment(task({ task_time: null }))?.toISOString()).toBe('2026-08-11T05:59:59.000Z')
  })

  it('acepta hora sin segundos', () => {
    expect(taskMoment(task({ task_time: '18:00' }))?.toISOString()).toBe('2026-08-11T00:00:00.000Z')
  })

  it('sin fecha no hay momento', () => {
    expect(taskMoment(task({ task_date: null }))).toBeNull()
  })
})

describe('ttlSeconds', () => {
  it('cuenta los segundos que faltan', () => {
    const now = new Date('2026-08-10T23:00:00.000Z')
    expect(ttlSeconds(new Date('2026-08-11T00:00:00.000Z'), now)).toBe(3600)
  })

  it('nunca es negativo', () => {
    const now = new Date('2026-08-12T00:00:00.000Z')
    expect(ttlSeconds(new Date('2026-08-11T00:00:00.000Z'), now)).toBe(0)
  })

  it('sin momento usa el default', () => {
    expect(ttlSeconds(null, new Date())).toBe(DEFAULT_REMINDER_TTL)
  })
})

describe('reminderSkipReason', () => {
  const now = new Date('2026-08-09T12:00:00.000Z')

  it('evento activo y tarea futura: se envia', () => {
    expect(reminderSkipReason(task(), evento(), now)).toBeNull()
  })

  it('evento cancelado: no se envia', () => {
    expect(reminderSkipReason(task(), evento({ event_status: 'cancelled' }), now)).toBe('evento_no_activo')
  })

  it('evento completado: no se envia', () => {
    expect(reminderSkipReason(task(), evento({ event_status: 'completed' }), now)).toBe('evento_no_activo')
  })

  it('evento pausado: SI se envia, igual que hoy en los webhooks', () => {
    expect(reminderSkipReason(task(), evento({ event_status: 'paused' }), now)).toBeNull()
  })

  it('evento que no existe: no se envia', () => {
    expect(reminderSkipReason(task(), null, now)).toBe('evento_no_activo')
  })

  it('tarea que ya paso: no se envia', () => {
    const tarde = new Date('2026-08-12T00:00:00.000Z')
    expect(reminderSkipReason(task(), evento(), tarde)).toBe('tarea_ya_paso')
  })

  it('tarea sin fecha: se envia, no hay como saber que caduco', () => {
    expect(reminderSkipReason(task({ task_date: null }), evento(), now)).toBeNull()
  })
})

describe('resolveReminderRecipient', () => {
  it('sin asignado: al owner', () => {
    expect(resolveReminderRecipient(task(), evento(), [])).toBe('owner-1')
  })

  it('asignado colaborador activo: a el, no al owner', () => {
    const t = task({ assigned_to_user_id: 'colab-1' })
    const colabs = [{ user_id: 'colab-1', status: 'active' }]
    expect(resolveReminderRecipient(t, evento(), colabs)).toBe('colab-1')
  })

  it('asignado que perdio el acceso: cae al owner', () => {
    const t = task({ assigned_to_user_id: 'colab-1' })
    const colabs = [{ user_id: 'colab-1', status: 'revoked' }]
    expect(resolveReminderRecipient(t, evento(), colabs)).toBe('owner-1')
  })

  it('asignado que es el propio owner: al owner', () => {
    const t = task({ assigned_to_user_id: 'owner-1' })
    expect(resolveReminderRecipient(t, evento(), [])).toBe('owner-1')
  })

  it('asignado por nombre libre (sin user_id): cae al owner', () => {
    expect(resolveReminderRecipient(task({ assigned_to_user_id: null }), evento(), [])).toBe('owner-1')
  })

  it('evento sin owner: no hay a quien avisar', () => {
    expect(resolveReminderRecipient(task(), evento({ user_id: null }), [])).toBeNull()
  })
})

describe('reminderPushType', () => {
  it('categoria pago es pago por vencer', () => {
    expect(reminderPushType(task({ category: 'pago' }))).toBe('payment_due')
  })

  it('cualquier otra categoria es recordatorio de tarea', () => {
    expect(reminderPushType(task({ category: 'entrega' }))).toBe('task_reminders')
    expect(reminderPushType(task({ category: null }))).toBe('task_reminders')
  })
})

describe('pushTopic', () => {
  it('un uuid sin guiones mide exactamente 32, el limite de RFC 8030', () => {
    const topic = pushTopic('11111111-2222-3333-4444-555555555555')
    expect(topic).toBe('11111111222233334444555555555555')
    expect(topic.length).toBe(32)
  })
})
