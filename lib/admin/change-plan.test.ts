import { describe, it, expect } from 'vitest'
import { checkPlanChange, interpretPlanUpdate } from './change-plan'

const target = { id: 'u1', email: 'test@anfiora.com', plan: 'free' }

describe('checkPlanChange', () => {
  it('ok: de free a pro', () => {
    const r = checkPlanChange({ target, newPlan: 'pro' })
    expect(r).toEqual({ ok: true, error: null })
  })

  it('normaliza mayusculas y espacios', () => {
    const r = checkPlanChange({ target, newPlan: '  PRO  ' })
    expect(r.ok).toBe(true)
  })

  it('falla si no hay usuario objetivo', () => {
    const r = checkPlanChange({ target: null, newPlan: 'pro' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Usuario no encontrado.')
  })

  it('rechaza un plan que no existe', () => {
    const r = checkPlanChange({ target, newPlan: 'enterprise' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Plan no valido.')
  })

  it('rechaza el cambio nulo: ya tiene ese plan', () => {
    const r = checkPlanChange({ target, newPlan: 'free' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('El usuario ya tiene ese plan.')
  })
})

// Este es el bug real: RLS filtra la fila ajena, el UPDATE afecta cero filas y
// NO devuelve error. Revisar solo `error` deja pasar el fallo y la UI canta exito.
describe('interpretPlanUpdate', () => {
  it('cero filas afectadas es fallo, aunque la base no reporte error', () => {
    const r = interpretPlanUpdate({ error: null, rows: [] })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('No se actualizo ninguna fila. El cambio no se guardo.')
  })

  it('rows en null tambien es fallo', () => {
    const r = interpretPlanUpdate({ error: null, rows: null })
    expect(r.ok).toBe(false)
  })

  it('propaga el mensaje cuando la base si devuelve error', () => {
    const r = interpretPlanUpdate({ error: { message: 'permission denied' }, rows: null })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('permission denied')
  })

  it('ok cuando la fila se actualizo de verdad', () => {
    const r = interpretPlanUpdate({ error: null, rows: [{ id: 'u1', plan: 'pro' }] })
    expect(r).toEqual({ ok: true, error: null })
  })
})
