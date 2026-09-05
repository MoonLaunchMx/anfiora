import { describe, it, expect } from 'vitest'
import {
  ESTADOS, PAISES, bandera, ciudadesDe, estadosDe, mismoLugar,
  nombrePais, normalizarCiudad, normalizarEstado, tieneEstados,
} from './divisiones'

describe('los datos de Mexico', () => {
  it('trae los 32 estados, sin repetidos', () => {
    expect(ESTADOS.MX).toHaveLength(32)
    expect(new Set(ESTADOS.MX).size).toBe(32)
  })

  it('cada estado de Mexico tiene al menos una ciudad sugerida', () => {
    for (const estado of ESTADOS.MX) {
      expect(ciudadesDe('MX', estado).length, `${estado} sin ciudades`).toBeGreaterThan(0)
    }
  })

  it('ningun estado repite una ciudad dentro de su lista', () => {
    for (const estado of ESTADOS.MX) {
      const c = ciudadesDe('MX', estado)
      expect(new Set(c).size, `${estado} repite ciudad`).toBe(c.length)
    }
  })
})

describe('paises', () => {
  it('Mexico esta en la lista que comparte con el telefono', () => {
    expect(PAISES.some(p => p.iso === 'MX')).toBe(true)
  })

  it('la bandera se deriva del ISO', () => {
    expect(bandera('MX')).toBe('🇲🇽')
    expect(bandera('ES')).toBe('🇪🇸')
  })

  it('un ISO invalido no truena, solo no da bandera', () => {
    expect(bandera('')).toBe('')
    expect(bandera('MEX')).toBe('')
  })

  it('el nombre del pais sale de la lista y cae al ISO si no lo conoce', () => {
    expect(nombrePais('MX')).toBe('Mexico')
    expect(nombrePais('ZZ')).toBe('ZZ')
    expect(nombrePais(null)).toBe('')
  })
})

describe('tieneEstados', () => {
  it('Mexico si tiene lista', () => {
    expect(tieneEstados('MX')).toBe(true)
  })

  it('los paises que todavia no cargamos no la tienen, y eso no es un error', () => {
    expect(tieneEstados('PT')).toBe(false)
    expect(tieneEstados(null)).toBe(false)
  })
})

describe('estadosDe y ciudadesDe', () => {
  it('un pais sin lista devuelve vacio en vez de reventar', () => {
    expect(estadosDe('PT')).toEqual([])
    expect(ciudadesDe('PT', 'Lisboa')).toEqual([])
  })

  it('un estado que no existe devuelve vacio', () => {
    expect(ciudadesDe('MX', 'Narnia')).toEqual([])
  })

  it('sin estado no hay ciudades', () => {
    expect(ciudadesDe('MX', null)).toEqual([])
  })
})

describe('mismoLugar', () => {
  it('ignora acentos, mayusculas y espacios de sobra', () => {
    expect(mismoLugar('Querétaro', '  queretaro ')).toBe(true)
    expect(mismoLugar('San Luis  Potosí', 'san luis potosi')).toBe(true)
  })

  it('dos lugares distintos siguen siendo distintos', () => {
    expect(mismoLugar('Querétaro', 'Quintana Roo')).toBe(false)
  })

  it('un lado vacio nunca coincide', () => {
    expect(mismoLugar('', 'Querétaro')).toBe(false)
    expect(mismoLugar(null, null)).toBe(false)
  })
})

describe('normalizarEstado', () => {
  it('corrige a la forma oficial lo que se escribio sin acento', () => {
    expect(normalizarEstado('MX', 'queretaro')).toBe('Querétaro')
    expect(normalizarEstado('MX', 'nuevo leon')).toBe('Nuevo León')
  })

  it('respeta lo tecleado cuando el pais no tiene lista', () => {
    expect(normalizarEstado('PT', 'Algarve')).toBe('Algarve')
  })

  it('respeta lo tecleado cuando no es un estado conocido', () => {
    expect(normalizarEstado('MX', 'Narnia')).toBe('Narnia')
  })

  it('vacio se queda vacio', () => {
    expect(normalizarEstado('MX', '   ')).toBe('')
  })
})

describe('normalizarCiudad', () => {
  it('corrige contra las ciudades sugeridas del estado', () => {
    expect(normalizarCiudad('MX', 'Querétaro', 'tequisquiapan')).toBe('Tequisquiapan')
  })

  it('las ciudades que ya usas mandan sobre la lista', () => {
    expect(normalizarCiudad('MX', 'Querétaro', 'EL PUEBLITO', ['El Pueblito'])).toBe('El Pueblito')
  })

  it('una ciudad que nadie conoce se guarda tal cual, sin bloquear', () => {
    expect(normalizarCiudad('MX', 'Querétaro', 'Hacienda La Laborcilla')).toBe('Hacienda La Laborcilla')
  })

  it('vacio se queda vacio', () => {
    expect(normalizarCiudad('MX', 'Querétaro', '  ')).toBe('')
  })
})
