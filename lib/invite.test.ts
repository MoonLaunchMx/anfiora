import { describe, it, expect } from 'vitest'
import {
  defaultInviteConfig, mergeInviteConfig, randomToken, slugifyEvent,
  resolveInviteHeading, resolveEventKicker, isInviteOpen, buildRsvpUpdate,
} from './invite'

describe('randomToken', () => {
  it('respeta longitud y alfabeto sin ambiguos', () => {
    const seq = [0, 0.2, 0.5, 0.9, 0.1, 0.7, 0.3, 0.99]
    let i = 0
    const rand = () => seq[i++ % seq.length]
    const t = randomToken(8, rand)
    expect(t).toHaveLength(8)
    expect(t).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]+$/)
    expect(t).not.toMatch(/[0O1lIo]/)
  })
})

describe('slugifyEvent', () => {
  it('dos anfitriones -> nombres con y', () => {
    expect(slugifyEvent({ name: 'Boda', host_name: 'Ana', host_name_2: 'Mateo' })).toBe('ana-y-mateo')
  })
  it('sin anfitriones -> nombre del evento sin acentos', () => {
    expect(slugifyEvent({ name: 'Cumpleaños de Adrián' })).toBe('cumpleanos-de-adrian')
  })
})

describe('resolveInviteHeading', () => {
  it('dos anfitriones', () => {
    expect(resolveInviteHeading({ name: 'X', host_name: 'Ana', host_name_2: 'Mateo' })).toBe('Ana & Mateo')
  })
  it('un anfitrion', () => {
    expect(resolveInviteHeading({ name: 'X', host_name: 'Ana' })).toBe('Ana')
  })
  it('ninguno -> nombre del evento', () => {
    expect(resolveInviteHeading({ name: 'Posada 2026' })).toBe('Posada 2026')
  })
})

describe('resolveEventKicker', () => {
  it('boda', () => { expect(resolveEventKicker('boda')).toBe('Nuestra boda') })
  it('default neutral', () => { expect(resolveEventKicker(null)).toBe('Te invitamos') })
})

describe('mergeInviteConfig', () => {
  it('rellena defaults desde objeto vacio', () => {
    expect(mergeInviteConfig({})).toEqual(defaultInviteConfig())
  })
  it('respeta valores dados y descarta basura', () => {
    const c = mergeInviteConfig({ publicada: true, fecha_limite: '2026-02-28', mostrar_playlist: false, extra: 1 })
    expect(c.publicada).toBe(true)
    expect(c.fecha_limite).toBe('2026-02-28')
    expect(c.mostrar_playlist).toBe(false)
    expect(c.mostrar_mesa).toBe(true)
  })
})

describe('isInviteOpen', () => {
  const base = { ...defaultInviteConfig(), publicada: true }
  it('borrador cerrado', () => { expect(isInviteOpen({ ...base, publicada: false }, '2026-01-01')).toBe(false) })
  it('sin fecha limite -> abierto', () => { expect(isInviteOpen({ ...base, fecha_limite: null }, '2026-01-01')).toBe(true) })
  it('antes de la fecha -> abierto', () => { expect(isInviteOpen({ ...base, fecha_limite: '2026-02-28' }, '2026-02-01')).toBe(true) })
  it('despues de la fecha -> cerrado', () => { expect(isInviteOpen({ ...base, fecha_limite: '2026-02-28' }, '2026-03-01')).toBe(false) })
})

describe('buildRsvpUpdate', () => {
  it('confirma invitado y acompanantes', () => {
    const out = buildRsvpUpdate({
      guestAttends: true, guestAllergies: ['Vegetariano'], guestNotes: 'Llegamos tarde',
      companions: [{ id: 'c1', name: 'Sofia', attends: true, allergies: [] }],
    }, { deadlinePassed: false })
    expect(out.guest).toEqual({ rsvp_status: 'confirmed', allergies: ['Vegetariano'], notes: 'Llegamos tarde' })
    expect(out.companions[0]).toEqual({ id: 'c1', name: 'Sofia', rsvp_status: 'confirmed', allergies: [] })
  })
  it('declina', () => {
    const out = buildRsvpUpdate({ guestAttends: false, guestAllergies: [], guestNotes: null, companions: [] }, { deadlinePassed: false })
    expect(out.guest.rsvp_status).toBe('declined')
  })
  it('rechaza si la fecha limite paso', () => {
    expect(() => buildRsvpUpdate({ guestAttends: true, guestAllergies: [], guestNotes: null, companions: [] }, { deadlinePassed: true }))
      .toThrow('deadline_passed')
  })
})
