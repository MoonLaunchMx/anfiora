import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  AsYouType,
  type CountryCode,
} from 'libphonenumber-js'

export type { CountryCode }

export const DEFAULT_COUNTRY: CountryCode = 'MX'

// Lista para el selector de pais (MX primero, luego America y Europa).
// El dial se deriva de libphonenumber para no mantenerlo a mano.
const COUNTRY_ISOS: { iso: CountryCode; name: string }[] = [
  { iso: 'MX', name: 'Mexico' },
  { iso: 'US', name: 'USA / Canada' },
  { iso: 'AR', name: 'Argentina' },
  { iso: 'BO', name: 'Bolivia' },
  { iso: 'BR', name: 'Brasil' },
  { iso: 'CL', name: 'Chile' },
  { iso: 'CO', name: 'Colombia' },
  { iso: 'CR', name: 'Costa Rica' },
  { iso: 'CU', name: 'Cuba' },
  { iso: 'EC', name: 'Ecuador' },
  { iso: 'SV', name: 'El Salvador' },
  { iso: 'GT', name: 'Guatemala' },
  { iso: 'HN', name: 'Honduras' },
  { iso: 'NI', name: 'Nicaragua' },
  { iso: 'PA', name: 'Panama' },
  { iso: 'PY', name: 'Paraguay' },
  { iso: 'PE', name: 'Peru' },
  { iso: 'UY', name: 'Uruguay' },
  { iso: 'VE', name: 'Venezuela' },
  { iso: 'ES', name: 'Espana' },
  { iso: 'DE', name: 'Alemania' },
  { iso: 'FR', name: 'Francia' },
  { iso: 'IT', name: 'Italia' },
  { iso: 'PT', name: 'Portugal' },
  { iso: 'GB', name: 'Reino Unido' },
]

export const COUNTRIES: { iso: CountryCode; name: string; dial: string }[] =
  COUNTRY_ISOS.map(c => ({ ...c, dial: `+${getCountryCallingCode(c.iso)}` }))

const ISOS_SOPORTADOS = new Set<string>(COUNTRY_ISOS.map(c => c.iso))

// El pais que sugiere el navegador del visitante ('es-ES' -> ES). En una puerta
// publica el default fijo a Mexico obliga a TODOS los demas a corregir el
// selector antes de poder escribir su numero; con esto cada quien arranca en el
// suyo. Devuelve null si el locale no trae region o no la tenemos en la lista.
export function localeCountry(locale: string | null | undefined): CountryCode | null {
  if (!locale) return null
  const partes = locale.replace(/_/g, '-').split('-')
  for (const parte of partes.slice(1)) {
    const iso = parte.toUpperCase()
    if (/^[A-Z]{2}$/.test(iso) && ISOS_SOPORTADOS.has(iso)) return iso as CountryCode
  }
  return null
}

// Para buscar paises sin pelearse con los acentos: quien escribe "España" debe
// encontrar "Espana".
export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

// Lada de cualquier pais (aunque no este en COUNTRIES); vacio si el ISO no es valido.
export function dialCode(iso: CountryCode): string {
  try {
    return `+${getCountryCallingCode(iso)}`
  } catch {
    return ''
  }
}

export function toE164(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  if (!raw || !raw.trim()) return null
  let parsed = parsePhoneNumberFromString(raw.trim(), defaultCountry)
  if (!parsed || !parsed.isPossible()) {
    // Mexico retiro el "1" troncal de moviles en 2019; libphonenumber ya no lo acepta.
    // Muchos contactos viejos y exports de WhatsApp aun traen +521 + 10 digitos.
    const digits = raw.replace(/\D/g, '')
    if (/^521\d{10}$/.test(digits)) {
      parsed = parsePhoneNumberFromString('+52' + digits.slice(3), defaultCountry)
    }
  }
  if (!parsed || !parsed.isPossible()) return null
  return parsed.number
}

export function formatDisplay(value: string): string {
  if (!value || !value.trim()) return ''
  const parsed = parsePhoneNumberFromString(value.trim())
  if (!parsed) return value
  return parsed.formatInternational()
}

export function isValidPhone(raw: string, country: CountryCode = DEFAULT_COUNTRY): boolean {
  if (!raw || !raw.trim()) return false
  const parsed = parsePhoneNumberFromString(raw.trim(), country)
  return !!parsed && parsed.isValid()
}

export function detectCountry(raw: string): CountryCode | null {
  if (!raw || !raw.trim()) return null
  const parsed = parsePhoneNumberFromString(raw.trim())
  return parsed?.country ?? null
}

// Abrir WhatsApp es una accion del planner, no un candado: se arma la liga con lo
// que haya y que WhatsApp diga si el numero existe. Antes un numero con lada rara
// no alcanzaba a abrir la conversacion.
export function toWhatsApp(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  const e164 = componerTelefono(raw, defaultCountry)
  if (!e164) return null
  return e164.replace(/\D/g, '')
}

export function formatAsYouType(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
  return new AsYouType(country).input(raw)
}

// Digitos nacionales (sin lada) de un numero; para re-interpretar bajo otro pais.
export function nationalNumber(raw: string): string {
  if (!raw || !raw.trim()) return ''
  const parsed = parsePhoneNumberFromString(raw.trim())
  if (parsed) return parsed.nationalNumber
  return raw.replace(/\D/g, '')
}

