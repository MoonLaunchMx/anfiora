import { describe, it, expect } from 'vitest'
import { toE164, formatDisplay, isValidPhone, detectCountry, toWhatsApp, nationalNumber, localeCountry, sinAcentos } from './phone'

describe('toE164', () => {
  it('MX local sin lada asume +52', () => {
    expect(toE164('81 1234 5678')).toBe('+528112345678')
  })
  it('MX con lada explicita', () => {
    expect(toE164('+52 81 1234 5678')).toBe('+528112345678')
  })
  it('MX legacy con el 1 troncal viejo se normaliza (espaciado)', () => {
    expect(toE164('+521 81 1234 5678')).toBe('+528112345678')
  })
  it('MX legacy con el 1 troncal viejo se normaliza (pegado sin +)', () => {
    expect(toE164('5218112345678')).toBe('+528112345678')
  })
  it('MX legacy con el 1 troncal viejo se normaliza (pegado con +)', () => {
    expect(toE164('+5218112345678')).toBe('+528112345678')
  })
  it('acepta guiones y parentesis', () => {
    expect(toE164('(81) 1234-5678')).toBe('+528112345678')
  })
  it('pegado internacional Colombia respeta su lada', () => {
    expect(toE164('+57 301 234 5678')).toBe('+573012345678')
  })
  it('basura devuelve null', () => {
    expect(toE164('hola mundo')).toBeNull()
  })
  it('vacio devuelve null', () => {
    expect(toE164('')).toBeNull()
  })
  it('es idempotente sobre su propia salida', () => {
    const once = toE164('81 1234 5678')!
    expect(toE164(once)).toBe(once)
  })
})

describe('toWhatsApp', () => {
  it('arma los digitos sin + desde texto local', () => {
    expect(toWhatsApp('81 1234 5678')).toBe('528112345678')
  })
  it('arma los digitos desde E.164 ya guardado', () => {
    expect(toWhatsApp('+528112345678')).toBe('528112345678')
  })
  it('numero imposible devuelve null', () => {
    expect(toWhatsApp('123')).toBeNull()
  })
  it('normaliza el 1 troncal viejo MX igual que toE164', () => {
    expect(toWhatsApp('+5218112345678')).toBe('528112345678')
  })
})

describe('isValidPhone', () => {
  it('numero MX valido', () => {
    expect(isValidPhone('81 1234 5678', 'MX')).toBe(true)
  })
  it('demasiado corto no es valido', () => {
    expect(isValidPhone('123', 'MX')).toBe(false)
  })
})

describe('detectCountry', () => {
  it('detecta pais desde numero internacional pegado', () => {
    expect(detectCountry('+57 301 234 5678')).toBe('CO')
  })
  it('sin lada no detecta', () => {
    expect(detectCountry('81 1234 5678')).toBeNull()
  })
})

describe('formatDisplay', () => {
  it('formatea E.164 a internacional legible', () => {
    expect(formatDisplay('+528112345678')).toBe('+52 81 1234 5678')
  })
  it('entrada invalida devuelve el crudo sin reventar', () => {
    expect(formatDisplay('no-es-numero')).toBe('no-es-numero')
  })
})

describe('nationalNumber', () => {
  it('extrae digitos nacionales de un numero US', () => {
    expect(nationalNumber('+15551234567')).toBe('5551234567')
  })
  it('extrae digitos nacionales de un numero MX', () => {
    expect(nationalNumber('+528112345678')).toBe('8112345678')
  })
  it('numero local sin lada devuelve solo digitos', () => {
    expect(nationalNumber('81 1234 5678')).toBe('8112345678')
  })
  it('vacio devuelve cadena vacia', () => {
    expect(nationalNumber('')).toBe('')
  })
})

describe('localeCountry', () => {
  it('saca el pais del locale del navegador', () => {
    expect(localeCountry('es-ES')).toBe('ES')
    expect(localeCountry('es-MX')).toBe('MX')
    expect(localeCountry('en-US')).toBe('US')
  })
  it('aguanta el guion bajo y los locales con variante', () => {
    expect(localeCountry('es_ES')).toBe('ES')
    expect(localeCountry('ca-ES-valencia')).toBe('ES')
  })
  it('sin region no adivina', () => {
    expect(localeCountry('es')).toBe(null)
    expect(localeCountry('')).toBe(null)
    expect(localeCountry(null)).toBe(null)
    expect(localeCountry(undefined)).toBe(null)
  })
  it('una region que no esta en la lista no se inventa (cae al default de quien llama)', () => {
    expect(localeCountry('es-419')).toBe(null)
    expect(localeCountry('ja-JP')).toBe(null)
  })
})

describe('sinAcentos', () => {
  it('quien escribe Espana con enye encuentra Espana', () => {
    expect(sinAcentos('España')).toBe('espana')
    expect(sinAcentos('Espana').includes(sinAcentos('España'))).toBe(true)
  })
  it('quita acentos y baja a minusculas', () => {
    expect(sinAcentos('MÉXICO')).toBe('mexico')
    expect(sinAcentos('Perú')).toBe('peru')
  })
  it('un texto sin acentos no cambia mas que el case', () => {
    expect(sinAcentos('Brasil')).toBe('brasil')
  })
})
