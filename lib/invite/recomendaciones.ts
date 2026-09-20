export const MAX_LINKS_POR_BLOQUE = 12

// Atajos para no escribir: el planner igual puede poner el nombre que quiera.
export const NOMBRES_SUGERIDOS = [
  'Hospedaje', 'Vuelos', 'Transporte', 'Renta de autos', 'Autobuses', 'Restaurantes', 'Qué conocer', 'Tours',
]

export type RecoLink = {
  url: string
  titulo: string
  sitio: string
  imagen: string
  nota: string
}

export function normalizarUrl(raw: string): string | null {
  const limpio = raw.trim()
  if (!limpio) return null
  const conEsquema = /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`
  let u: URL
  try { u = new URL(conEsquema) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (!u.hostname.includes('.')) return null
  return u.toString()
}

export function sitioDeUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./i, '') } catch { return '' }
}

export function tituloDeRespaldo(url: string): string {
  const sitio = sitioDeUrl(url)
  if (!sitio) return 'Enlace'
  const marca = sitio.split('.')[0]
  return marca.charAt(0).toUpperCase() + marca.slice(1)
}

export function nuevoLink(url: string): RecoLink {
  return { url, titulo: tituloDeRespaldo(url), sitio: sitioDeUrl(url), imagen: '', nota: '' }
}

export function agregarLink(links: RecoLink[], link: RecoLink): RecoLink[] {
  return links.length >= MAX_LINKS_POR_BLOQUE ? links : [...links, link]
}

export function actualizarLink(links: RecoLink[], index: number, patch: Partial<RecoLink>): RecoLink[] {
  return links.map((l, i) => (i === index ? { ...l, ...patch } : l))
}

export function quitarLink(links: RecoLink[], index: number): RecoLink[] {
  return links.filter((_, i) => i !== index)
}

export function moverLink(links: RecoLink[], index: number, dir: -1 | 1): RecoLink[] {
  const target = index + dir
  if (index < 0 || index >= links.length) return links
  if (target < 0 || target >= links.length) return links
  const next = [...links]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// La version anterior guardaba apartados dentro de un solo bloque. Cada
// apartado con links se convierte en su propio bloque, con su nombre de titulo.
type BloqueLegacy = { nombre?: unknown; links?: unknown }

export function bloquesDesdeGrupos(grupos: unknown): { titulo: string; links: RecoLink[] }[] {
  if (!Array.isArray(grupos)) return []
  return grupos
    .map(g => {
      const grupo = (g ?? {}) as BloqueLegacy
      const links = Array.isArray(grupo.links) ? (grupo.links as RecoLink[]) : []
      return { titulo: typeof grupo.nombre === 'string' ? grupo.nombre : '', links }
    })
    .filter(b => b.links.length > 0)
}
