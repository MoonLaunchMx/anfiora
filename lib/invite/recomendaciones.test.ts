import { describe, it, expect } from 'vitest'
import {
  normalizarUrl, sitioDeUrl, tituloDeRespaldo, nuevoLink,
  gruposVisibles, mostrarEtiquetas,
  agregarLink, actualizarLink, quitarLink, moverLink,
  agregarApartado, quitarApartado, renombrarApartado,
  MAX_APARTADOS, MAX_LINKS_POR_APARTADO,
  type RecoGrupo,
} from './recomendaciones'

const grupo = (id: string, n: number): RecoGrupo => ({
  id,
  nombre: id,
  links: Array.from({ length: n }, (_, i) => nuevoLink(`https://sitio${i}.com/`)),
})

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
    expect(nuevoLink('https://www.aeromexico.com/vuelos')).toEqual({
      url: 'https://www.aeromexico.com/vuelos', titulo: 'Aeromexico', sitio: 'aeromexico.com', imagen: '', nota: '',
    })
  })
})

describe('que se muestra en la invitacion', () => {
  it('un apartado sin links no se muestra', () => {
    const grupos = [grupo('hospedaje', 2), grupo('lugares', 0), grupo('vuelos', 1)]
    expect(gruposVisibles(grupos).map(g => g.id)).toEqual(['hospedaje', 'vuelos'])
  })
  it('con un solo apartado con links no se pintan las etiquetas', () => {
    expect(mostrarEtiquetas([grupo('vuelos', 2), grupo('lugares', 0)])).toBe(false)
    expect(mostrarEtiquetas([grupo('vuelos', 2), grupo('lugares', 1)])).toBe(true)
  })
  it('sin links no hay nada visible', () => {
    expect(gruposVisibles([grupo('a', 0)])).toEqual([])
    expect(mostrarEtiquetas([grupo('a', 0)])).toBe(false)
  })
})

describe('editar links', () => {
  it('agrega al final del apartado correcto', () => {
    const grupos = [grupo('hospedaje', 1), grupo('vuelos', 0)]
    const next = agregarLink(grupos, 'vuelos', nuevoLink('https://aeromexico.com/'))
    expect(next[1].links.map(l => l.sitio)).toEqual(['aeromexico.com'])
    expect(next[0].links).toHaveLength(1)
  })
  it('no pasa del tope de links por apartado', () => {
    const lleno = [grupo('hospedaje', MAX_LINKS_POR_APARTADO)]
    const next = agregarLink(lleno, 'hospedaje', nuevoLink('https://otro.com/'))
    expect(next[0].links).toHaveLength(MAX_LINKS_POR_APARTADO)
  })
  it('actualiza titulo, foto y nota de un link', () => {
    const next = actualizarLink([grupo('hospedaje', 2)], 'hospedaje', 1, { titulo: 'Casa Lecanda', nota: 'Centro' })
    expect(next[0].links[1].titulo).toBe('Casa Lecanda')
    expect(next[0].links[1].nota).toBe('Centro')
    expect(next[0].links[0].titulo).toBe('Sitio0')
  })
  it('quita y mueve sin tocar los demas apartados', () => {
    const grupos = [grupo('hospedaje', 3), grupo('vuelos', 2)]
    expect(quitarLink(grupos, 'hospedaje', 1)[0].links.map(l => l.sitio)).toEqual(['sitio0.com', 'sitio2.com'])
    expect(moverLink(grupos, 'hospedaje', 0, 1)[0].links.map(l => l.sitio)).toEqual(['sitio1.com', 'sitio0.com', 'sitio2.com'])
    expect(moverLink(grupos, 'hospedaje', 0, -1)[0].links.map(l => l.sitio)).toEqual(['sitio0.com', 'sitio1.com', 'sitio2.com'])
    expect(moverLink(grupos, 'hospedaje', 2, 1)[0].links).toHaveLength(3)
    expect(quitarLink(grupos, 'hospedaje', 1)[1].links).toHaveLength(2)
  })
})

describe('editar apartados', () => {
  it('agrega, renombra y quita', () => {
    const grupos = agregarApartado([grupo('hospedaje', 1)], 'g2', 'Transporte')
    expect(grupos.map(g => g.nombre)).toEqual(['hospedaje', 'Transporte'])
    expect(renombrarApartado(grupos, 'g2', 'Traslados')[1].nombre).toBe('Traslados')
    expect(quitarApartado(grupos, 'hospedaje').map(g => g.id)).toEqual(['g2'])
  })
  it('no pasa del tope de apartados', () => {
    const llenos = Array.from({ length: MAX_APARTADOS }, (_, i) => grupo(`g${i}`, 0))
    expect(agregarApartado(llenos, 'extra')).toHaveLength(MAX_APARTADOS)
  })
})
