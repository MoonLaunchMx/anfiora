import { resolveFeatures, type EnabledFeatures, type FeatureKey } from '@/lib/features'

export const COLUMNAS = 4
export const CIFRAS_EN_BANNER = 4

export type CifraId =
  | 'invitados' | 'presupuesto' | 'proveedores' | 'tareas'
  | 'regalos' | 'mesas' | 'atencion' | 'organizacion'

export type CajaId = 'atencion' | 'pendientes' | 'mesas' | 'regalos' | 'actividad' | 'equipo'

export type Caja = { id: CajaId; x: number; y: number; w: number; h: number }

export type Acomodo = { v: 1; cifras: CifraId[]; cajas: Caja[]; ocultas: CajaId[] }

export type CifraConfig = {
  id: CifraId
  titulo: string
  // null = siempre disponible; con valor = solo si esa herramienta esta encendida.
  feature: FeatureKey | null
  requiereDinero: boolean
}

// El orden importa: es el orden del menu y el que decide a que cifra cae el
// banner cuando una elegida deja de aplicar.
export const CIFRAS: CifraConfig[] = [
  { id: 'invitados',    titulo: 'Invitados',          feature: null,      requiereDinero: false },
  { id: 'presupuesto',  titulo: 'Presupuesto',        feature: null,      requiereDinero: true  },
  { id: 'proveedores',  titulo: 'Proveedores',        feature: null,      requiereDinero: true  },
  { id: 'tareas',       titulo: 'Tareas',             feature: null,      requiereDinero: false },
  { id: 'regalos',      titulo: 'Mesa de regalos',    feature: 'regalos', requiereDinero: true  },
  { id: 'mesas',        titulo: 'Mesas',              feature: 'mesas',   requiereDinero: false },
  { id: 'atencion',     titulo: 'Requieren atención', feature: null,      requiereDinero: false },
  { id: 'organizacion', titulo: 'Organización',       feature: null,      requiereDinero: false },
]

export const CIFRAS_BASE: CifraId[] = ['invitados', 'presupuesto', 'proveedores', 'tareas']

export type CajaConfig = {
  id: CajaId
  titulo: string
  feature: FeatureKey | null
  w: number
  h: number
}

// El orden de este arreglo es el acomodo de fabrica. Agregar una caja nueva es
// un renglon aqui: mezclarAcomodo se encarga de que aparezca sola en los
// tableros ya guardados.
export const CATALOGO: CajaConfig[] = [
  { id: 'atencion',   titulo: 'Requiere tu atención',    feature: null,      w: 4, h: 3 },
  { id: 'pendientes', titulo: 'Tareas de la semana',      feature: null,      w: 2, h: 4 },
  { id: 'actividad',  titulo: 'Actividad reciente',      feature: null,      w: 2, h: 4 },
  { id: 'mesas',      titulo: 'Mesas y acomodo',         feature: 'mesas',   w: 2, h: 2 },
  { id: 'regalos',    titulo: 'Mesa de regalos',         feature: 'regalos', w: 2, h: 2 },
  { id: 'equipo',     titulo: 'Equipo',                  feature: null,      w: 2, h: 3 },
]

const CIFRA_POR_ID = new Map<CifraId, CifraConfig>(CIFRAS.map(c => [c.id, c]))
const CAJA_POR_ID = new Map<CajaId, CajaConfig>(CATALOGO.map(c => [c.id, c]))

const ES_CIFRA = (v: unknown): v is CifraId => typeof v === 'string' && CIFRA_POR_ID.has(v as CifraId)
const ES_CAJA  = (v: unknown): v is CajaId  => typeof v === 'string' && CAJA_POR_ID.has(v as CajaId)

export function cifrasDisponibles(
  eventType: string | null,
  enabled: EnabledFeatures | null,
  puedeVerDinero: boolean,
): CifraId[] {
  const features = resolveFeatures(eventType, enabled)
  return CIFRAS
    .filter(c => (c.feature === null || features[c.feature]) && (!c.requiereDinero || puedeVerDinero))
    .map(c => c.id)
}

// El banner siempre trae cuatro. Si lo guardado ya no aplica o viene corto, se
// rellena con las de fabrica y luego con lo que haya, para que nunca quede un
// hueco en la fila.
export function mezclarCifras(guardadas: CifraId[] | null, disponibles: CifraId[]): CifraId[] {
  const permitidas = new Set(disponibles)
  const elegidas: CifraId[] = []

  const empujar = (id: CifraId) => {
    if (elegidas.length >= CIFRAS_EN_BANNER) return
    if (!permitidas.has(id) || elegidas.includes(id)) return
    elegidas.push(id)
  }

  for (const id of guardadas ?? []) empujar(id)
  for (const id of CIFRAS_BASE) empujar(id)
  for (const id of disponibles) empujar(id)

  return elegidas
}

export function cambiarCifra(a: Acomodo, indice: number, nueva: CifraId): Acomodo {
  if (indice < 0 || indice >= a.cifras.length) return a
  const anterior = a.cifras[indice]
  if (anterior === nueva) return a
  const yaEstaEn = a.cifras.indexOf(nueva)
  const cifras = [...a.cifras]
  cifras[indice] = nueva
  // Si ya estaba en otra posicion, se intercambian: el banner no repite cifra.
  if (yaEstaEn !== -1) cifras[yaEstaEn] = anterior
  return { v: 1, cifras, cajas: a.cajas, ocultas: a.ocultas }
}

