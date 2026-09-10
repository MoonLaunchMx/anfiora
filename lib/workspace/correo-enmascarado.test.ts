import { describe, it, expect } from 'vitest'
import { enmascararCorreo } from './correo-enmascarado'

describe('enmascararCorreo', () => {
  it('deja la primera y la ultima letra, y el dominio entero', () => {
    expect(enmascararCorreo('ana.lopez@gmail.com')).toBe('a•••z@gmail.com')
    expect(enmascararCorreo('mariajose.grdz90@gmail.com')).toBe('m•••0@gmail.com')
    expect(enmascararCorreo('diego.garza@moonlaunch.mx')).toBe('d•••a@moonlaunch.mx')
  })

  it('con dos letras sigue habiendo primera y ultima', () => {
    expect(enmascararCorreo('jl@moonlaunch.mx')).toBe('j•••l@moonlaunch.mx')
  })

  it('con una sola letra no se repite esa letra', () => {
    expect(enmascararCorreo('a@gmail.com')).toBe('a•••@gmail.com')
  })

  it('el largo del usuario no se filtra: siempre son tres puntos', () => {
    const corto = enmascararCorreo('ab@x.com')
    const largo = enmascararCorreo('abcdefghijklmnop@x.com')
    expect(corto.split('@')[0].length).toBe(largo.split('@')[0].length)
  })

  it('respeta el subdominio y el arroba final del dominio', () => {
    expect(enmascararCorreo('ana@correo.empresa.com.mx')).toBe('a•••a@correo.empresa.com.mx')
  })

  it('con varias arrobas parte por la ultima', () => {
    expect(enmascararCorreo('raro@cosa@gmail.com')).toBe('r•••a@gmail.com')
  })

  it('lo que no es correo se enmascara entero, nunca se enseña', () => {
    expect(enmascararCorreo('sinarroba')).toBe('•••')
    expect(enmascararCorreo('@gmail.com')).toBe('•••')
    expect(enmascararCorreo('ana@')).toBe('•••')
  })

  it('vacio o nulo no revienta', () => {
    expect(enmascararCorreo('')).toBe('')
    expect(enmascararCorreo('   ')).toBe('')
    expect(enmascararCorreo(undefined as unknown as string)).toBe('')
  })

  it('quita espacios de sobra', () => {
    expect(enmascararCorreo('  ana.lopez@gmail.com  ')).toBe('a•••z@gmail.com')
  })
})
