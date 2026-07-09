import { describe, it, expect } from 'vitest'
import { checkUserDeletable } from './delete-user'

const target = { id: 'u1', email: 'test@anfiora.com', plan: 'free' }

describe('checkUserDeletable', () => {
  it('ok: plan free, correo exacto, no es uno mismo', () => {
    const r = checkUserDeletable({ actorId: 'admin', target, emailConfirm: 'test@anfiora.com' })
    expect(r).toEqual({ ok: true, error: null })
  })

  it('correo con mayusculas y espacios igual pasa (normaliza)', () => {
    const r = checkUserDeletable({ actorId: 'admin', target, emailConfirm: '  TEST@Anfiora.com  ' })
    expect(r.ok).toBe(true)
  })

  it('falla si el correo no coincide', () => {
    const r = checkUserDeletable({ actorId: 'admin', target, emailConfirm: 'otro@anfiora.com' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('El correo no coincide.')
  })

  it('falla si no hay usuario objetivo', () => {
    const r = checkUserDeletable({ actorId: 'admin', target: null, emailConfirm: '' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Usuario no encontrado.')
  })

  it('no puedes borrarte a ti mismo', () => {
    const r = checkUserDeletable({ actorId: 'u1', target, emailConfirm: 'test@anfiora.com' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('No puedes eliminar tu propia cuenta.')
  })

  it('bloquea plan pro', () => {
    const r = checkUserDeletable({ actorId: 'admin', target: { ...target, plan: 'pro' }, emailConfirm: 'test@anfiora.com' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Pro o Agency')
  })

  it('bloquea plan agency aunque venga en mayusculas', () => {
    const r = checkUserDeletable({ actorId: 'admin', target: { ...target, plan: 'AGENCY' }, emailConfirm: 'test@anfiora.com' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Pro o Agency')
  })

  it('el candado de plan gana sobre el del correo', () => {
    const r = checkUserDeletable({ actorId: 'admin', target: { ...target, plan: 'pro' }, emailConfirm: 'no-coincide' })
    expect(r.error).toContain('Pro o Agency')
  })

  it('el candado de uno-mismo gana sobre el del plan', () => {
    const r = checkUserDeletable({ actorId: 'u1', target: { ...target, plan: 'pro' }, emailConfirm: 'test@anfiora.com' })
    expect(r.error).toBe('No puedes eliminar tu propia cuenta.')
  })
})
