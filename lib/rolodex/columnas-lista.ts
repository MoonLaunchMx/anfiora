// Las columnas de la vista Lista de proveedores. 'proveedor' vive aqui tambien
// -- igual que 'estatus' en el menu de columnas de invitados -- para poder
// mostrarla en el menu con la etiqueta "siempre" en vez de esconderla del todo.
export type ColumnaListaKey =
  | 'proveedor' | 'categoria' | 'estatus' | 'desempeno' | 'contacto' | 'telefono'
  | 'ciudad' | 'cotizado' | 'contratado' | 'pagado' | 'partida' | 'notas' | 'agregado'

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
  { key: 'agregado',   label: 'Agregado' },
]

const VISIBLES_POR_DEFECTO: ColumnaListaKey[] = [
  'proveedor', 'categoria', 'estatus', 'desempeno', 'contacto', 'telefono', 'cotizado', 'contratado', 'agregado',
]

export function columnasPorDefecto(): Set<ColumnaListaKey> {
  return new Set(VISIBLES_POR_DEFECTO)
}

// Un JSON.parse que no truena no es lo mismo que una forma valida: si lo
// guardado no es un arreglo -- JSON.parse('"abc"') da un string, y
// `new Set('abc')` es un Set valido de sus letras, sin error -- la Lista se
// queda sin columnas reales y renderiza un thead sin th y filas vacias. Por
// eso se valida la forma aqui adentro, no solo el try/catch de quien la llama.
export function columnasValidasDesdeJSON(valor: unknown): Set<ColumnaListaKey> | null {
  if (!Array.isArray(valor)) return null
  const clavesValidas = new Set(COLUMNAS_LISTA.map(c => c.key))
  const filtradas = valor.filter((v): v is ColumnaListaKey => typeof v === 'string' && clavesValidas.has(v as ColumnaListaKey))
  if (filtradas.length === 0) return null
  const resultado = new Set(filtradas)
  resultado.add(COLUMNA_SIEMPRE_VISIBLE)
  return resultado
}
