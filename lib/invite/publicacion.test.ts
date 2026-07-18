import { describe, it, expect } from 'vitest'
import { hayCambiosSinPublicar, estadoPublicacion } from './publicacion'
import { defaultDoc, setMeta, setTheme } from './doc'

// makeId estable: draft y config parten del mismo doc, mismos ids de seccion.
const mk = (() => { let i = 0; return () => `s${i++}` })()
const borrador = defaultDoc(mk)            // publicada = false
const publicado = setMeta(borrador, { publicada: true })

describe('estadoPublicacion', () => {
  it('sin publicar nunca es cambios, aunque el borrador difiera', () => {
    const draft = setMeta(borrador, { fecha_limite: '2026-08-01' })
    expect(estadoPublicacion(draft, borrador)).toBe('borrador')
  })

  it('publicado y sincronizado es publicada', () => {
    expect(estadoPublicacion(publicado, publicado)).toBe('publicada')
  })

  it('publicado con el borrador distinto es cambios', () => {
    const draft = setMeta(publicado, { fecha_limite: '2026-08-01' })
    expect(estadoPublicacion(draft, publicado)).toBe('cambios')
  })
})

describe('hayCambiosSinPublicar', () => {
  it('dos documentos identicos no tienen cambios', () => {
    expect(hayCambiosSinPublicar(publicado, publicado)).toBe(false)
  })

  it('un cambio de fecha limite cuenta como cambio', () => {
    const draft = setMeta(publicado, { fecha_limite: '2026-08-01' })
    expect(hayCambiosSinPublicar(draft, publicado)).toBe(true)
  })

  it('un cambio de tema cuenta como cambio', () => {
    const draft = setTheme(publicado, { colores: { fondo: '#123456' } })
    expect(hayCambiosSinPublicar(draft, publicado)).toBe(true)
  })

  it('la bandera de publicacion NO cuenta como cambio de contenido', () => {
    const draft = setMeta(publicado, { publicada: false })
    expect(hayCambiosSinPublicar(draft, publicado)).toBe(false)
  })

  it('el orden de las llaves del JSON no genera un falso cambio', () => {
    const reordenado = JSON.parse(JSON.stringify(publicado))
    expect(hayCambiosSinPublicar(reordenado, publicado)).toBe(false)
  })

  it('un borrador vacio contra el default no inventa cambios', () => {
    expect(hayCambiosSinPublicar(null, null)).toBe(false)
  })

  it('un cambio en meta.access (precio) cuenta como cambio', () => {
    const draft = setMeta(publicado, { access: { ...publicado.meta.access, ticket_price: 500 } })
    expect(hayCambiosSinPublicar(draft, publicado)).toBe(true)
  })

  it('el mismo meta.access con llaves en otro orden no genera un falso cambio', () => {
    const conAccess = setMeta(publicado, {
      access: { guest_cap: 100, ticket_price: 250, max_companions: 2, cobro_payment_methods: [] },
    })
    const reordenado = JSON.parse(JSON.stringify(conAccess))
    reordenado.meta.access = {
      cobro_payment_methods: [],
      max_companions: 2,
      ticket_price: 250,
      guest_cap: 100,
    }
    expect(hayCambiosSinPublicar(reordenado, conAccess)).toBe(false)
  })
})
