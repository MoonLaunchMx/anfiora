import { describe, it, expect } from 'vitest'
import {
  MAX_BYTES, esRutaPropia, nombreSeguro, rutaDeImagen, rutaDesdeUrl, validarImagen,
} from './imagenes'

const f = (type: string, size: number, name = 'foto.jpg') => ({ type, size, name })

describe('validarImagen', () => {
  it('acepta jpg, png y webp de peso normal', () => {
    expect(validarImagen(f('image/jpeg', 500_000)).ok).toBe(true)
    expect(validarImagen(f('image/png', 1_000_000)).ok).toBe(true)
    expect(validarImagen(f('image/webp', 20_000)).ok).toBe(true)
  })

  it('rechaza HEIC con la salida, no con un tipo invalido', () => {
    const r = validarImagen(f('image/heic', 900_000, 'IMG_0042.HEIC'))
    expect(r.ok).toBe(false)
    expect(r.error).toContain('JPG')
  })

  it('rechaza lo que no es imagen aceptada', () => {
    expect(validarImagen(f('application/pdf', 1000)).ok).toBe(false)
    expect(validarImagen(f('', 1000)).ok).toBe(false)
    expect(validarImagen(f('image/gif', 1000)).ok).toBe(false)
  })

  it('rechaza el vacio y lo que pasa del tope', () => {
    expect(validarImagen(f('image/jpeg', 0)).ok).toBe(false)
    expect(validarImagen(f('image/jpeg', MAX_BYTES + 1)).ok).toBe(false)
    expect(validarImagen(f('image/jpeg', MAX_BYTES)).ok).toBe(true)
  })

  it('el tope se dice en MB, no en bytes', () => {
    const r = validarImagen(f('image/jpeg', 9_000_000))
    expect(r.ok).toBe(false)
    expect(r.error).toContain('MB')
  })

  it('no le importan las mayusculas del tipo', () => {
    expect(validarImagen(f('IMAGE/JPEG', 1000)).ok).toBe(true)
  })
})

describe('nombreSeguro', () => {
  it('deja solo caracteres de ruta', () => {
    expect(nombreSeguro('mi foto (1).png')).toBe('mi_foto__1_.png')
  })

  it('nunca devuelve vacio', () => {
    expect(nombreSeguro('///')).toBe('___')
    expect(nombreSeguro('')).toBe('imagen')
  })

  it('recorta los nombres larguisimos', () => {
    expect(nombreSeguro('a'.repeat(200)).length).toBe(60)
  })
})

describe('rutaDeImagen', () => {
  it('cuelga del dueno y lleva sello unico', () => {
    expect(rutaDeImagen('avatars', 'u1', 'yo.png', '123')).toBe('avatars/u1/123-yo.png')
    expect(rutaDeImagen('logos', 'w9', 'Logo Final.PNG', 'abc')).toBe('logos/w9/abc-Logo_Final.PNG')
  })
})

describe('esRutaPropia', () => {
  it('solo acepta lo que vive en la carpeta del dueno', () => {
    expect(esRutaPropia('avatars', 'u1', 'avatars/u1/123-yo.png')).toBe(true)
    expect(esRutaPropia('avatars', 'u1', 'avatars/u2/123-yo.png')).toBe(false)
    expect(esRutaPropia('logos', 'w1', 'avatars/w1/123-yo.png')).toBe(false)
    expect(esRutaPropia('avatars', 'u1', 'dress-code/evento/foto.png')).toBe(false)
  })
})

describe('rutaDesdeUrl', () => {
  const base = 'https://xyz.supabase.co/storage/v1/object/public/event-media/'

  it('recupera la ruta de una url publica', () => {
    expect(rutaDesdeUrl(base + 'avatars/u1/123-yo.png', 'event-media')).toBe('avatars/u1/123-yo.png')
  })

  it('quita el query y desescapa', () => {
    expect(rutaDesdeUrl(base + 'avatars/u1/123-mi%20foto.png?v=2', 'event-media')).toBe('avatars/u1/123-mi foto.png')
  })

  it('devuelve null si no es de ese bucket', () => {
    expect(rutaDesdeUrl('https://otra.com/foto.png', 'event-media')).toBeNull()
    expect(rutaDesdeUrl(base, 'event-media')).toBeNull()
  })
})
