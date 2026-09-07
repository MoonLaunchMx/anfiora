import type { SupplierStatus } from '@/lib/types'

// Las columnas de la vista Lista de proveedores. 'proveedor' vive aqui tambien
// -- igual que 'estatus' en el menu de columnas de invitados -- para poder
// mostrarla en el menu con la etiqueta "siempre" en vez de esconderla del todo.
export type ColumnaListaKey =
  | 'proveedor' | 'categoria' | 'estatus' | 'desempeno' | 'contacto' | 'telefono'
  | 'ciudad' | 'cotizado' | 'contratado' | 'pagado' | 'partida' | 'notas'

export const COLUMNA_SIEMPRE_VISIBLE: ColumnaListaKey = 'proveedor'

export const COLUMNAS_LISTA: { key: ColumnaListaKey; label: string }[] = [
  { key: 'proveedor',  label: 'Proveedor' },
  { key: 'categoria',  label: 'Categoría' },
  { key: 'estatus',    label: 'Estatus' },
  { key: 'desempeno',  label: 'Desempeño' },
  { key: 'contacto',   label: 'Contacto' },
  { key: 'telefono',   label: 'Teléfono' },
  { key: 'ciudad',     label: 'Ciudad' },
  { key: 'cotizado',   label: 'Cotizado' },
  { key: 'contratado', label: 'Contratado' },
  { key: 'pagado',     label: 'Pagado' },
  { key: 'partida',    label: 'Partida' },
  { key: 'notas',      label: 'Notas' },
]

const VISIBLES_POR_DEFECTO: ColumnaListaKey[] = [
  'proveedor', 'categoria', 'estatus', 'desempeno', 'contacto', 'telefono', 'cotizado', 'contratado',
]

export function columnasPorDefecto(): Set<ColumnaListaKey> {
  return new Set(VISIBLES_POR_DEFECTO)
}

// El orden que Diego pidio para "Agrupar por estado": el camino del trato y
// descartado siempre al final, porque son los que menos le importan.
export const ORDEN_AGRUPADO: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado', 'descartado']

export function agruparPorEstado<T extends { status: SupplierStatus }>(
  items: T[],
): { estado: SupplierStatus; items: T[] }[] {
  return ORDEN_AGRUPADO
    .map(estado => ({ estado, items: items.filter(item => item.status === estado) }))
    .filter(grupo => grupo.items.length > 0)
}
