'use client'
import { supabase } from '@/lib/supabase'
import { type Carpeta, esRutaPropia, rutaDeImagen, rutaDesdeUrl, validarImagen } from './imagenes'

// Mismo bucket publico que ya usan invitacion y codigo de vestimenta: la URL
// se sirve directa, sin firmar, porque un logo y una foto de perfil salen en
// pantallas que ve gente sin sesion.
export const BUCKET = 'event-media'

export type ResultadoImagen = { url: string; error?: undefined } | { url?: undefined; error: string }

export async function subirImagen(carpeta: Carpeta, id: string, file: File): Promise<ResultadoImagen> {
  const v = validarImagen(file)
  if (!v.ok) return { error: v.error }

  const sello = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const ruta = rutaDeImagen(carpeta, id, file.name, sello)

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, {
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    console.error('Error subiendo imagen:', error.message, error)
    return { error: 'No se pudo subir la imagen. Revisa tu conexión e intenta de nuevo.' }
  }

  return { url: supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl }
}

// Se borra la anterior solo si de verdad era de este dueno y de esta carpeta.
// Si falla, no se dice nada: el archivo huerfano pesa menos que un error que
// no le sirve a nadie, y el mismo criterio ya se uso en lib/archivos.
export async function borrarImagenAnterior(carpeta: Carpeta, id: string, url: string | null): Promise<void> {
  if (!url) return
  const ruta = rutaDesdeUrl(url, BUCKET)
  if (!ruta || !esRutaPropia(carpeta, id, ruta)) return
  const { error } = await supabase.storage.from(BUCKET).remove([ruta])
  if (error) console.error('No se pudo borrar la imagen anterior:', error.message)
}
