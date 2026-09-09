export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function isCompleteDateInput(raw: string): boolean {
  return raw.replace(/\D/g, '').length === 8
}

export function parseTypedDate(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4))
  if (month < 1 || month > 12 || day < 1 || year < 1900) return null
  const date = new Date(year, month - 1, day)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatTypedDate(ymd: string): string {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('T')[0].split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}
