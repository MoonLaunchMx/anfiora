export function formatFecha(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function formatHora(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}
