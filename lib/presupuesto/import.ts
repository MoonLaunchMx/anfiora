// Decide que hace el import de presupuesto ANTES de tocar la base.
//
// Tres reglas nacieron de perdidas de datos reales:
//   - La llave se normaliza IGUAL en los dos lados. Antes el duplicado se
//     detectaba sin distinguir mayusculas pero el UPDATE si las distinguia:
//     Supabase actualizaba cero filas, sin error, y el monto se perdia mudo.
//   - Celda vacia NO es cero. Antes toda celda ilegible se leia como 0 y
//     "Importar todos" borraba montos ya capturados.
//   - Un concepto renombrado en el Excel no entra callado como concepto nuevo:
//     se propone el parecido y decide el planner. Nunca bloquear, siempre avisar.

import { BUDGET_CATEGORY_LABELS } from '@/lib/types'

export type FilaExcel = {
  categoria: string
  concepto: string
  monto: number | null
}

export type PartidaExistente = {
  id: string
  category: string
  subcategory: string
  budget_amount: number
}

export type AccionImport = 'agregar' | 'actualizar' | 'sin_cambios'

export type Candidato = {
  id: string
  categoria: string
  concepto: string
  montoActual: number
}

export type FilaPlan = {
  categoria: string
  concepto: string
  accion: AccionImport
  montoNuevo: number
  montoActual: number | null
  partidaId: string | null
  // Un concepto que ya existe y se parece a este. Mientras siga sin resolver,
  // la fila entra como nueva: no cambiamos nada sin que el planner lo pida.
  candidato: Candidato | null
  // Lo que traia el Excel, para poder volver atras si cambia de opinion.
  origen: FilaExcel
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function leerMonto(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null

  const limpio = raw.replace(/[\s$,]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null
  return Number(limpio)
}

function distancia(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let previa = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(
        previa[j] + 1,
        actual[j - 1] + 1,
        previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previa = actual
  }
  return previa[b.length]
}

export function sonParecidos(a: string, b: string): boolean {
  const x = normalizar(a)
  const y = normalizar(b)
  if (!x || !y) return false
  if (x === y) return true

  // Uno es el otro con palabras de mas: "DJ" dentro de "DJ y audio".
  // Se compara por palabra completa para que "sal" no encuentre a "salon".
  const largo = x.length >= y.length ? x : y
  const corto = x.length >= y.length ? y : x
  if (corto.length >= 2 && ` ${largo} `.includes(` ${corto} `)) return true

  // Un dedazo o una palabra de diferencia: "Vestdio de novia".
  return distancia(x, y) / largo.length <= 0.2
}

function mapaDeCategorias(conocidas: string[]): Map<string, string> {
  const mapa = new Map<string, string>()
  const registrar = (clave: string, canonica: string) => {
    const k = normalizar(clave)
    if (k && !mapa.has(k)) mapa.set(k, canonica)
  }

  for (const c of conocidas) registrar(c, c)
  for (const [clave, etiqueta] of Object.entries(BUDGET_CATEGORY_LABELS)) {
    registrar(etiqueta, clave)
    registrar(clave, clave)
  }
  return mapa
}

const llaveDe = (categoria: string, concepto: string) =>
  `${normalizar(categoria)}||${normalizar(concepto)}`

export function planearImport(
  filas: FilaExcel[],
  existentes: PartidaExistente[],
  categoriasConocidas: string[],
): FilaPlan[] {
  const categorias = mapaDeCategorias(categoriasConocidas)

  const porLlave = new Map<string, PartidaExistente>()
  for (const p of existentes) porLlave.set(llaveDe(p.category, p.subcategory), p)

  const colapsadas = new Map<string, { categoria: string; concepto: string; monto: number | null }>()
  for (const fila of filas) {
    const catRaw = (fila.categoria ?? '').trim()
    const conRaw = (fila.concepto ?? '').trim()
    if (!catRaw || !conRaw) continue

    const categoria = categorias.get(normalizar(catRaw)) ?? catRaw
    const llave = llaveDe(categoria, conRaw)

    const previa = colapsadas.get(llave)
    if (previa) {
      if (fila.monto !== null) previa.monto = fila.monto
    } else {
      colapsadas.set(llave, { categoria, concepto: conRaw, monto: fila.monto })
    }
  }

  // Un concepto existente que ya quedo emparejado por nombre exacto no se
  // puede ofrecer ademas como "quizas es el mismo".
  const yaTomados = new Set<string>()
  for (const llave of colapsadas.keys()) {
    const p = porLlave.get(llave)
    if (p) yaTomados.add(p.id)
  }

  const plan: FilaPlan[] = []
  for (const [llave, fila] of colapsadas) {
    const existente = porLlave.get(llave)

    if (existente) {
      const montoActual = existente.budget_amount
      const cambia = fila.monto !== null && fila.monto !== montoActual
      plan.push({
        categoria:     existente.category,
        concepto:      existente.subcategory,
        accion:        cambia ? 'actualizar' : 'sin_cambios',
        montoNuevo:    cambia ? fila.monto! : montoActual,
        montoActual,
        partidaId:     existente.id,
        candidato:     null,
        origen:        { categoria: fila.categoria, concepto: fila.concepto, monto: fila.monto },
      })
      continue
    }

    const parecido = existentes.find(p =>
      !yaTomados.has(p.id) &&
      normalizar(p.category) === normalizar(fila.categoria) &&
      sonParecidos(fila.concepto, p.subcategory),
    )
    if (parecido) yaTomados.add(parecido.id)

    plan.push({
      categoria:     fila.categoria,
      concepto:      fila.concepto,
      accion:        'agregar',
      montoNuevo:    fila.monto ?? 0,
      montoActual:   null,
      partidaId:     null,
      candidato:     parecido
        ? { id: parecido.id, categoria: parecido.category, concepto: parecido.subcategory, montoActual: parecido.budget_amount }
        : null,
      origen:        { categoria: fila.categoria, concepto: fila.concepto, monto: fila.monto },
    })
  }

  return plan
}

export function decidirRenombre(fila: FilaPlan, esElMismo: boolean): FilaPlan {
  if (!fila.candidato) return fila

  if (!esElMismo) {
    return {
      ...fila,
      categoria:   fila.origen.categoria,
      concepto:    fila.origen.concepto,
      accion:      'agregar',
      montoNuevo:  fila.origen.monto ?? 0,
      montoActual: null,
      partidaId:   null,
    }
  }

  const { id, categoria, concepto, montoActual } = fila.candidato
  const cambia = fila.origen.monto !== null && fila.origen.monto !== montoActual

  return {
    ...fila,
    categoria,
    concepto,
    accion:      cambia ? 'actualizar' : 'sin_cambios',
    montoNuevo:  cambia ? fila.origen.monto! : montoActual,
    montoActual,
    partidaId:   id,
  }
}

export type ResumenImport = {
  agregar: number
  actualizar: number
  sinCambios: number
  porRevisar: number
  bajan: number
  suben: number
  totalBaja: number
  totalSube: number
}

export function resumenImport(plan: FilaPlan[]): ResumenImport {
  const r: ResumenImport = {
    agregar: 0, actualizar: 0, sinCambios: 0, porRevisar: 0,
    bajan: 0, suben: 0, totalBaja: 0, totalSube: 0,
  }

  for (const f of plan) {
    if (f.accion === 'agregar') {
      r.agregar++
      if (f.candidato) r.porRevisar++
    } else if (f.accion === 'sin_cambios') {
      r.sinCambios++
    } else {
      r.actualizar++
      const delta = f.montoNuevo - (f.montoActual ?? 0)
      if (delta < 0) { r.bajan++; r.totalBaja += -delta }
      else           { r.suben++; r.totalSube += delta }
    }
  }

  return r
}

const SELLO = 'generado'

const dosDigitos = (n: number) => String(n).padStart(2, '0')

export function selloDeFecha(cuando: Date = new Date()): string {
  return `${cuando.getFullYear()}-${dosDigitos(cuando.getMonth() + 1)}-${dosDigitos(cuando.getDate())}`
    + ` ${dosDigitos(cuando.getHours())}:${dosDigitos(cuando.getMinutes())}`
}

export function fechaDelArchivo(filas: unknown[][]): Date | null {
  for (const fila of filas) {
    if (!Array.isArray(fila) || fila.length < 2) continue
    if (normalizar(String(fila[0] ?? '')) !== SELLO) continue

    const m = String(fila[1] ?? '').trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/)
    if (!m) continue

    const fecha = new Date(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4] ?? 0), Number(m[5] ?? 0),
    )
    return Number.isNaN(fecha.getTime()) ? null : fecha
  }
  return null
}

