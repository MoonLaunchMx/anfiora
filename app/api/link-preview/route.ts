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

// Nombre del producto desde el slug del URL. Recorre los segmentos del path de
// atras hacia adelante saltando IDs (Liverpool/Cimaco terminan en numero, Amazon
// en ASIN, ML en MLM...) hasta encontrar uno con pinta de nombre.
function titleFromSlug(u: URL): string | null {
  const stop = new Set(['dp', 'gp', 'p', 'item', 'producto', 'product', 'pdp', 'tienda'])
  const segs = u.pathname.split('/').filter(Boolean)
  for (let i = segs.length - 1; i >= 0; i--) {
    let s = decodeURIComponent(segs[i])
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/_JM$/i, '')
      .replace(/^ML[A-Z]-?\d+-?/i, '')
    if (stop.has(s.toLowerCase())) continue
    if (/^B0[A-Z0-9]{8}$/i.test(s)) continue
    if (/^ref=/i.test(s)) continue
    s = s.replace(/[-_+]/g, ' ').replace(/\s+/g, ' ').trim()
    if (s.length < 8 || /^\d+$/.test(s) || !/[a-zá-úñ]/i.test(s)) continue
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  return null
}

// Desescapa strings sacados de JSON embebido (&, \/)
function unJson(s: string | null): string | null {
  if (!s) return null
  try { return JSON.parse(`"${s}"`) } catch { return s }
}

// Marca del host ignorando subdominios y TLDs: articulo.mercadolibre.com.mx -> mercadolibre
function brandFromHost(hostname: string): string {
  const skip = new Set(['www', 'com', 'mx', 'net', 'org', 'co', 'io', 'shop', 'store'])
  const labels = hostname.toLowerCase().split('.').filter(l => !skip.has(l))
  return labels.pop() || ''
}

// Limpia el titulo de tienda: prefijo de marca ("Amazon.com: Producto"),
// sufijo con marca ("Producto | Liverpool") y categoria final ("... : Hogar y Cocina").
// Si lo recortado queda demasiado corto, conserva el original.
function cleanTitle(raw: string, store: string | null, hostname: string): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const markers = [...new Set([brandFromHost(hostname), store || ''].filter(m => m.length >= 3).map(m => m.toLowerCase()))]
  let t = raw
  if (markers.length) {
    const alt = markers.map(esc).join('|')
    t = t.replace(new RegExp(`^\\s*(?:www\\.)?(?:${alt})(?:\\.[a-z]{2,3}){0,2}\\s*[:|–—-]\\s*`, 'i'), '')
    t = t.replace(new RegExp(`\\s*(?:[|–—·:]|\\s-)\\s*[^|–—·:]*?(?:${alt})[\\s\\S]*$`, 'i'), '')
  }
  t = t.replace(/\s+:\s+[^:|0-9]{2,40}$/, '').trim()
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
  const loose = html.match(/"price(?:Amount)?"\s*:\s*"?([\d][\d.,]*)"?/i)
  if (loose) return toNumber(loose[1])
  // estado embebido de SPAs (Liverpool y similares)
  const spa = html.match(/"(?:promoPrice|salePrice|listPrice)"\s*:\s*"?([\d][\d.,]*)"?/i)
  if (spa) return toNumber(spa[1])
  // markup de Amazon (no usa meta/JSON-LD estandar)
  const offscreen = html.match(/class="a-offscreen">\s*\$\s*([\d.,]+)\s*</i)
  if (offscreen) return toNumber(offscreen[1])
  const whole = html.match(/class="a-price-whole">([\d,]+)/i)
  if (whole) {
    const frac = html.match(/class="a-price-fraction">(\d{1,2})/i)
    return toNumber(whole[1] + (frac ? '.' + frac[1] : ''))
  }
  return null
}

function imageFromJsonLd(html: string): string | null {
  const m = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+)"/i)
  return m ? unJson(m[1]) : null
}

