import type { SupplierStatus } from '@/lib/types'

// Cubetas de desempeno para el filtro: no son exhaustivas a proposito (un
// score de 3.4, por ejemplo, no cae en ninguna) porque asi las pidio Diego,
// literales a la etiqueta que ve en el menu.
export type FiltroDesempeno = '5' | '4mas' | '3menos' | 'sin_calificar'

export const FILTROS_DESEMPENO: { key: FiltroDesempeno; label: string }[] = [
  { key: '5',              label: '5 estrellas' },
  { key: '4mas',           label: '4 o más' },
  { key: '3menos',         label: '3 o menos' },
  { key: 'sin_calificar',  label: 'Sin calificar' },
]

export type FiltrosProveedores = {
  categoria: Set<string>
  estatus: Set<SupplierStatus>
  ciudad: Set<string>
  desempeno: Set<FiltroDesempeno>
}

export function filtrosVacios(): FiltrosProveedores {
  return { categoria: new Set(), estatus: new Set(), ciudad: new Set(), desempeno: new Set() }
}

export function contarFiltrosActivos(filtros: FiltrosProveedores): number {
  return filtros.categoria.size + filtros.estatus.size + filtros.ciudad.size + filtros.desempeno.size
}

export type EntradaFiltrable = {
  categoriaId: string | null
  estatus: SupplierStatus
  ciudad: string | null
  desempeno: number | null
}

function coincideDesempeno(valor: number | null, grupo: Set<FiltroDesempeno>): boolean {
  if (grupo.size === 0) return true
  for (const opcion of grupo) {
    if (opcion === 'sin_calificar' && valor === null) return true
    if (opcion === '5' && valor === 5) return true
    if (opcion === '4mas' && valor !== null && valor >= 4 && valor < 5) return true
    if (opcion === '3menos' && valor !== null && valor <= 3) return true
  }
  return false
}

// Grupos combinan con AND entre si; dentro de un grupo, con OR. Un grupo
// vacio (sin seleccion) significa "todo pasa" -- asi una boda sin filtros
// tocados sigue mostrando todo.
export function coincideFiltros(entrada: EntradaFiltrable, filtros: FiltrosProveedores): boolean {
  if (filtros.categoria.size > 0 && (!entrada.categoriaId || !filtros.categoria.has(entrada.categoriaId))) return false
  if (filtros.estatus.size > 0 && !filtros.estatus.has(entrada.estatus)) return false
  if (filtros.ciudad.size > 0 && (!entrada.ciudad || !filtros.ciudad.has(entrada.ciudad))) return false
  if (!coincideDesempeno(entrada.desempeno, filtros.desempeno)) return false
  return true
}

export function aplicarFiltrosProveedores<T>(
  items: T[],
  filtros: FiltrosProveedores,
  extraer: (item: T) => EntradaFiltrable,
): T[] {
  return items.filter(item => coincideFiltros(extraer(item), filtros))
}