function haceCuanto(dias: number): string {
  if (dias < 30) {
    const semanas = Math.max(1, Math.round(dias / 7))
    return semanas === 1 ? 'hace una semana' : `hace ${semanas} semanas`
  }
  const meses = Math.max(1, Math.round(dias / 30))
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`
}

export function avisoArchivoViejo(
  fecha: Date | null,
  ahora: Date,
  hayMontosQueBajan: boolean,
): string | null {
  if (!fecha || !hayMontosQueBajan) return null

  const dias = Math.floor((ahora.getTime() - fecha.getTime()) / 86400000)
  if (dias < 7) return null

  return `Este archivo se generó ${haceCuanto(dias)}. Lo que hayas cambiado en la app desde entonces se va a revertir.`
}

export function mensajeImportado(agregados: number, actualizados: number): string {
  if (agregados === 0 && actualizados === 0) {
    return 'Tu presupuesto ya estaba al día: no hubo nada que cambiar.'
  }

  const partes: string[] = []
  if (agregados > 0) {
    partes.push(agregados === 1 ? 'Se agregó 1 concepto' : `Se agregaron ${agregados} conceptos`)
  }
  if (actualizados > 0) {
    partes.push(actualizados === 1 ? 'se actualizó 1 monto' : `se actualizaron ${actualizados} montos`)
  }

  const texto = partes.join(' y ')
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
}
