import { describe, it, expect } from 'vitest'
import { MODULOS } from '@/lib/permisos/catalogo'
import {
  PLANES, PLAN_IDS, PRECIO_ASIENTO_EXTRA,
  normalizarPlan, planDe, incluyeHerramienta, etiquetaPlan,
} from './planes'

describe('catalogo de planes', () => {
  it('tiene exactamente tres planes en orden', () => {
    expect(PLAN_IDS).toEqual(['free', 'pro', 'agency'])
  })

  it('Free es solo el dueno, sin Actividad, una boda activa', () => {
    const f = PLANES.free
    expect(f.precio).toBe(0)
    expect(f.asientosIncluidos).toBe(1)
    expect(f.ventanaActividadDias).toBe(0)
    expect(f.bodasActivas).toBe(1)
    expect(f.importExport).toBe(false)
    expect(f.whitelabel).toBe(false)
  })

  it('Pro incluye 1 asiento y Agency 3, extra a 290', () => {
    expect(PLANES.pro.precio).toBe(990)
    expect(PLANES.pro.asientosIncluidos).toBe(1)
    expect(PLANES.agency.precio).toBe(1990)
    expect(PLANES.agency.asientosIncluidos).toBe(3)
    expect(PLANES.agency.whitelabel).toBe(true)
    expect(PRECIO_ASIENTO_EXTRA).toBe(290)
  })

  it('Pro y Agency traen los doce modulos; Free no trae invitacion, mensajes ni regalos', () => {
    expect([...PLANES.pro.herramientas]).toEqual([...MODULOS])
    expect([...PLANES.agency.herramientas]).toEqual([...MODULOS])
    expect(incluyeHerramienta('free', 'invitacion')).toBe(false)
    expect(incluyeHerramienta('free', 'mensajes')).toBe(false)
    expect(incluyeHerramienta('free', 'regalos')).toBe(false)
    expect(incluyeHerramienta('free', 'invitados')).toBe(true)
    expect(incluyeHerramienta('free', 'pagos')).toBe(true)
    expect(incluyeHerramienta('pro', 'invitacion')).toBe(true)
  })

  it('normaliza lo que venga de la base', () => {
    expect(normalizarPlan('pro')).toBe('pro')
    expect(normalizarPlan(' Agency ')).toBe('agency')
    expect(normalizarPlan('studio')).toBe('pro')
    expect(normalizarPlan('solo')).toBe('free')
    expect(normalizarPlan(null)).toBe('free')
    expect(normalizarPlan(undefined)).toBe('free')
    expect(normalizarPlan(42)).toBe('free')
  })

  it('planDe y etiqueta', () => {
    expect(planDe('agency').nombre).toBe('Agency')
    expect(etiquetaPlan('free')).toBe('Free')
  })
})
