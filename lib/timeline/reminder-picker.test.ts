import { describe, it, expect } from 'vitest'
import {
  reminderPresetsFor,
  computeReminderInstant,
  computeCustomInstant,
  detectReminderKey,
  formatReminderLabel,
  localDateTimeParts,
  reminderChanged,
} from './reminder-picker'

describe('reminderPresetsFor', () => {
  it('ofrece los presets por minutos cuando la tarea tiene hora', () => {
    const values = reminderPresetsFor('16:00').map(p => p.value)
    expect(values).toContain('exacta')
    expect(values).toContain('15min')
  })

  it('sin hora, solo ofrece los que se cuentan por dias', () => {
    const values = reminderPresetsFor(null).map(p => p.value)
    expect(values).not.toContain('exacta')
    expect(values).not.toContain('15min')
    expect(values).toEqual(['mismo-dia', '1d', '2d', '1w', 'custom'])
  })

  it('dice la hora del aviso en la etiqueta cuando la tarea no tiene hora', () => {
    const mismoDia = reminderPresetsFor(null).find(p => p.value === 'mismo-dia')
    expect(mismoDia?.label).toBe('El mismo día a las 9:00')
  })
})

describe('computeReminderInstant', () => {
  it('guarda el instante real, no la hora local como si fuera UTC', () => {
    // El caso reportado: 11:06 en Mexico son las 17:06 UTC.
    const iso = computeReminderInstant('2026-08-03', '11:06', 'exacta')
    expect(iso).toBe('2026-08-03T17:06:00.000Z')
  })

  it('resta los minutos del preset', () => {
    const iso = computeReminderInstant('2026-08-03', '16:00', '15min')!
    const d = new Date(iso)
    expect(d.getHours()).toBe(15)
    expect(d.getMinutes()).toBe(45)
  })

  it('sin hora, usa las 9:00 del dia de la tarea', () => {
    const iso = computeReminderInstant('2026-08-03', null, 'mismo-dia')!
    const d = new Date(iso)
    expect(d.getHours()).toBe(9)
    expect(d.getDate()).toBe(3)
  })

  it('sin hora, un dia antes cae a las 9:00 del dia anterior', () => {
    const iso = computeReminderInstant('2026-08-03', null, '1d')!
    const d = new Date(iso)
    expect(d.getHours()).toBe(9)
    expect(d.getDate()).toBe(2)
  })

  it('devuelve null para personalizado y para claves desconocidas', () => {
    expect(computeReminderInstant('2026-08-03', '16:00', 'custom')).toBeNull()
    expect(computeReminderInstant('2026-08-03', '16:00', 'inventada')).toBeNull()
    expect(computeReminderInstant('', '16:00', '15min')).toBeNull()
  })

  it('no ofrece presets por minutos a una tarea sin hora', () => {
    expect(computeReminderInstant('2026-08-03', null, '15min')).toBeNull()
  })
})

describe('computeCustomInstant', () => {
  it('interpreta la fecha y hora escritas en la zona del navegador', () => {
    expect(computeCustomInstant('2026-08-03', '11:06')).toBe('2026-08-03T17:06:00.000Z')
  })

  it('devuelve null sin fecha', () => {
    expect(computeCustomInstant('', '11:06')).toBeNull()
  })
})

describe('reminderChanged', () => {
  it('el mismo instante escrito de dos formas no cuenta como cambio', () => {
    expect(reminderChanged('2026-08-03T02:00:00+00:00', '2026-08-03T02:00:00.000Z')).toBe(false)
  })

  it('detecta que el recordatorio se movio', () => {
    expect(reminderChanged('2026-08-03T02:00:00+00:00', '2026-08-04T02:00:00.000Z')).toBe(true)
  })

  it('sin recordatorio antes ni despues, no hay cambio', () => {
    expect(reminderChanged(null, null)).toBe(false)
  })

  it('agregar o quitar el recordatorio cuenta como cambio', () => {
    expect(reminderChanged(null, '2026-08-03T02:00:00.000Z')).toBe(true)
    expect(reminderChanged('2026-08-03T02:00:00+00:00', null)).toBe(true)
  })
})

describe('localDateTimeParts', () => {
  it('parte el ISO guardado en fecha y hora locales, no UTC', () => {
    expect(localDateTimeParts('2026-08-03T17:06:00+00:00')).toEqual({
      date: '2026-08-03',
      time: '11:06',
    })
  })

  it('devuelve null si el valor no es una fecha', () => {
    expect(localDateTimeParts('no soy fecha')).toBeNull()
  })
})

describe('detectReminderKey', () => {
  it('reconoce un recordatorio guardado como el mismo preset (ida y vuelta)', () => {
    const iso = computeReminderInstant('2026-08-03', '16:00', '1h')!
    expect(detectReminderKey(iso, '2026-08-03', '16:00')).toBe('1h')
  })

  it('hace la ida y vuelta tambien sin hora', () => {
    const iso = computeReminderInstant('2026-08-03', null, '1w')!
    expect(detectReminderKey(iso, '2026-08-03', null)).toBe('1w')
  })

  it('cae en personalizado cuando no coincide con ningun preset', () => {
    expect(detectReminderKey('2026-08-01T13:00:00.000Z', '2026-08-03', '16:00')).toBe('custom')
  })

  it('devuelve cadena vacia sin recordatorio', () => {
    expect(detectReminderKey(null, '2026-08-03', '16:00')).toBe('')
  })
})

describe('formatReminderLabel', () => {
  it('usa la etiqueta del preset cuando coincide', () => {
    const iso = computeReminderInstant('2026-08-03', '16:00', '2h')!
    expect(formatReminderLabel(iso, '2026-08-03', '16:00')).toBe('2 horas antes')
  })

  it('para uno personalizado muestra la fecha y hora locales', () => {
    const iso = computeCustomInstant('2026-08-01', '13:30')!
    expect(formatReminderLabel(iso, '2026-08-03', '16:00')).toBe('1 ago 13:30')
  })
})