const MAX_E164_DIGITS = 15

// Mexico retiro el "1" troncal de moviles en 2019; libphonenumber ya no lo acepta,
// pero contactos viejos y exports de WhatsApp aun traen +521 + 10 digitos.
function sinTroncalMx(digitos: string): string {
  return /^521\d{10}$/.test(digitos) ? '52' + digitos.slice(3) : digitos
}

// Pega la lada con el numero y lo devuelve en E.164. NO opina si ese prefijo
// existe en el mundo: quien sabe si un numero sirve es el planner cuando marca o
// cuando WhatsApp no entrega, no la metadata de una libreria que siempre va atras
// de las asignaciones reales. Lo unico que rechaza es lo que no cabe en E.164.
// Para candados sobre entrada no confiable (la puerta publica) sigue estando toE164.
export function componerTelefono(raw: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  if (!raw || !raw.trim()) return null
  const texto = raw.trim()
  const digitos = sinTroncalMx(texto.replace(/\D/g, ''))
  if (!digitos || digitos.length > MAX_E164_DIGITS) return null
  // Una lada sola no es un telefono: no hay a quien marcar. AsYouType sabe donde
  // termina la lada aun en numeros que no reconoce, asi que se pregunta en vez de
  // adivinar por largo. Esto no es opinar si el numero existe, es notar que no hay
  // numero del suscriptor.
  if (texto.startsWith('+')) {
    const ayt = new AsYouType()
    ayt.input('+' + digitos)
    const lada = ayt.getCallingCode()
    if (lada && digitos.length <= lada.length) return null
  }

  // Mientras la libreria entienda el numero se usa su lectura, que sabe quitar
  // prefijos troncales y no duplicar la lada. Cuando no lo entiende no se rechaza:
  // se pega la lada del selector a mano.
  const parsed = parsePhoneNumberFromString(texto.startsWith('+') ? '+' + digitos : texto, country)
  if (parsed) return parsed.number
  if (texto.startsWith('+')) return '+' + digitos

  const total = getCountryCallingCode(country) + digitos
  return total.length > MAX_E164_DIGITS ? null : '+' + total
}

// La lada de la plantilla: digitos ("51", "+51", "0051") o el nombre del pais
// ("Peru", "España", "PE"). Vacio o irreconocible devuelve null y manda al default.
function ladaADigitos(lada: string): string | null {
  const texto = (lada || '').trim()
  if (!texto) return null
  const digitos = texto.replace(/^\+/, '').replace(/^00/, '')
  if (/^\d{1,4}$/.test(digitos)) return digitos
  const norm = sinAcentos(texto)
  const pais = COUNTRIES.find(c => sinAcentos(c.name) === norm || sinAcentos(c.iso) === norm)
  return pais ? pais.dial.replace('+', '') : null
}

// Importacion: la lada vive en su propia columna porque Excel trata cualquier celda
// que empieza con "+" como formula y se lo come.
export function componerDesdeLada(
  lada: string,
  telefono: string,
  porDefecto: CountryCode = DEFAULT_COUNTRY
): string | null {
  const tel = (telefono || '').trim()
  if (!tel) return null
  if (tel.startsWith('+')) return componerTelefono(tel, porDefecto)

  const dial = ladaADigitos(lada)
  if (!dial) return componerTelefono(tel, porDefecto)

  let digitos = tel.replace(/\D/g, '')
  if (!digitos) return null
  // Hay quien escribe la lada en las dos columnas; no se duplica.
  if (digitos.startsWith(dial) && digitos.length - dial.length >= 6) digitos = digitos.slice(dial.length)
  return componerTelefono('+' + dial + digitos, porDefecto)
}

// La lada que el propio numero trae escrita. El selector la usa para no mentir:
// cuando libphonenumber no puede nombrar el pais (+1 663 no es una clave de area
// asignada), antes caia en Mexico y el boton decia +52 sobre un numero que
// empieza con +1. Devuelve null si el numero no trae lada explicita.
export function ladaEscrita(raw: string): string | null {
  const texto = (raw || '').trim()
  if (!texto.startsWith('+')) return null
  const parsed = parsePhoneNumberFromString(texto)
  return parsed?.countryCallingCode ? '+' + parsed.countryCallingCode : null
}

// El pais al que pertenece un numero ya guardado. Si libphonenumber no puede
// nombrarlo (+1 663 no es una clave de area asignada) se resuelve por la lada
// contra la lista del selector. Sirve para que el campo no ensene la lada dos
// veces, una en el boton y otra dentro del texto.
export function paisDeNumero(raw: string): CountryCode | null {
  const directo = detectCountry(raw)
  if (directo) return directo
  const lada = ladaEscrita(raw)
  if (!lada) return null
  return COUNTRIES.find(c => c.dial === lada)?.iso ?? null
}

// A donde vuelve el cursor despues de reformatear. El campo se re-escribe en cada
// tecla, y sin esto el navegador manda el cursor al FINAL: borrar un digito de
// enmedio se volvia imposible. Se cuenta por digitos, no por posicion, porque los
// separadores se mueven solos al reformatear.
export function posicionDelCaret(texto: string, digitosAntes: number): number {
  if (digitosAntes <= 0) return 0
  let vistos = 0
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] >= '0' && texto[i] <= '9') {
      vistos++
      if (vistos === digitosAntes) return i + 1
    }
  }
  return texto.length
}