// Imagenes en markup/estado embebido: Amazon (hiRes, landingImage) y SPAs (largeImage)
function imageFromMarkup(html: string): string | null {
  const pats = [
    /"hiRes"\s*:\s*"(https?:\/\/[^"]+)"/i,
    /data-old-hires="(https?:\/\/[^"]+)"/i,
    /id="landingImage"[^>]+src="(https?:\/\/[^"]+)"/i,
    /"largeImage"\s*:\s*"(https?:\/\/[^"]+)"/i,
  ]
  for (const p of pats) {
    const m = html.match(p)
    if (m) return unJson(m[1])
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
    const timeout = setTimeout(() => controller.abort(), 9000)
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      'Upgrade-Insecure-Requests': '1',
    }
    // Redirects manuales: valida cada salto contra isBlockedHost (anti-SSRF) y
    // conserva la URL final (links cortos tipo a.co -> amazon.com.mx) para
    // tienda/slug/imagenes relativas.
    let finalUrl = target
    let res: Response | null = null
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(finalUrl.toString(), { signal: controller.signal, redirect: 'manual', headers })
      const loc = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = new URL(loc, finalUrl)
        if ((next.protocol !== 'http:' && next.protocol !== 'https:') || isBlockedHost(next.hostname)) {
          clearTimeout(timeout)
          return NextResponse.json({ ok: false }, { status: 200 })
        }
        finalUrl = next
        continue
      }
      break
    }
    clearTimeout(timeout)
    if (!res || !res.ok) return NextResponse.json({ ok: false }, { status: 200 })

    const ctype = res.headers.get('content-type') || ''
    if (!ctype.includes('text/html')) return NextResponse.json({ ok: false }, { status: 200 })
    const buf = await res.arrayBuffer()
    const html = new TextDecoder('utf-8').decode(buf.slice(0, 1024 * 1024))

    const store = decode(metaContent(html, ['og:site_name'])) ||
      brandFromHost(finalUrl.hostname).replace(/^\w/, c => c.toUpperCase())

    // Titulo: og/twitter -> <title> limpio -> slug. Si viene generico (== tienda), usa slug.
    const ogTitle      = decode(metaContent(html, ['og:title', 'twitter:title']))
    const rawPageTitle = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null)
    const pageTitle    = rawPageTitle ? rawPageTitle.split(/\s[|–\-]\s/)[0].trim() : null
    // Slug del URL original (el que pego el usuario tiene el nombre del producto;
    // un redirect a bot-check lo pierde). El final solo como respaldo (links cortos).
    const slugTitle    = titleFromSlug(target) || titleFromSlug(finalUrl)

    // Generico = el titulo es solo el nombre de la tienda ("Mercado Libre" vs "mercadolibre").
    // Basura = titulo de pagina de bot-check / error (ML sirve "Account verification").
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const JUNK = /^(account verification|access denied|attention required|just a moment|are you a robot|robot check|captcha|error|page not found|acceso denegado|verificaci)/i
    let title = ogTitle || pageTitle || slugTitle
    const isGeneric = !!(title && (
      (store && norm(title) === norm(store)) ||
      norm(title) === norm(brandFromHost(finalUrl.hostname))
    ))
    const isJunk = !!(title && JUNK.test(title.trim()))
    if (isGeneric || isJunk) title = slugTitle || title
    else if (!title || title.length < 4) title = slugTitle || pageTitle || title
    if (title) title = cleanTitle(title, store, finalUrl.hostname)

    // Imagen
    let image = decode(metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']))
      || imageFromJsonLd(html)
      || imageFromMarkup(html)
    if (image && image.startsWith('//')) image = finalUrl.protocol + image
    if (image && image.startsWith('/')) image = finalUrl.origin + image

    // Precio
    let price = toNumber(metaContent(html, ['product:price:amount', 'og:price:amount', 'price', 'twitter:data1']))
    if (!price) price = priceFromJsonLd(html)

    return NextResponse.json({ ok: true, title, image, store, price }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
