import { describe, it, expect } from 'vitest'
import { toE164, formatDisplay, isValidPhone, detectCountry, toWhatsApp, nationalNumber, localeCountry, sinAcentos, componerTelefono, componerDesdeLada, ladaEscrita, paisDeNumero, posicionDelCaret } from './phone'

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
  // Antes devolvia null: la liga ni se armaba. Ahora se arma y quien dice si el
  // numero existe es WhatsApp, no Anfiora. Solo lo que no trae digitos da null.
  it('un numero corto igual arma la liga', () => {
    expect(toWhatsApp('123')).toBe('52123')
  })
  it('sin digitos devuelve null', () => {
    expect(toWhatsApp('hola mundo')).toBeNull()
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

// El planner pone la lada y el numero; Anfiora los pega y los guarda. No opina si
// ese prefijo existe: eso lo sabra cuando WhatsApp no entregue o el telefono no timbre.
describe('componerTelefono', () => {
  it('guarda el numero de Karina bajo la lada de Peru aunque Peru no lo reconozca', () => {
    expect(componerTelefono('663 112 2702', 'PE')).toBe('+516631122702')
  })
  it('guarda el mismo numero bajo una clave de area gringa que no existe', () => {
    expect(componerTelefono('663 112 2702', 'US')).toBe('+16631122702')
  })
  it('compone un numero mexicano normal', () => {
    expect(componerTelefono('81 1234 5678', 'MX')).toBe('+528112345678')
  })
  it('el mas escrito por el usuario gana sobre la lada seleccionada', () => {
    expect(componerTelefono('+51 987 654 321', 'MX')).toBe('+51987654321')
  })
  it('no duplica la lada si el usuario la escribio dentro del numero', () => {
    expect(componerTelefono('52 81 1234 5678', 'MX')).toBe('+528112345678')
  })
  it('sigue arreglando el 1 troncal viejo de Mexico', () => {
    expect(componerTelefono('+5218112345678', 'MX')).toBe('+528112345678')
  })
  it('compone aunque la libreria no reconozca el numero por corto', () => {
    expect(componerTelefono('6', 'MX')).toBe('+526')
  })
  it('rechaza lo que pasa del maximo internacional de 15 digitos', () => {
    expect(componerTelefono('1234567890123456', 'MX')).toBeNull()
  })
  it('basura devuelve null', () => {
    expect(componerTelefono('hola mundo', 'MX')).toBeNull()
  })
  it('vacio devuelve null', () => {
    expect(componerTelefono('', 'MX')).toBeNull()
  })
  it('es idempotente sobre su propia salida', () => {
    const once = componerTelefono('663 112 2702', 'PE')!
    expect(componerTelefono(once, 'MX')).toBe(once)
  })
})

// La plantilla de importacion trae la lada en su propia columna para que Excel
// no se coma el mas.
describe('componerDesdeLada', () => {
  it('pega la lada de la columna con el numero', () => {
    expect(componerDesdeLada('51', '987654321')).toBe('+51987654321')
  })
  it('acepta la lada escrita con mas', () => {
    expect(componerDesdeLada('+1', '3055551234')).toBe('+13055551234')
  })
  it('acepta el nombre del pais en vez de los digitos', () => {
    expect(componerDesdeLada('Peru', '987654321')).toBe('+51987654321')
  })
  it('acepta el nombre del pais con acento', () => {
    expect(componerDesdeLada('España', '612345678')).toBe('+34612345678')
  })
  it('acepta el codigo iso de dos letras', () => {
    expect(componerDesdeLada('PE', '987654321')).toBe('+51987654321')
  })
  it('lada vacia asume Mexico', () => {
    expect(componerDesdeLada('', '8112345678')).toBe('+528112345678')
  })
  it('no duplica la lada si el numero ya la trae', () => {
    expect(componerDesdeLada('51', '51987654321')).toBe('+51987654321')
  })
  it('el mas dentro del telefono gana sobre la columna de lada', () => {
    expect(componerDesdeLada('52', '+51987654321')).toBe('+51987654321')
  })
  it('guarda el numero de Karina con la lada peruana de la plantilla', () => {
    expect(componerDesdeLada('51', '663 112 2702')).toBe('+516631122702')
  })
  it('sin telefono devuelve null aunque traiga lada', () => {
    expect(componerDesdeLada('51', '')).toBeNull()
  })
  it('una lada que no se entiende cae en el pais por defecto', () => {
    expect(componerDesdeLada('marte', '8112345678')).toBe('+528112345678')
  })
})

describe('ladaEscrita', () => {
  it('lee la lada aunque la libreria no pueda nombrar el pais', () => {
    expect(ladaEscrita('+1 663 112 2702')).toBe('+1')
  })
  it('lee una lada normal', () => {
    expect(ladaEscrita('+51 987 654 321')).toBe('+51')
  })
  it('sin mas no hay lada escrita', () => {
    expect(ladaEscrita('663 112 2702')).toBeNull()
  })
  it('vacio devuelve null', () => {
    expect(ladaEscrita('')).toBeNull()
  })
})

describe('toWhatsApp con ladas que la libreria no reconoce', () => {
  it('arma la liga de un numero con lada peruana que Peru no reconoce', () => {
    expect(toWhatsApp('+51 663 112 2702')).toBe('516631122702')
  })
  it('arma la liga de una clave de area gringa que no existe', () => {
    expect(toWhatsApp('+1 663 112 2702')).toBe('16631122702')
  })
})

describe('componerTelefono no acepta una lada sin numero', () => {
  it('una lada sola no es un telefono', () => {
    expect(componerTelefono('+52', 'MX')).toBeNull()
  })
  it('la lada mas texto que no son digitos tampoco', () => {
    expect(componerTelefono('+52 pendiente', 'MX')).toBeNull()
  })
  it('pero la lada mas un digito si se guarda', () => {
    expect(componerTelefono('+526', 'MX')).toBe('+526')
  })
})

describe('componerTelefono con ladas largas fuera de la lista', () => {
  it('la lada de Uzbekistan sola no es un telefono', () => {
    expect(componerTelefono('+998', 'MX')).toBeNull()
  })
  it('esa lada mas digitos si se guarda, aunque el pais no este en el selector', () => {
    expect(componerTelefono('+998 90 123 4567', 'MX')).toBe('+998901234567')
  })
})

describe('paisDeNumero', () => {
  it('resuelve el pais normal', () => {
    expect(paisDeNumero('+528112345678')).toBe('MX')
  })
  it('resuelve Peru aunque el numero no sea peruano de verdad', () => {
    expect(paisDeNumero('+51663112270')).toBe('PE')
  })
  it('resuelve por la lada cuando la libreria no puede nombrar el pais', () => {
    expect(paisDeNumero('+16631122702')).toBe('US')
  })
  it('sin lada no hay pais', () => {
    expect(paisDeNumero('663112270')).toBeNull()
  })
  it('vacio devuelve null', () => {
    expect(paisDeNumero('')).toBeNull()
  })
})

describe('posicionDelCaret', () => {
  it('despues del primer digito', () => {
    expect(posicionDelCaret('81 1234 5678', 1)).toBe(1)
  })
  it('salta el separador que sigue al segundo digito', () => {
    expect(posicionDelCaret('81 1234 5678', 2)).toBe(2)
  })
  it('cuenta digitos, no posiciones', () => {
    // "81 1234 5678": el sexto digito es el 4 del indice 6, el cursor va justo despues
    expect(posicionDelCaret('81 1234 5678', 6)).toBe(7)
  })
  it('al principio va a cero', () => {
    expect(posicionDelCaret('81 1234 5678', 0)).toBe(0)
  })
  it('mas digitos de los que hay se va al final', () => {
    expect(posicionDelCaret('81 1234', 99)).toBe(7)
  })
  it('texto vacio', () => {
    expect(posicionDelCaret('', 3)).toBe(0)
  })
})
