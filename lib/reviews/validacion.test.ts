import { describe, it, expect } from 'vitest'
import { validarReview } from './validacion'
import type { BorradorReview } from './validacion'

const vacio: BorradorReview = {
  review_type: 'contratacion',
  precio_valor: null, calidad: null, comunicacion: null,
  servicio_trato: null, manejo_imprevistos: null,
  razones_seleccion: [], motivo_descarte: null,
  recontratacion: null, cobros_extra: null, comentarios: null,
}

describe('review de contratacion', () => {
  it('exige los tres ejes de propuesta', () => {
    const problemas = validarReview({ ...vacio, razones_seleccion: ['precio'] })
    expect(problemas.join(' ')).toContain('Califica la propuesta')
  })

  it('razones_seleccion en null cuenta igual que vacio: falta contestar', () => {
    const problemas = validarReview({
      ...vacio, precio_valor: 4, calidad: 4, comunicacion: 4,
      razones_seleccion: null,
    })
    expect(problemas.join(' ')).toContain('por qué')
  })

  it('exige al menos una razon', () => {
    const problemas = validarReview({
      ...vacio, precio_valor: 4, calidad: 4, comunicacion: 4,
    })
    expect(problemas.join(' ')).toContain('por qué')
  })

  it('no acepta mas de dos razones', () => {
    const problemas = validarReview({
      ...vacio, precio_valor: 4, calidad: 4, comunicacion: 4,
      razones_seleccion: ['precio', 'calidad', 'estilo'],
    })
    expect(problemas.join(' ')).toContain('máximo dos')
  })

  it('pasa con los tres ejes y una razon', () => {
    expect(validarReview({
      ...vacio, precio_valor: 4, calidad: 5, comunicacion: 3,
      razones_seleccion: ['precio'],
    })).toEqual([])
  })
})

describe('review de descarte', () => {
  const base: BorradorReview = { ...vacio, review_type: 'descarte' }

  it('exige el motivo', () => {
    expect(validarReview(base).join(' ')).toContain('por qué lo descartamos')
  })

  it('con solo el motivo ya se puede guardar', () => {
    expect(validarReview({ ...base, motivo_descarte: 'disponibilidad' })).toEqual([])
  })

  it('acepta los tres ejes si los llenaron', () => {
    expect(validarReview({
      ...base, motivo_descarte: 'precio',
      precio_valor: 2, calidad: 3, comunicacion: 4,
    })).toEqual([])
  })

  it('rechaza calificar a medias: o los tres o ninguno', () => {
    const problemas = validarReview({
      ...base, motivo_descarte: 'precio', precio_valor: 2,
    })
    expect(problemas.join(' ')).toContain('los tres')
  })
})

describe('review post evento', () => {
  const base: BorradorReview = {
    ...vacio, review_type: 'post_evento',
    precio_valor: 4, calidad: 4, comunicacion: 4,
    servicio_trato: 4, manejo_imprevistos: 4,
    recontratacion: 5, cobros_extra: false,
  }

  it('pasa con los cinco ejes, recontratacion y el flag', () => {
    expect(validarReview(base)).toEqual([])
  })

  it('acepta imprevistos en null porque no aplico', () => {
    expect(validarReview({ ...base, manejo_imprevistos: null })).toEqual([])
  })

  it('no acepta que falte servicio y trato', () => {
    expect(validarReview({ ...base, servicio_trato: null }).join(' '))
      .toContain('Califica el desempeño')
  })

  it('exige contestar si lo volverias a contratar', () => {
    expect(validarReview({ ...base, recontratacion: null }).join(' '))
      .toContain('volverías a contratar')
  })

  it('exige contestar el flag de cobros extra', () => {
    expect(validarReview({ ...base, cobros_extra: null }).join(' '))
      .toContain('cobros extra')
  })
})

describe('comentarios', () => {
  it('rechaza pasarse de 500 caracteres', () => {
    const problemas = validarReview({
      ...vacio, precio_valor: 4, calidad: 4, comunicacion: 4,
      razones_seleccion: ['precio'], comentarios: 'x'.repeat(501),
    })
    expect(problemas.join(' ')).toContain('500')
  })
})
