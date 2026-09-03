// Decide que hace el import de presupuesto ANTES de tocar la base.
//
// Dos reglas nacieron de perdidas de datos reales:
//   - La llave se normaliza IGUAL en los dos lados. Antes el duplicado se
//     detectaba sin distinguir mayusculas pero el UPDATE si las distinguia:
//     Supabase actualizaba cero filas, sin error, y el monto se perdia mudo.
//   - Celda vacia NO es cero. Antes toda celda ilegible se leia como 0 y
//     "Importar todos" borraba montos ya capturados.

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

export type FilaPlan = {
  categoria: string
  concepto: string
  accion: AccionImport
  montoNuevo: number
  montoActual: number | null
  partidaId: string | null
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

export function planearImport(
  filas: FilaExcel[],
  existentes: PartidaExistente[],
  categoriasConocidas: string[],
): FilaPlan[] {
  const categorias = mapaDeCategorias(categoriasConocidas)

  const porLlave = new Map<string, PartidaExistente>()
  for (const p of existentes) {
    porLlave.set(`${normalizar(p.category)}||${normalizar(p.subcategory)}`, p)
  }

  const colapsadas = new Map<string, { categoria: string; concepto: string; monto: number | null }>()
  for (const fila of filas) {
    const catRaw = (fila.categoria ?? '').trim()
    const conRaw = (fila.concepto ?? '').trim()
    if (!catRaw || !conRaw) continue

    const categoria = categorias.get(normalizar(catRaw)) ?? catRaw
    const llave = `${normalizar(categoria)}||${normalizar(conRaw)}`

    const previa = colapsadas.get(llave)
    if (previa) {
      if (fila.monto !== null) previa.monto = fila.monto
    } else {
      colapsadas.set(llave, { categoria, concepto: conRaw, monto: fila.monto })
    }
  }

  const plan: FilaPlan[] = []
  for (const [llave, fila] of colapsadas) {
    const existente = porLlave.get(llave)

    if (!existente) {
      plan.push({
        categoria:   fila.categoria,
        concepto:    fila.concepto,
        accion:      'agregar',
        montoNuevo:  fila.monto ?? 0,
        montoActual: null,
        partidaId:   null,
      })
      continue
    }

    const montoActual = existente.budget_amount
    const cambia = fila.monto !== null && fila.monto !== montoActual

    plan.push({
      categoria:   existente.category,
      concepto:    existente.subcategory,
      accion:      cambia ? 'actualizar' : 'sin_cambios',
      montoNuevo:  cambia ? fila.monto! : montoActual,
      montoActual,
      partidaId:   existente.id,
    })
  }

  return plan
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

export function resumenImport(plan: FilaPlan[]): {
  agregar: number
  actualizar: number
  sinCambios: number
} {
  return {
    agregar:    plan.filter(f => f.accion === 'agregar').length,
    actualizar: plan.filter(f => f.accion === 'actualizar').length,
    sinCambios: plan.filter(f => f.accion === 'sin_cambios').length,
  }
}
