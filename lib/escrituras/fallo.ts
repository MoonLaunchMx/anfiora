// Traduce lo que devuelve Supabase a algo que el planner pueda leer y a la
// decision de si vale la pena reintentar. El codigo tecnico nunca llega a
// pantalla: se manda a Sentry cuando es nuestro.

export type TipoFallo = 'red' | 'permiso' | 'sin_filas' | 'interno'

export type Fallo = {
  tipo: TipoFallo
  detalle: string
  reintentable: boolean
  tecnico: unknown
}

// Un UPDATE o DELETE que RLS filtra no da error: da cero filas. Se marca con
// este objeto para que el traductor lo distinga de un error real.
export const SIN_FILAS = { code: 'ANFIORA_SIN_FILAS', message: 'La escritura no alcanzo ninguna fila' } as const

type ConMensaje = { message?: unknown; code?: unknown; status?: unknown }

function textoDe(error: unknown): { mensaje: string; codigo: string } {
  const e = (error ?? {}) as ConMensaje
  const mensaje = typeof e.message === 'string' ? e.message : error instanceof Error ? error.message : String(error ?? '')
  const codigo = typeof e.code === 'string' ? e.code : ''
  return { mensaje, codigo }
}

export function describirFallo(error: unknown): Fallo {
  const { mensaje, codigo } = textoDe(error)
  const m = mensaje.toLowerCase()

  if (codigo === SIN_FILAS.code) {
    return { tipo: 'sin_filas', detalle: 'Ya no existe o no tienes permiso. Recarga la página.', reintentable: false, tecnico: error }
  }
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/.test(m) || (error instanceof TypeError && /fetch/.test(m))) {
    return { tipo: 'red', detalle: 'Se perdió la conexión.', reintentable: true, tecnico: error }
  }
  if (codigo === '42501' || codigo === 'PGRST301' || codigo === '401' || /permission denied|row-level security|violates .*policy|jwt/.test(m)) {
    return { tipo: 'permiso', detalle: 'No tienes permiso para hacer esto. Pídele acceso de edición al dueño del evento.', reintentable: false, tecnico: error }
  }
  return { tipo: 'interno', detalle: 'Algo falló de nuestro lado. Ya nos llegó el aviso.', reintentable: true, tecnico: error }
}

type Resultado = { data: unknown[] | null; error: { message: string; code?: string } | null }

// Para escrituras que terminan en .select('id'): revisa el error Y que haya
// tocado filas. `esperadas` exige un conteo exacto cuando se sabe cuantas son.
export function falloDeEscritura(r: Resultado, esperadas?: number): Fallo | null {
  if (r.error) return describirFallo(r.error)
  const n = r.data?.length ?? 0
  if (n === 0) return describirFallo(SIN_FILAS)
  if (esperadas !== undefined && n < esperadas) return describirFallo(SIN_FILAS)
  return null
}
