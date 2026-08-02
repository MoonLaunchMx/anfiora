import { describe, it, expect } from 'vitest'
import { readPrefs, isTypeEnabled, withPref } from './prefs'

describe('isTypeEnabled', () => {
  it('sin settings guardados: todo activado', () => {
    expect(isTypeEnabled(null, 'task_reminders')).toBe(true)
    expect(isTypeEnabled(undefined, 'guest_replies')).toBe(true)
    expect(isTypeEnabled({}, 'payment_due')).toBe(true)
  })

  it('settings sin la llave notifications: activado', () => {
    expect(isTypeEnabled({ otra_cosa: 1 }, 'task_reminders')).toBe(true)
  })

  it('solo false apaga; el resto de los tipos siguen activos', () => {
    const settings = { notifications: { task_reminders: false } }
    expect(isTypeEnabled(settings, 'task_reminders')).toBe(false)
    expect(isTypeEnabled(settings, 'guest_replies')).toBe(true)
  })

  it('true explicito: activado', () => {
    expect(isTypeEnabled({ notifications: { payment_due: true } }, 'payment_due')).toBe(true)
  })
})

describe('readPrefs', () => {
  it('devuelve objeto vacio cuando no hay nada util', () => {
    expect(readPrefs(null)).toEqual({})
    expect(readPrefs('texto')).toEqual({})
    expect(readPrefs({ notifications: 'no-es-objeto' })).toEqual({})
  })
})

describe('withPref', () => {
  it('conserva otras llaves de settings', () => {
    const out = withPref({ tema: 'oscuro', notifications: { guest_replies: false } }, 'payment_due', false)
    expect(out.tema).toBe('oscuro')
    expect(out.notifications).toEqual({ guest_replies: false, payment_due: false })
  })

  it('funciona desde settings nulo', () => {
    expect(withPref(null, 'task_reminders', false)).toEqual({ notifications: { task_reminders: false } })
  })

  it('sobrescribe el mismo tipo sin duplicar', () => {
    const out = withPref({ notifications: { task_reminders: false } }, 'task_reminders', true)
    expect(out.notifications).toEqual({ task_reminders: true })
  })
})
