export const MAX_APARTADOS = 6
export const MAX_LINKS_POR_APARTADO = 10

export type RecoLink = {
  url: string
  titulo: string
  sitio: string
  imagen: string
  nota: string
}

export type RecoGrupo = {
  id: string
  nombre: string
  links: RecoLink[]
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

export function gruposVisibles(grupos: RecoGrupo[]): RecoGrupo[] {
  return grupos.filter(g => g.links.length > 0)
}

// Con un solo apartado con links su etiqueta no aporta nada: el titulo del
// bloque ya dice de que va la seccion.
export function mostrarEtiquetas(grupos: RecoGrupo[]): boolean {
  return gruposVisibles(grupos).length > 1
}

function mapGrupo(grupos: RecoGrupo[], grupoId: string, fn: (g: RecoGrupo) => RecoGrupo): RecoGrupo[] {
  return grupos.map(g => (g.id === grupoId ? fn(g) : g))
}

export function agregarLink(grupos: RecoGrupo[], grupoId: string, link: RecoLink): RecoGrupo[] {
  return mapGrupo(grupos, grupoId, g =>
    g.links.length >= MAX_LINKS_POR_APARTADO ? g : { ...g, links: [...g.links, link] },
  )
}

export function actualizarLink(
  grupos: RecoGrupo[], grupoId: string, index: number, patch: Partial<RecoLink>,
): RecoGrupo[] {
  return mapGrupo(grupos, grupoId, g => ({
    ...g,
    links: g.links.map((l, i) => (i === index ? { ...l, ...patch } : l)),
  }))
}

export function quitarLink(grupos: RecoGrupo[], grupoId: string, index: number): RecoGrupo[] {
  return mapGrupo(grupos, grupoId, g => ({ ...g, links: g.links.filter((_, i) => i !== index) }))
}

export function moverLink(grupos: RecoGrupo[], grupoId: string, index: number, dir: -1 | 1): RecoGrupo[] {
  return mapGrupo(grupos, grupoId, g => {
    const target = index + dir
    if (index < 0 || index >= g.links.length) return g
    if (target < 0 || target >= g.links.length) return g
    const links = [...g.links]
    ;[links[index], links[target]] = [links[target], links[index]]
    return { ...g, links }
  })
}

export function agregarApartado(grupos: RecoGrupo[], id: string, nombre = ''): RecoGrupo[] {
  if (grupos.length >= MAX_APARTADOS) return grupos
  return [...grupos, { id, nombre, links: [] }]
}

export function quitarApartado(grupos: RecoGrupo[], grupoId: string): RecoGrupo[] {
  return grupos.filter(g => g.id !== grupoId)
}

export function renombrarApartado(grupos: RecoGrupo[], grupoId: string, nombre: string): RecoGrupo[] {
  return mapGrupo(grupos, grupoId, g => ({ ...g, nombre }))
}
