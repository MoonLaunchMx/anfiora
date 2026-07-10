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
  { iso: 'US', name: 'Estados Unidos' },
]

export const COUNTRIES: { iso: CountryCode; name: string; dial: string }[] =
  COUNTRY_ISOS
    .filter((c, i, arr) => arr.findIndex(x => x.iso === c.iso) === i)
    .map(c => ({ ...c, dial: `+${getCountryCallingCode(c.iso)}` }))

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

export function toWhatsApp(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  const e164 = toE164(raw, defaultCountry)
  if (!e164) return null
  return e164.replace(/\D/g, '')
}

export function formatAsYouType(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
  return new AsYouType(country).input(raw)
}
