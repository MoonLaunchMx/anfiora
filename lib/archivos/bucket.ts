import { supabase } from '@/lib/supabase'
import type { ArchivoAdjunto } from '@/lib/types'
import { type Carpeta, rutaDe, tipoDeArchivo } from './adjuntos'

const BUCKET = 'event-docs'
const VIDA_DEL_ENLACE = 600

export type ResultadoArchivos =
  | { lista: ArchivoAdjunto[]; error?: undefined }
  | { lista?: undefined; error: string }

const RPC_ADJUNTAR: Record<Carpeta, string> = {
  cotizaciones: 'adjuntar_cotizacion',
  comprobantes: 'adjuntar_comprobante',
}

const RPC_QUITAR: Record<Carpeta, string> = {
  cotizaciones: 'quitar_cotizacion',
  comprobantes: 'quitar_comprobante',
}

const ARG_ID: Record<Carpeta, string> = {
  cotizaciones: 'es_id',
  comprobantes: 'pago_id',
}

const SIN_PERMISO = 'No se guardó el archivo. Revisa que sigas teniendo permiso en esta boda.'

export async function subirArchivo(
  eventId: string, carpeta: Carpeta, dueno: string, file: File,
): Promise<ResultadoArchivos> {
  const tipo = tipoDeArchivo(file.name, file.type)
  const ruta = rutaDe(eventId, carpeta, dueno, file.name, crypto.randomUUID())

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, { upsert: false, contentType: tipo })

  if (errorSubida) {
    console.error('Error subiendo archivo:', errorSubida.message, errorSubida)
    return { error: 'No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.' }
  }

  const { data: sesion } = await supabase.auth.getUser()

  const adjunto: ArchivoAdjunto = {
    path: ruta,
    nombre: file.name,
    tipo,
    bytes: file.size,
    subido: new Date().toISOString(),
    por: sesion.user?.id ?? null,
    borrado: null,
  }

  const { data, error } = await supabase.rpc(RPC_ADJUNTAR[carpeta], {
    [ARG_ID[carpeta]]: dueno,
    archivo: adjunto,
  })

  // El archivo ya subio pero la lista no lo registro: queda huerfano en el
  // bucket y ahi se queda. Unos KB invisibles pesan menos que un borrado
  // automatico que algun dia se dispare contra el archivo equivocado.
  if (error) {
    console.error('Error registrando archivo:', error.message, error)
    if (error.message.includes('tope_')) {
      return { error: 'Ya llegaste al tope de archivos aquí. Quita alguno antes de subir otro.' }
    }
    return { error: 'No se guardó el archivo. Intenta de nuevo.' }
  }

  // Una escritura que la policy rechaza devuelve cero filas y ningun error.
  if (!data) return { error: SIN_PERMISO }

  return { lista: data as ArchivoAdjunto[] }
}

export async function quitarArchivo(
  carpeta: Carpeta, dueno: string, path: string,
): Promise<ResultadoArchivos> {
  const { data, error } = await supabase.rpc(RPC_QUITAR[carpeta], {
    [ARG_ID[carpeta]]: dueno,
    ruta: path,
  })

  if (error) {
    console.error('Error quitando archivo:', error.message, error)
    return { error: 'No se pudo quitar el archivo. Intenta de nuevo.' }
  }

  if (!data) return { error: 'No se quitó el archivo. Revisa que sigas teniendo permiso en esta boda.' }

  return { lista: data as ArchivoAdjunto[] }
}

// La URL se firma al momento del clic y vive diez minutos. Nunca se guarda: lo
// que se guarda es la ruta.
export async function abrirArchivo(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, VIDA_DEL_ENLACE)

  if (error || !data) {
    console.error('Error firmando archivo:', error?.message, error)
    return null
  }

  return data.signedUrl
}
