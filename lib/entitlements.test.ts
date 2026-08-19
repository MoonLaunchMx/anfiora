import { describe, it, expect } from 'vitest'
import { getActiveEventLimit, normalizePlan, isPlanner, PLAN_IDS } from './entitlements'

describe('getActiveEventLimit', () => {
  it('una cuenta gratis lleva un evento a la vez', () => {
    expect(getActiveEventLimit('free')).toBe(1)
  })

  it('sin plan, o con un valor que no existe, cae en uno', () => {
    expect(getActiveEventLimit(null)).toBe(1)
    expect(getActiveEventLimit(undefined)).toBe(1)
    expect(getActiveEventLimit('lo-que-sea')).toBe(1)
  })

  it('respeta el cupo de cada plan de planner', () => {
    expect(getActiveEventLimit('solo')).toBe(10)
    expect(getActiveEventLimit('studio')).toBe(25)
    expect(getActiveEventLimit('agency')).toBe(60)
  })

  it('el plan viejo pro no capa a quien ya lo tiene', () => {
    expect(getActiveEventLimit('pro')).toBe(25)
  })

  it('el staff no tiene limite', () => {
    expect(getActiveEventLimit('free', 'superuser@anfiora.com')).toBe(Infinity)
  })
})

describe('normalizePlan', () => {
  it('traduce el legacy pro a studio', () => {
    expect(normalizePlan('pro')).toBe('studio')
  })
  it('cualquier basura es free', () => {
    expect(normalizePlan('  ')).toBe('free')
    expect(normalizePlan(null)).toBe('free')
  })
})

describe('isPlanner', () => {
  it('free no es planner', () => {
    expect(isPlanner('free')).toBe(false)
  })
  it('los planes de suscripcion si', () => {
    expect(isPlanner('solo')).toBe(true)
    expect(isPlanner('studio')).toBe(true)
    expect(isPlanner('agency')).toBe(true)
  })
})

describe('PLAN_IDS', () => {
  it('son los cuatro planes vivos, en orden de cupo', () => {
    expect(PLAN_IDS).toEqual(['free', 'solo', 'studio', 'agency'])
  })
})
