export type DressCodeNivel =
  | 'casual'
  | 'casual_elegante'
  | 'coctel'
  | 'formal'
  | 'etiqueta'
  | 'tematico'

export type DressCodeColor = { hex: string; nombre: string }

export type DressCode = {
  nivel: DressCodeNivel | null
  nivel_custom: string | null
  colores_sugeridos: DressCodeColor[]
  colores_evitar: DressCodeColor[]
  recomendaciones: string[]
  nota_libre: string
  label_ellas: string
  label_ellos: string
  guia_ellas: string | null
  guia_ellos: string | null
  fotos_ellas: string[]
  fotos_ellos: string[]
}

export const NIVELES: { id: DressCodeNivel; label: string; desc: string }[] = [
  { id: 'casual',          label: 'Casual',          desc: 'Cómodo y relajado' },
  { id: 'casual_elegante', label: 'Casual elegante', desc: 'Arreglado sin exagerar' },
  { id: 'coctel',          label: 'Cóctel',          desc: 'Vestido corto o traje' },
  { id: 'formal',          label: 'Formal',          desc: 'Vestido largo o traje oscuro' },
  { id: 'etiqueta',        label: 'Etiqueta',        desc: 'Smoking o gala' },
  { id: 'tematico',        label: 'Temático',        desc: 'Tú defines el código' },
]

const RECOMENDACIONES_GENERICAS = [
  'Zapato cómodo',
  'Lleva abrigo, refresca de noche',
  'Evita blanco',
]

const RECOMENDACIONES_POR_TIPO: Record<string, string[]> = {
  boda:        ['Tacón bajo, es jardín', 'Evita blanco', 'Lleva abrigo, refresca de noche', 'Ceremonia religiosa'],
  xv:          ['Evita blanco', 'Evita el color de la festejada', 'Tacón cómodo para bailar', 'Lleva abrigo, refresca de noche'],
  cumpleanos:  ['Ropa cómoda para bailar', 'Lleva abrigo, refresca de noche', 'Alberca o playa'],
  graduacion:  ['Formal pero cómodo', 'Zapato para caminar', 'Lleva abrigo'],
  bautizo:     ['Ceremonia religiosa', 'Tonos claros', 'Evita negro total'],
  fiesta:      ['Ropa cómoda para bailar', 'Alberca o playa', 'Lleva abrigo, refresca de noche'],
  despedida:   ['Ropa cómoda para bailar', 'Alberca o playa'],
  conferencia: ['Business casual', 'Gafete visible', 'Zapato cómodo para caminar'],
  capacitacion:['Business casual', 'Ropa cómoda'],
  teambuilding:['Ropa deportiva', 'Zapato para exterior', 'Lleva gorra y bloqueador'],
  lanzamiento: ['Business casual', 'Colores de la marca'],
  asamblea:    ['Formal de negocios'],
  retiro:      ['Ropa cómoda', 'Zapato para exterior', 'Lleva abrigo'],
  congreso:    ['Business casual', 'Gafete visible', 'Zapato cómodo para caminar'],
  campamento:  ['Ropa de exterior', 'Zapato para caminar', 'Lleva abrigo e impermeable'],
  caridad:     ['Business casual'],
}

export function getRecomendacionesSugeridas(eventType: string | null | undefined): string[] {
  return (eventType && RECOMENDACIONES_POR_TIPO[eventType]) || RECOMENDACIONES_GENERICAS
}

const NIVEL_IDS = new Set(NIVELES.map(n => n.id))
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

export function defaultDressCode(): DressCode {
  return {
    nivel: null,
    nivel_custom: null,
    colores_sugeridos: [],
    colores_evitar: [],
    recomendaciones: [],
    nota_libre: '',
    label_ellas: 'Ellas',
    label_ellos: 'Ellos',
    guia_ellas: null,
    guia_ellos: null,
    fotos_ellas: [],
    fotos_ellos: [],
  }
}

