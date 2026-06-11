import { NextRequest, NextResponse } from 'next/server'

// Lee metadatos (Open Graph / JSON-LD) de un link de tienda para auto-rellenar
// un regalo. Server-side porque el browser no puede por CORS.

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true
  // IPs privadas / loopback / link-local / metadata
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd')) return true
  return false
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // property/name antes de content
    let m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*?content=["']([^"']+)["']`, 'i'))
    if (m?.[1]) return m[1]
    // content antes de property/name
    m = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${k}["']`, 'i'))
    if (m?.[1]) return m[1]
  }
  return null
}

function decode(s: string | null): string | null {
  if (!s) return null
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ').trim()
}

function priceFromJsonLd(html: string): number | null {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (!blocks) return null
  for (const block of blocks) {
    const json = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim()
    try {
      const data = JSON.parse(json)
      const nodes = Array.isArray(data) ? data : [data]
      for (const node of nodes) {
        const offers = node?.offers
        const offer = Array.isArray(offers) ? offers[0] : offers
        const price = offer?.price ?? offer?.lowPrice ?? node?.price
        if (price != null) {
          const n = parseFloat(String(price).replace(/[^0-9.]/g, ''))
          if (!isNaN(n) && n > 0) return n
        }
      }
    } catch { /* ignore malformed ld+json */ }
  }
  return null
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Falta url' }, { status: 400 })

  let target: URL
  try { target = new URL(raw) } catch { return NextResponse.json({ error: 'URL invalida' }, { status: 400 }) }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Protocolo no permitido' }, { status: 400 })
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: 'Host no permitido' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnfioraBot/1.0; +https://anfiora.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return NextResponse.json({ error: 'No se pudo leer la pagina' }, { status: 200 })

    // Solo HTML, cap a ~512KB
    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('text/html')) return NextResponse.json({ ok: false }, { status: 200 })
    const buf = await res.arrayBuffer()
    const html = new TextDecoder('utf-8').decode(buf.slice(0, 512 * 1024))

    const title =
      decode(metaContent(html, ['og:title', 'twitter:title'])) ||
      decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null)

    let image = decode(metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']))
    if (image && image.startsWith('//')) image = target.protocol + image
    if (image && image.startsWith('/')) image = target.origin + image

    const store = decode(metaContent(html, ['og:site_name'])) ||
      target.hostname.replace(/^www\./, '').split('.')[0].replace(/^\w/, c => c.toUpperCase())

    const priceMeta = metaContent(html, ['product:price:amount', 'og:price:amount', 'twitter:data1'])
    let price: number | null = priceMeta ? parseFloat(priceMeta.replace(/[^0-9.]/g, '')) : null
    if (price == null || isNaN(price) || price <= 0) price = priceFromJsonLd(html)
    if (price != null && (isNaN(price) || price <= 0)) price = null

    return NextResponse.json({ ok: true, title, image, store, price }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
