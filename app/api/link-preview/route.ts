import { NextRequest, NextResponse } from 'next/server'

// Lee metadatos (Open Graph / JSON-LD / slug) de un link de tienda para
// auto-rellenar un regalo. Server-side porque el browser no puede por CORS.

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd')) return true
  return false
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let m = html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*?content=["']([^"']+)["']`, 'i'))
    if (m?.[1]) return m[1]
    m = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name|itemprop)=["']${k}["']`, 'i'))
    if (m?.[1]) return m[1]
  }
  return null
}

function decode(s: string | null): string | null {
  if (!s) return null
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function toNumber(raw: string | null): number | null {
  if (!raw) return null
  // quita simbolos y separadores de miles (coma); deja el punto decimal
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '')
  const n = parseFloat(cleaned)
  return !isNaN(n) && n > 0 ? n : null
}

// Nombre del producto desde el slug del URL (ej. ML: /MLM-123-cafetera-...-_JM)
function titleFromSlug(u: URL): string | null {
  const seg = u.pathname.split('/').filter(Boolean).pop()
  if (!seg) return null
  let s = decodeURIComponent(seg)
    .replace(/\.(html?|php|aspx?)$/i, '')
    .replace(/_JM$/i, '')
    .replace(/^ML[A-Z]-?\d+-?/i, '')
    .replace(/^(dp|gp|p|item)[-/]?/i, '')
    .replace(/[-_+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length < 3 || /^\d+$/.test(s)) return null
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Marca del host ignorando subdominios y TLDs: articulo.mercadolibre.com.mx -> mercadolibre
function brandFromHost(hostname: string): string {
  const skip = new Set(['www', 'com', 'mx', 'net', 'org', 'co', 'io', 'shop', 'store'])
  const labels = hostname.toLowerCase().split('.').filter(l => !skip.has(l))
  return labels.pop() || ''
}

// Recorta sufijos de tienda en el titulo ("Producto : Amazon.com.mx: Electronicos",
// "Producto | Liverpool"): corta desde el separador donde aparece la marca del host
// o el og:site_name. Si lo recortado queda demasiado corto, conserva el original.
function cleanTitle(raw: string, store: string | null, hostname: string): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const markers = [...new Set([brandFromHost(hostname), store || ''].filter(m => m.length >= 3).map(m => m.toLowerCase()))]
  if (!markers.length) return raw
  const re = new RegExp(`\\s*(?:[|–—·:]|\\s-)\\s*[^|–—·:]*?(?:${markers.map(esc).join('|')})[\\s\\S]*$`, 'i')
  const t = raw.replace(re, '').trim()
  return t.length >= 4 ? t : raw
}

function priceFromJsonLd(html: string): number | null {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (blocks) {
    for (const block of blocks) {
      const json = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim()
      try {
        const data = JSON.parse(json)
        const nodes = Array.isArray(data) ? data : [data]
        for (const node of nodes) {
          const offers = node?.offers
          const offer = Array.isArray(offers) ? offers[0] : offers
          const price = offer?.price ?? offer?.lowPrice ?? node?.price
          const n = toNumber(price != null ? String(price) : null)
          if (n) return n
        }
      } catch { /* ignore */ }
    }
  }
  // barrido suelto en JSON embebido
  const loose = html.match(/"price"\s*:\s*"?([\d][\d.,]*)"?/i)
  return loose ? toNumber(loose[1]) : null
}

function imageFromJsonLd(html: string): string | null {
  const m = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+)"/i)
  return m ? decode(m[1]) : null
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
    const timeout = setTimeout(() => controller.abort(), 9000)
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return NextResponse.json({ ok: false }, { status: 200 })

    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('text/html')) return NextResponse.json({ ok: false }, { status: 200 })
    const buf = await res.arrayBuffer()
    const html = new TextDecoder('utf-8').decode(buf.slice(0, 1024 * 1024))

    const store = decode(metaContent(html, ['og:site_name'])) ||
      target.hostname.replace(/^www\./, '').split('.')[0].replace(/^\w/, c => c.toUpperCase())

    // Titulo: og/twitter -> <title> limpio -> slug. Si viene generico (== tienda), usa slug.
    const ogTitle      = decode(metaContent(html, ['og:title', 'twitter:title']))
    const rawPageTitle = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null)
    const pageTitle    = rawPageTitle ? rawPageTitle.split(/\s[|–\-]\s/)[0].trim() : null
    const slugTitle    = titleFromSlug(target)

    let title = ogTitle || pageTitle || slugTitle
    const isGeneric = title && store && title.toLowerCase() === store.toLowerCase()
    if (!title || isGeneric || title.length < 4) title = slugTitle || pageTitle || title
    if (title) title = cleanTitle(title, store, target.hostname)

    // Imagen
    let image = decode(metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']))
      || imageFromJsonLd(html)
    if (image && image.startsWith('//')) image = target.protocol + image
    if (image && image.startsWith('/')) image = target.origin + image

    // Precio
    let price = toNumber(metaContent(html, ['product:price:amount', 'og:price:amount', 'price', 'twitter:data1']))
    if (!price) price = priceFromJsonLd(html)

    return NextResponse.json({ ok: true, title, image, store, price }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