function parseColors(raw: unknown): DressCodeColor[] {
  if (!Array.isArray(raw)) return []
  const out: DressCodeColor[] = []
  for (const c of raw) {
    if (c && typeof c === 'object' && typeof (c as any).hex === 'string' && HEX_RE.test((c as any).hex)) {
      out.push({ hex: (c as any).hex, nombre: typeof (c as any).nombre === 'string' ? (c as any).nombre : '' })
    }
  }
  return out
}

function parseStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

export function parseDressCode(raw: unknown): DressCode {
  if (!raw || typeof raw !== 'object') return defaultDressCode()
  const r = raw as Record<string, unknown>
  const nivel = typeof r.nivel === 'string' && NIVEL_IDS.has(r.nivel as DressCodeNivel)
    ? (r.nivel as DressCodeNivel)
    : null
  let fotos_ellas = parseStrings(r.fotos_ellas).slice(0, 3)
  const fotos_ellos = parseStrings(r.fotos_ellos).slice(0, 3)
  // Migración de registros viejos que guardaban un solo arreglo `fotos_ejemplo`
  if (!fotos_ellas.length && !fotos_ellos.length) {
    fotos_ellas = parseStrings(r.fotos_ejemplo).slice(0, 3)
  }
  return {
    nivel,
    nivel_custom: typeof r.nivel_custom === 'string' ? r.nivel_custom : null,
    colores_sugeridos: parseColors(r.colores_sugeridos),
    colores_evitar: parseColors(r.colores_evitar),
    recomendaciones: parseStrings(r.recomendaciones),
    nota_libre: typeof r.nota_libre === 'string' ? r.nota_libre : '',
    label_ellas: typeof r.label_ellas === 'string' && r.label_ellas.trim() ? r.label_ellas : 'Ellas',
    label_ellos: typeof r.label_ellos === 'string' && r.label_ellos.trim() ? r.label_ellos : 'Ellos',
    guia_ellas: typeof r.guia_ellas === 'string' ? r.guia_ellas : null,
    guia_ellos: typeof r.guia_ellos === 'string' ? r.guia_ellos : null,
    fotos_ellas,
    fotos_ellos,
  }
}

export function isDressCodeConfigured(dc: DressCode): boolean {
  return Boolean(
    dc.nivel ||
    dc.colores_sugeridos.length ||
    dc.colores_evitar.length ||
    dc.recomendaciones.length ||
    dc.nota_libre.trim() ||
    (dc.guia_ellas && dc.guia_ellas.trim()) ||
    (dc.guia_ellos && dc.guia_ellos.trim()) ||
    dc.fotos_ellas.length ||
    dc.fotos_ellos.length,
  )
}

export function resolveNivelLabel(dc: DressCode): string | null {
  if (!dc.nivel) return null
  if (dc.nivel === 'tematico') return dc.nivel_custom?.trim() || 'Temático'
  return NIVELES.find(n => n.id === dc.nivel)?.label ?? null
}

export function resolveNivelDesc(dc: DressCode): string | null {
  if (!dc.nivel || dc.nivel === 'tematico') return null
  return NIVELES.find(n => n.id === dc.nivel)?.desc ?? null
}

function colorNames(colors: DressCodeColor[]): string {
  return colors.map(c => c.nombre.trim() || c.hex).join(', ')
}

export function buildDressCodeText(dc: DressCode, opts: { eventName?: string } = {}): string {
  const lines: string[] = []
  const header = opts.eventName ? `Dress code — ${opts.eventName}` : 'Dress code'
  lines.push(header)
  const label = resolveNivelLabel(dc)
  if (label) {
    const desc = resolveNivelDesc(dc)
    lines.push(desc ? `Nivel: ${label} (${desc.toLowerCase()})` : `Nivel: ${label}`)
  }
  if (dc.colores_sugeridos.length) lines.push(`Colores sugeridos: ${colorNames(dc.colores_sugeridos)}`)
  if (dc.colores_evitar.length) lines.push(`Evita: ${colorNames(dc.colores_evitar)}`)
  if (dc.recomendaciones.length) lines.push(`Notas: ${dc.recomendaciones.join('. ')}.`)
  if (dc.nota_libre.trim()) lines.push(dc.nota_libre.trim())
  return lines.join('\n')
}
