// Environment 'node' en vitest.config.ts no trae window por defecto en todos
// los runners, pero jsdom-less Node 20+ sigue sin localStorage global: se
// simula uno minimo aqui mismo, igual que si fuera el navegador.
import { beforeEach, describe, expect, it } from 'vitest'
import { yaRechazoLaOferta, recordarRechazo } from './oferta-avance'

type MiniStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function fakeLocalStorage(): MiniStorage {
  const datos = new Map<string, string>()
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v) },
    removeItem: (k: string) => { datos.delete(k) },
  }
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MiniStorage } }).window = {
    localStorage: fakeLocalStorage(),
  }
})

describe('oferta-avance', () => {
  it('sin nada guardado, no se considera rechazada', () => {
    expect(yaRechazoLaOferta('es-1', 'cotizado')).toBe(false)
  })

  it('declinar una oferta no silencia la otra para el mismo proveedor', () => {
    recordarRechazo('es-1', 'cotizado')
    expect(yaRechazoLaOferta('es-1', 'cotizado')).toBe(true)
    expect(yaRechazoLaOferta('es-1', 'contratado')).toBe(false)
  })

  it('el rechazo no se filtra a otro proveedor', () => {
    recordarRechazo('es-1', 'cotizado')
    expect(yaRechazoLaOferta('es-2', 'cotizado')).toBe(false)
  })

  it('el rechazo sobrevive a una relectura', () => {
    recordarRechazo('es-1', 'contratado')
    expect(yaRechazoLaOferta('es-1', 'contratado')).toBe(true)
    expect(yaRechazoLaOferta('es-1', 'contratado')).toBe(true)
  })
})
