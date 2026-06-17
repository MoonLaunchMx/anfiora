const STORAGE_KEY = 'anfiora_attr_v1'

export interface Attribution {
  acquisition_source: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  referrer_domain: string | null
  device_type: string
  acquired_at: string
}

function detectDevice(ua: string): string {
  const s = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/.test(s)) return 'tablet'
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/.test(s)) return 'movil'
  return 'desktop'
}

function deriveSource(params: URLSearchParams, referrerDomain: string | null, path: string): string {
  const utmSource = (params.get('utm_source') || '').toLowerCase()

  if (params.has('fbclid') || ['meta', 'facebook', 'fb', 'instagram', 'ig'].includes(utmSource)) return 'meta'
  if (params.has('gclid') || ['google', 'gads', 'adwords'].includes(utmSource)) return 'google'

  if (/^\/(invite|playlist|album)\//.test(path)) return 'viral'

  if (referrerDomain) {
    if (/google|bing|duckduckgo|yahoo|ecosia/.test(referrerDomain)) return 'organico'
    if (/facebook|instagram|t\.co|twitter|x\.com|tiktok|linkedin|youtube/.test(referrerDomain)) return 'organico'
    return 'referido'
  }
  return 'directo'
}

export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(STORAGE_KEY)) return

    const params = new URLSearchParams(window.location.search)
    const path = window.location.pathname

    let referrerDomain: string | null = null
    try {
      if (document.referrer) {
        const u = new URL(document.referrer)
        if (u.hostname && u.hostname !== window.location.hostname) {
          referrerDomain = u.hostname.replace(/^www\./, '')
        }
      }
    } catch { /* referrer invalido, lo ignoramos */ }

    const attr: Attribution = {
      acquisition_source: deriveSource(params, referrerDomain, path),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      referrer_domain: referrerDomain,
      device_type: detectDevice(navigator.userAgent),
      acquired_at: new Date().toISOString(),
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(attr))
  } catch { /* localStorage bloqueado o lleno, no rompemos nada */ }
}

export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Attribution) : null
  } catch {
    return null
  }
}
