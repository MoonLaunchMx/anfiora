import { describe, it, expect } from 'vitest'
import { MODULOS, MODULOS_CONFIG, NIVELES, moduloDeRuta } from './catalogo'
import { FEATURES } from '@/lib/features'

describe('MODULOS', () => {
  it('son exactamente los doce del spec', () => {
    expect(MODULOS).toEqual([
      'invitados', 'invitacion', 'mensajes', 'mesas', 'timeline',
      'regalos', 'album', 'playlist', 'vestimenta',
      'presupuesto', 'proveedores', 'pagos',
    ])
  })

  it('comida no es modulo: esta retirada del catalogo', () => {
    expect(MODULOS).not.toContain('comida')
  })

  it('los niveles son cuatro y van de menos a mas', () => {
    expect(NIVELES).toEqual(['ninguno', 'ver', 'editar', 'total'])
  })
})

describe('MODULOS_CONFIG', () => {
  it('tiene una entrada por modulo, sin repetidos', () => {
    expect(MODULOS_CONFIG).toHaveLength(MODULOS.length)
    expect(MODULOS_CONFIG.map(m => m.key).sort()).toEqual([...MODULOS].sort())
  })

  it('toda entrada trae al menos una ruta y una etiqueta', () => {
    for (const m of MODULOS_CONFIG) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.rutas.length).toBeGreaterThan(0)
    }
  })

  it('cada feature que se prende por boda tiene su modulo', () => {
    const conFeature = MODULOS_CONFIG.filter(m => m.feature !== null).map(m => m.feature)
    for (const f of FEATURES) {
      expect(conFeature).toContain(f.key)
    }
  })

  it('los modulos siempre presentes no cuelgan de ninguna feature', () => {
    const siempre = ['invitados', 'mensajes', 'timeline', 'presupuesto', 'proveedores', 'pagos']
    for (const key of siempre) {
      expect(MODULOS_CONFIG.find(m => m.key === key)!.feature).toBeNull()
    }
  })
})

describe('moduloDeRuta', () => {
  it('reconoce la raiz del evento como invitados', () => {
    expect(moduloDeRuta('/events/abc-123')).toBe('invitados')
    expect(moduloDeRuta('/events/abc-123/')).toBe('invitados')
  })

  it('reconoce una subruta y sus hijos', () => {
    expect(moduloDeRuta('/events/abc-123/presupuesto')).toBe('presupuesto')
    expect(moduloDeRuta('/events/abc-123/mesa-regalos')).toBe('regalos')
    expect(moduloDeRuta('/events/abc-123/timeline/algo/mas')).toBe('timeline')
  })

  it('regresa null para lo que no es modulo', () => {
    expect(moduloDeRuta('/events/abc-123/configuracion')).toBeNull()
    expect(moduloDeRuta('/events/abc-123/comida')).toBeNull()
    expect(moduloDeRuta('/dashboard')).toBeNull()
  })
})