export function cajasDisponibles(eventType: string | null, enabled: EnabledFeatures | null): CajaId[] {
  const features = resolveFeatures(eventType, enabled)
  return CATALOGO.filter(c => c.feature === null || features[c.feature]).map(c => c.id)
}

// Recorre el catalogo en orden y va llenando renglones de COLUMNAS casillas.
// Cuando la caja no cabe en lo que queda del renglon, baja.
function colocar(cajas: Caja[], ids: CajaId[], desdeY: number): Caja[] {
  let x = 0
  let y = desdeY
  let altoDelRenglon = 0
  for (const id of ids) {
    const cfg = CAJA_POR_ID.get(id)
    if (!cfg) continue
    if (x + cfg.w > COLUMNAS) {
      x = 0
      y += altoDelRenglon
      altoDelRenglon = 0
    }
    cajas.push({ id, x, y, w: cfg.w, h: cfg.h })
    x += cfg.w
    altoDelRenglon = Math.max(altoDelRenglon, cfg.h)
  }
  return cajas
}

export function acomodoInicial(cifras: CifraId[], disponibles: CajaId[]): Acomodo {
  return { v: 1, cifras, cajas: colocar([], disponibles, 0), ocultas: [] }
}

function esMedidaValida(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0
}

// Lectura tolerante: lo guardado viene de la base y pudo escribirse con otra
// version del catalogo. Lo que no entienda se descarta en silencio y esa pieza
// vuelve a caer donde le toque, en vez de tumbar la pantalla.
export function parseAcomodo(raw: unknown): Acomodo | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  if (!Array.isArray(o.cajas)) return null

  const cajas: Caja[] = []
  for (const c of o.cajas) {
    if (c === null || typeof c !== 'object') continue
    const k = c as Record<string, unknown>
    if (!ES_CAJA(k.id)) continue
    if (!esMedidaValida(k.x) || !esMedidaValida(k.y)) continue
    if (!esMedidaValida(k.w) || !esMedidaValida(k.h)) continue
    if (k.w < 1 || k.h < 1 || k.x + k.w > COLUMNAS) continue
    cajas.push({ id: k.id, x: k.x, y: k.y, w: k.w, h: k.h })
  }

  // `cifras` ausente es un acomodo guardado antes de la enmienda del 3-ago:
  // se lee vacio y mezclarCifras le pone las de fabrica. No se descarta.
  const cifras = Array.isArray(o.cifras) ? o.cifras.filter(ES_CIFRA) : []
  const ocultas = Array.isArray(o.ocultas) ? o.ocultas.filter(ES_CAJA) : []

  return { v: 1, cifras, cajas, ocultas }
}

// Una caja que no aparece NI en cajas NI en ocultas es nueva desde el ultimo
// guardado, y se agrega sola debajo de todo. Sin esa distincion, cada caja que
// lancemos despues naceria invisible para quien ya acomodo su tablero.
export function mezclarAcomodo(
  guardado: Acomodo | null,
  cifrasDisp: CifraId[],
  cajasDisp: CajaId[],
): Acomodo {
  const cifras = mezclarCifras(guardado?.cifras ?? null, cifrasDisp)
  if (!guardado) return acomodoInicial(cifras, cajasDisp)

  const permitidas = new Set(cajasDisp)
  const cajas = guardado.cajas.filter(c => permitidas.has(c.id))
  const ocultas = guardado.ocultas.filter(id => permitidas.has(id))

  const conocidas = new Set<CajaId>([...cajas.map(c => c.id), ...ocultas])
  const nuevas = cajasDisp.filter(id => !conocidas.has(id))
  const desdeY = cajas.reduce((max, c) => Math.max(max, c.y + c.h), 0)

  return { v: 1, cifras, cajas: colocar(cajas, nuevas, desdeY), ocultas }
}

export function quitarCaja(a: Acomodo, id: CajaId): Acomodo {
  if (!a.cajas.some(c => c.id === id)) return a
  return {
    v: 1,
    cifras: a.cifras,
    cajas: a.cajas.filter(c => c.id !== id),
    ocultas: a.ocultas.includes(id) ? a.ocultas : [...a.ocultas, id],
  }
}

// La cuadricula avisa de un acomodo nuevo tambien cuando nada se movio (al
// montar, al entrar a personalizar). Sin esta comparacion, cada aviso crearia
// un objeto distinto y el tablero se redibujaria en circulo.
export function mismasCajas(a: Caja[], b: Caja[]): boolean {
  if (a.length !== b.length) return false
  const porId = new Map(b.map(c => [c.id, c]))
  return a.every(c => {
    const o = porId.get(c.id)
    return !!o && o.x === c.x && o.y === c.y && o.w === c.w && o.h === c.h
  })
}

export function agregarCaja(a: Acomodo, id: CajaId): Acomodo {
  const ocultas = a.ocultas.filter(o => o !== id)
  if (a.cajas.some(c => c.id === id)) return { v: 1, cifras: a.cifras, cajas: a.cajas, ocultas }
  const cfg = CAJA_POR_ID.get(id)
  if (!cfg) return a
  const y = a.cajas.reduce((max, c) => Math.max(max, c.y + c.h), 0)
  return { v: 1, cifras: a.cifras, cajas: [...a.cajas, { id, x: 0, y, w: cfg.w, h: cfg.h }], ocultas }
}
