import { describe, expect, it } from 'vitest'
import {
  MAX_BYTES, TOPE_COTIZACIONES,
  esImagen, extensionDe, pesoLegible, rutaDe, tipoDeArchivo, validarArchivo, visibles,
} from './adjuntos'
import type { ArchivoAdjunto } from '@/lib/types'

const archivo = (parche: Partial<ArchivoAdjunto> = {}): ArchivoAdjunto => ({
  path: 'e/cotizaciones/s/1.pdf',
  nombre: 'cotizacion.pdf',
  tipo: 'application/pdf',
  bytes: 1024,
  subido: '2026-09-05T10:00:00.000Z',
  por: null,
  borrado: null,
  ...parche,
})

describe('visibles', () => {
  it('esconde los quitados y deja los demas', () => {
    const lista = [
      archivo({ path: 'a.pdf' }),
      archivo({ path: 'b.pdf', borrado: '2026-09-05T11:00:00.000Z' }),
      archivo({ path: 'c.pdf' }),
    ]
    expect(visibles(lista).map(a => a.path)).toEqual(['a.pdf', 'c.pdf'])
  })

  it('aguanta null y un arreglo vacio', () => {
    expect(visibles(null)).toEqual([])
    expect(visibles([])).toEqual([])
  })
})

describe('tipoDeArchivo', () => {
  it('respeta el tipo que trae el navegador', () => {
    expect(tipoDeArchivo('foto.jpg', 'image/jpeg')).toBe('image/jpeg')
  })

  // El iPhone entrega HEIC con file.type vacio; sin deducirlo, el bucket lo
  // rechaza por content-type y la primera foto que sube una novia rebota.
  it('deduce el tipo desde la extension cuando viene en blanco', () => {
    expect(tipoDeArchivo('IMG_4821.HEIC', '')).toBe('image/heic')
    expect(tipoDeArchivo('recibo.PDF', '')).toBe('application/pdf')
    expect(tipoDeArchivo('captura.png', '')).toBe('image/png')
  })

  it('devuelve cadena vacia cuando no reconoce la extension', () => {
    expect(tipoDeArchivo('contrato.docx', '')).toBe('')
  })
})

describe('extensionDe', () => {
  it('saca la extension en minusculas', () => {
    expect(extensionDe('IMG_4821.HEIC')).toBe('heic')
    expect(extensionDe('cotizacion final.v2.pdf')).toBe('pdf')
  })

  it('devuelve bin cuando no hay extension', () => {
    expect(extensionDe('sinpunto')).toBe('bin')
    expect(extensionDe('termina en punto.')).toBe('bin')
  })
})

describe('rutaDe', () => {
  it('arma la ruta con el uuid y nunca con el nombre del usuario', () => {
    const ruta = rutaDe('EV', 'cotizaciones', 'PROV', 'Cotización final ñ.pdf', 'UUID')
    expect(ruta).toBe('EV/cotizaciones/PROV/UUID.pdf')
    expect(ruta).not.toContain('Cotización')
  })

  it('arma la de comprobantes', () => {
    expect(rutaDe('EV', 'comprobantes', 'PAGO', 'transfer.jpg', 'UUID'))
      .toBe('EV/comprobantes/PAGO/UUID.jpg')
  })

  // El segundo segmento es lo que la policy del bucket traduce a modulo: si se
  // escribe distinto, el archivo sube y despues nadie puede abrirlo.
  it('el segundo segmento siempre es la carpeta', () => {
    expect(rutaDe('EV', 'cotizaciones', 'X', 'a.pdf', 'U').split('/')[1]).toBe('cotizaciones')
    expect(rutaDe('EV', 'comprobantes', 'X', 'a.pdf', 'U').split('/')[1]).toBe('comprobantes')
  })
})

describe('validarArchivo', () => {
  it('acepta un PDF normal', () => {
    expect(validarArchivo('cotizacion.pdf', 'application/pdf', 500_000, 0, TOPE_COTIZACIONES)).toBeNull()
  })

  it('acepta un HEIC sin tipo', () => {
    expect(validarArchivo('IMG_4821.HEIC', '', 3_400_000, 2, TOPE_COTIZACIONES)).toBeNull()
  })

  // El mensaje trae el nombre, el peso real y la salida. "Archivo invalido" no
  // le sirve a nadie.
  it('rechaza lo que pesa de mas nombrando el archivo y su peso', () => {
    const error = validarArchivo('Contrato-escaneado.pdf', 'application/pdf', 24 * 1024 * 1024, 0, TOPE_COTIZACIONES)
    expect(error).toContain('Contrato-escaneado.pdf')
    expect(error).toContain('24.0 MB')
    expect(error).toContain('10 MB')
  })

  it('rechaza un tipo que no es documento ni imagen', () => {
    const error = validarArchivo('lista.xlsx', 'application/vnd.ms-excel', 1000, 0, TOPE_COTIZACIONES)
    expect(error).toContain('PDF')
  })

  it('rechaza cuando ya se llego al tope', () => {
    const error = validarArchivo('otra.pdf', 'application/pdf', 1000, TOPE_COTIZACIONES, TOPE_COTIZACIONES)
    expect(error).toContain('10')
  })

  it('el tope del navegador es el mismo que el del bucket', () => {
    expect(MAX_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe('pesoLegible', () => {
  it('escribe KB y MB como los lee una persona', () => {
    expect(pesoLegible(820 * 1024)).toBe('820 KB')
    expect(pesoLegible(1.2 * 1024 * 1024)).toBe('1.2 MB')
    expect(pesoLegible(500)).toBe('1 KB')
  })
})

describe('esImagen', () => {
  it('separa el glifo de documento del de imagen', () => {
    expect(esImagen('image/heic')).toBe(true)
    expect(esImagen('application/pdf')).toBe(false)
  })
})
