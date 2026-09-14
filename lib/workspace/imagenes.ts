// Reglas de las imagenes de cuenta y workspace. Puro a proposito: no importa
// lib/supabase, para que se pueda probar con Vitest (la subida vive en
// lib/workspace/subir.ts, que si toca el cliente).

export type Carpeta = 'avatars' | 'logos'

export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_BYTES = 4 * 1024 * 1024

export type Validacion = { ok: true; error?: undefined } | { ok: false; error: string }

const MB = (n: number) => `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`

export function validarImagen(file: { type: string; size: number; name?: string }): Validacion {
  const tipo = (file.type || '').toLowerCase()

  // El iPhone manda HEIC cuando no se convierte al elegir la foto, y ningun
  // navegador la dibuja: se rechaza con la salida, no con un "tipo invalido".
  if (tipo === 'image/heic' || tipo === 'image/heif') {
    return { ok: false, error: 'Esa foto es HEIC y no se ve en el navegador. Guárdala como JPG y vuelve a intentar.' }
  }
  if (!(TIPOS_ACEPTADOS as readonly string[]).includes(tipo)) {
    return { ok: false, error: 'Usa una imagen JPG, PNG o WEBP.' }
  }
  if (file.size <= 0) return { ok: false, error: 'Ese archivo está vacío.' }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `La imagen pesa ${MB(file.size)} y el tope son ${MB(MAX_BYTES)}.` }
  }
  return { ok: true }
}

export function nombreSeguro(nombre: string): string {
  const limpio = nombre.normalize('NFD').replace(/[^a-zA-Z0-9.-]/g, '_')
  return limpio.slice(-60) || 'imagen'
}

// La ruta lleva el id del dueno para que se sepa de quien es un archivo con
// solo mirar el bucket, y un sello unico para no pisar la imagen anterior.
export function rutaDeImagen(carpeta: Carpeta, id: string, nombre: string, sello: string): string {
  return `${carpeta}/${id}/${sello}-${nombreSeguro(nombre)}`
}

// Solo se borra lo que vive en la carpeta que le toca: nunca se acepta una
// ruta que venga de otro lado.
export function esRutaPropia(carpeta: Carpeta, id: string, ruta: string): boolean {
  return ruta.startsWith(`${carpeta}/${id}/`)
}

// De la URL publica de Supabase se recupera la ruta para poder borrarla.
export function rutaDesdeUrl(url: string, bucket: string): string | null {
  const marca = `/object/public/${bucket}/`
  const i = url.indexOf(marca)
  if (i < 0) return null
  const ruta = url.slice(i + marca.length).split('?')[0]
  return ruta.length > 0 ? decodeURIComponent(ruta) : null
}
