// Las columnas del directorio del Rolodex. Mismo patron que COLUMNAS_LISTA de
// la vista Lista: 'proveedor' vive aqui tambien para poder mostrarla en el menu
// con la etiqueta "siempre" en vez de esconderla del todo.
//
// `peso` no es un ancho fijo sino una proporcion: la tabla es de ancho fijo al
// 100%, asi que al prender o apagar columnas el navegador reparte el espacio
// entre las que quedan. Por eso nunca hay scroll horizontal.
export type ColumnaDirectorioKey =
  | 'proveedor' | 'categoria' | 'activo' | 'eventos' | 'cierre' | 'planner'
  | 'ultima' | 'ahorro' | 'cliente' | 'rango'

export const COLUMNA_DIRECTORIO_SIEMPRE: ColumnaDirectorioKey = 'proveedor'

// El orden importa y no es alfabetico: quien es (proveedor, categoria), cuanto
// lo has usado (eventos, cierre), cuanto cuesta (ahorro, inversion), que tan
// bueno es (planner y cliente, JUNTAS: son la misma pregunta contestada por dos
// personas) y al final cuando fue la ultima vez. Prender una columna nunca se
// mete entre las dos calificaciones ni empuja a "Ultima vez" de su lugar.
export const COLUMNAS_DIRECTORIO: {
  key: ColumnaDirectorioKey
  label: string
  peso: number
  derecha?: boolean
}[] = [
  { key: 'proveedor', label: 'Proveedor',  peso: 25 },
  { key: 'categoria', label: 'Categoría',  peso: 14 },
  { key: 'activo',    label: 'Activo',     peso: 10 },
  { key: 'eventos',   label: 'Eventos',    peso: 10, derecha: true },
  { key: 'cierre',    label: 'Cierre',     peso: 11, derecha: true },
  { key: 'ahorro',    label: 'Ahorro',     peso: 11, derecha: true },
  { key: 'rango',     label: 'Inversión',  peso: 19, derecha: true },
  { key: 'planner',   label: 'Planner',    peso: 17 },
  { key: 'cliente',   label: 'Cliente',    peso: 17 },
  { key: 'ultima',    label: 'Última vez', peso: 21 },
]

// Siete y no diez: mas columnas abruman y aprietan la letra. Las otras tres
// estan a un clic en el menu de columnas.
const VISIBLES_POR_DEFECTO: ColumnaDirectorioKey[] = [
  'proveedor', 'categoria', 'activo', 'eventos', 'cierre', 'planner', 'ultima',
]

export function columnasDirectorioPorDefecto(): Set<ColumnaDirectorioKey> {
  return new Set(VISIBLES_POR_DEFECTO)
}

export const COLUMNAS_DIRECTORIO_STORAGE = 'anfiora_rolodex_columnas'

// Un JSON.parse que no truena no es lo mismo que una forma valida: si lo
// guardado no es un arreglo, la tabla se queda sin columnas y renderiza un
// thead vacio. Se valida la forma aqui, no solo con el try/catch de quien llama.
export function columnasDirectorioDesdeJSON(valor: unknown): Set<ColumnaDirectorioKey> | null {
  if (!Array.isArray(valor)) return null
  const validas = new Set(COLUMNAS_DIRECTORIO.map(c => c.key))
  const filtradas = valor.filter(
    (v): v is ColumnaDirectorioKey => typeof v === 'string' && validas.has(v as ColumnaDirectorioKey),
  )
  if (filtradas.length === 0) return null
  const resultado = new Set(filtradas)
  resultado.add(COLUMNA_DIRECTORIO_SIEMPRE)
  return resultado
}

export function cargarColumnasDirectorio(): Set<ColumnaDirectorioKey> {
  if (typeof window === 'undefined') return columnasDirectorioPorDefecto()
  try {
    const crudo = localStorage.getItem(COLUMNAS_DIRECTORIO_STORAGE)
    if (!crudo) return columnasDirectorioPorDefecto()
    return columnasDirectorioDesdeJSON(JSON.parse(crudo)) ?? columnasDirectorioPorDefecto()
  } catch {
    return columnasDirectorioPorDefecto()
  }
}

export function guardarColumnasDirectorio(columnas: Set<ColumnaDirectorioKey>): void {
  try {
    localStorage.setItem(COLUMNAS_DIRECTORIO_STORAGE, JSON.stringify([...columnas]))
  } catch {}
}
