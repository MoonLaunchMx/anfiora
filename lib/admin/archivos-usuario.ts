// Que archivos hay que borrar cuando se elimina una cuenta. La cascada de
// Postgres limpia las filas, pero los buckets no cuelgan de ninguna tabla: si
// esto no corre, el Aviso de Privacidad promete un borrado que no ocurre.
//
// Las rutas las arman lib/workspace/imagenes.ts (event-media) y
// lib/archivos/adjuntos.ts (event-docs). Si cambian alla, cambian aqui.

export const BUCKET_MEDIA = 'event-media'
export const BUCKET_DOCS = 'event-docs'

// event-media guarda <carpeta>/<id>/archivo. Las de evento se borran por evento;
// avatars va por usuario y logos por workspace.
const CARPETAS_POR_EVENTO = ['imagenes', 'audio', 'dress-code'] as const

export type IdsDelUsuario = {
  userId: string
  eventIds: string[]
  workspaceIds: string[]
}

export type PrefijosABorrar = { bucket: string; prefijo: string }[]

export function prefijosABorrar({ userId, eventIds, workspaceIds }: IdsDelUsuario): PrefijosABorrar {
  const prefijos: PrefijosABorrar = []

  if (userId) prefijos.push({ bucket: BUCKET_MEDIA, prefijo: `avatars/${userId}` })
  for (const wsId of unicos(workspaceIds)) {
    prefijos.push({ bucket: BUCKET_MEDIA, prefijo: `logos/${wsId}` })
  }
  for (const eventId of unicos(eventIds)) {
    for (const carpeta of CARPETAS_POR_EVENTO) {
      prefijos.push({ bucket: BUCKET_MEDIA, prefijo: `${carpeta}/${eventId}` })
    }
    // event-docs cuelga del evento: <eventId>/cotizaciones|comprobantes/<dueno>/
    prefijos.push({ bucket: BUCKET_DOCS, prefijo: eventId })
  }

  return prefijos
}

function unicos(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

// Lo que devuelve storage.list(): las carpetas vienen con id null.
export type EntradaStorage = { name: string; id: string | null }

export type ClienteStorage = {
  list(prefijo: string): Promise<{ data: EntradaStorage[] | null; error: { message: string } | null }>
  remove(rutas: string[]): Promise<{ error: { message: string } | null }>
}

// Storage no borra recursivo: hay que listar carpeta por carpeta. El tope de
// profundidad evita quedarse dando vueltas si el bucket devuelve algo raro.
export async function rutasBajoPrefijo(
  cliente: ClienteStorage,
  prefijo: string,
  profundidad = 0,
): Promise<{ rutas: string[]; error: string | null }> {
  if (profundidad > 4) return { rutas: [], error: null }

  const { data, error } = await cliente.list(prefijo)
  if (error) return { rutas: [], error: error.message }
  if (!data || data.length === 0) return { rutas: [], error: null }

  const rutas: string[] = []
  for (const entrada of data) {
    const ruta = `${prefijo}/${entrada.name}`
    if (entrada.id === null) {
      const abajo = await rutasBajoPrefijo(cliente, ruta, profundidad + 1)
      if (abajo.error) return { rutas: [], error: abajo.error }
      rutas.push(...abajo.rutas)
    } else {
      rutas.push(ruta)
    }
  }
  return { rutas, error: null }
}
