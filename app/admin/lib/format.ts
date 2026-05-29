export function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return 'hace ' + mins + ' min'
  if (hours < 24) return 'hace ' + hours + 'h'
  if (days < 7) return 'hace ' + days + 'd'
  return formatDate(iso)
}

export const PLAN_STYLES: Record<string, string> = {
  free:   'bg-[#f0f0f0] text-[#666]',
  pro:    'bg-[#e8faf6] text-[#1a7a60]',
  agency: 'bg-[#fff3cd] text-[#856404]',
}
