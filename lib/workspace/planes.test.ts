import { describe, it, expect } from 'vitest'
import { MODULOS } from '@/lib/permisos/catalogo'
import {
  PLANES, PLAN_IDS, PRECIO_ASIENTO_EXTRA,
  normalizarPlan, planDe, incluyeHerramienta, etiquetaPlan,
} from './planes'

describe('catalogo de planes', () => {
  it('tiene exactamente cuatro planes en orden', () => {
    expect(PLAN_IDS).toEqual(['free', 'pro', 'studio', 'agency'])
  })

  it('Free es solo el dueno, sin Actividad, un evento activo', () => {
    const f = PLANES.free
    expect(f.precio).toBe(0)
    expect(f.asientosIncluidos).toBe(1)
    expect(f.ventanaActividadDias).toBe(0)
    expect(f.eventosActivos).toBe(1)
    expect(f.invitadosPorEvento).toBe(50)
    expect(f.importExport).toBe(false)
    expect(f.whitelabel).toBe(false)
  })

  it('tiene los cuatro planes con sus asientos', () => {
    expect(PLANES.free.asientosIncluidos).toBe(1)
    expect(PLANES.pro.asientosIncluidos).toBe(1)
    expect(PLANES.studio.asientosIncluidos).toBe(3)
    expect(PLANES.agency.asientosIncluidos).toBe(5)
  })

  it('tiene los precios acordados', () => {
    expect(PLANES.free.precio).toBe(0)
    expect(PLANES.pro.precio).toBe(490)
    expect(PLANES.studio.precio).toBe(990)
    expect(PLANES.agency.precio).toBe(1990)
    expect(PLANES.agency.whitelabel).toBe(true)
    expect(PRECIO_ASIENTO_EXTRA).toBe(290)
  })

  it('solo free tiene topes', () => {
    expect(PLANES.free.eventosActivos).toBe(1)
    expect(PLANES.free.invitadosPorEvento).toBe(50)
    for (const id of ['pro', 'studio', 'agency'] as const) {
      expect(PLANES[id].eventosActivos).toBeNull()
      expect(PLANES[id].invitadosPorEvento).toBeNull()
    }
  })

  it('Pro, Studio y Agency traen los doce modulos; Free no trae invitacion, mensajes ni regalos', () => {
    expect([...PLANES.pro.herramientas]).toEqual([...MODULOS])
    expect([...PLANES.studio.herramientas]).toEqual([...MODULOS])
    expect([...PLANES.agency.herramientas]).toEqual([...MODULOS])
    expect(incluyeHerramienta('free', 'invitacion')).toBe(false)
    expect(incluyeHerramienta('free', 'mensajes')).toBe(false)
    expect(incluyeHerramienta('free', 'regalos')).toBe(false)
    expect(incluyeHerramienta('free', 'invitados')).toBe(true)
    expect(incluyeHerramienta('free', 'pagos')).toBe(true)
    expect(incluyeHerramienta('pro', 'invitacion')).toBe(true)
  })

  it('studio ya no es alias de pro', () => {
    expect(normalizarPlan('studio')).toBe('studio')
    expect(normalizarPlan('PRO')).toBe('pro')
    expect(normalizarPlan('solo')).toBe('free')
    expect(normalizarPlan(null)).toBe('free')
  })

  it('normaliza lo que venga de la base', () => {
    expect(normalizarPlan('pro')).toBe('pro')
    expect(normalizarPlan(' Agency ')).toBe('agency')
    expect(normalizarPlan('solo')).toBe('free')
    expect(normalizarPlan(null)).toBe('free')
    expect(normalizarPlan(undefined)).toBe('free')
    expect(normalizarPlan(42)).toBe('free')
  })

  it('planDe y etiqueta', () => {
    expect(planDe('agency').nombre).toBe('Agency')
    expect(planDe('studio').nombre).toBe('Studio')
    expect(etiquetaPlan('free')).toBe('Free')
  })
})
