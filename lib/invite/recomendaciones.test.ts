import { describe, it, expect } from 'vitest'
import {
  normalizarUrl, sitioDeUrl, tituloDeRespaldo, nuevoLink,
  agregarLink, actualizarLink, quitarLink, moverLink, bloquesDesdeGrupos,
  MAX_LINKS_POR_BLOQUE,
} from './recomendaciones'

const links = (n: number) => Array.from({ length: n }, (_, i) => nuevoLink(`https://sitio${i}.com/`))

describe('normalizarUrl', () => {
  it('completa el esquema cuando el planner pega el dominio pelado', () => {
    expect(normalizarUrl('haciendatemozon.com')).toBe('https://haciendatemozon.com/')
  })
  it('respeta el link completo y sus parametros', () => {
    expect(normalizarUrl('  https://airbnb.mx/rooms/123?x=1 ')).toBe('https://airbnb.mx/rooms/123?x=1')
  })
  it('rechaza vacio, texto sin dominio y otros protocolos', () => {
    expect(normalizarUrl('')).toBeNull()
    expect(normalizarUrl('   ')).toBeNull()
    expect(normalizarUrl('hotel bonito')).toBeNull()
    expect(normalizarUrl('javascript:alert(1)')).toBeNull()
    expect(normalizarUrl('ftp://archivos.com/a')).toBeNull()
  })
})

describe('sitio y titulo de respaldo', () => {
  it('quita el www del sitio', () => {
    expect(sitioDeUrl('https://www.casalecanda.com/habitaciones')).toBe('casalecanda.com')
  })
  it('deja el subdominio real', () => {
    expect(sitioDeUrl('https://articulo.mercadolibre.com.mx/x')).toBe('articulo.mercadolibre.com.mx')
  })
  it('usa la marca del sitio cuando no hay titulo', () => {
    expect(tituloDeRespaldo('https://www.airbnb.mx/rooms/1')).toBe('Airbnb')
    expect(tituloDeRespaldo('no-es-url')).toBe('Enlace')
  })
  it('nuevoLink deja titulo y sitio listos aunque falle la vista previa', () => {
    expect(nuevoLink('https://www.ado.com.mx/rutas')).toEqual({
      url: 'https://www.ado.com.mx/rutas', titulo: 'Ado', sitio: 'ado.com.mx', imagen: '', nota: '',
    })
  })
})

describe('editar los links del bloque', () => {
  it('agrega al final', () => {
    const next = agregarLink(links(1), nuevoLink('https://aeromexico.com/'))
    expect(next.map(l => l.sitio)).toEqual(['sitio0.com', 'aeromexico.com'])
  })
  it('no pasa del tope de links por bloque', () => {
    const next = agregarLink(links(MAX_LINKS_POR_BLOQUE), nuevoLink('https://otro.com/'))
    expect(next).toHaveLength(MAX_LINKS_POR_BLOQUE)
  })
  it('actualiza titulo, foto y nota de un link', () => {
    const next = actualizarLink(links(2), 1, { titulo: 'Casa Lecanda', nota: 'Centro' })
    expect(next[1].titulo).toBe('Casa Lecanda')
    expect(next[1].nota).toBe('Centro')
    expect(next[0].titulo).toBe('Sitio0')
  })
  it('quita por posicion', () => {
    expect(quitarLink(links(3), 1).map(l => l.sitio)).toEqual(['sitio0.com', 'sitio2.com'])
  })
  it('mueve arriba y abajo, y se queda quieto en los extremos', () => {
    expect(moverLink(links(3), 0, 1).map(l => l.sitio)).toEqual(['sitio1.com', 'sitio0.com', 'sitio2.com'])
    expect(moverLink(links(3), 0, -1).map(l => l.sitio)).toEqual(['sitio0.com', 'sitio1.com', 'sitio2.com'])
    expect(moverLink(links(3), 2, 1).map(l => l.sitio)).toEqual(['sitio0.com', 'sitio1.com', 'sitio2.com'])
  })
})

describe('migracion de los apartados viejos', () => {
  it('cada apartado con links se vuelve un bloque con su nombre', () => {
    const grupos = [
      { id: 'hospedaje', nombre: 'Hospedaje', links: links(2) },
      { id: 'lugares', nombre: 'Qué conocer', links: [] },
      { id: 'vuelos', nombre: 'Vuelos', links: links(1) },
    ]
    expect(bloquesDesdeGrupos(grupos).map(b => [b.titulo, b.links.length])).toEqual([['Hospedaje', 2], ['Vuelos', 1]])
  })
  it('sin apartados con links no genera bloques', () => {
    expect(bloquesDesdeGrupos([{ id: 'a', nombre: 'A', links: [] }])).toEqual([])
    expect(bloquesDesdeGrupos(undefined)).toEqual([])
    expect(bloquesDesdeGrupos('roto')).toEqual([])
  })
})
