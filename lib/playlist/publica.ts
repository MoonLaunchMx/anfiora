// La playlist publica (/playlist/[token]) escribe por la API con service role,
// no con la llave anonima: lo que llega del navegador se limpia aqui antes de
// tocar la base. El planner abre spotify_url con window.open, asi que un link
// que no sea de Spotify es un script corriendo en su sesion.

export type CancionPublicaEntrada = {
  guest_name?: unknown
  category?: unknown
  song_title?: unknown
  artist?: unknown
  spotify_url?: unknown
  thumbnail?: unknown
  preview_url?: unknown
  duration_ms?: unknown
}

export type CancionPublicaFila = {
  guest_name: string
  category: string | null
  song_title: string
  artist: string
  spotify_url: string
  thumbnail: string | null
  preview_url: string | null
  duration_ms: number | null
}

export type ResultadoCancion =
  | { ok: true; fila: CancionPublicaFila }
  | { ok: false; error: 'faltan_datos' | 'link_invalido' }

const MAX_NOMBRE = 120
const MAX_TEXTO = 300
const MAX_DURACION_MS = 60 * 60 * 1000

function httpsDe(valor: unknown, hostValido: (host: string) => boolean): string | null {
  if (typeof valor !== 'string' || valor.length > 2048) return null
  try {
    const u = new URL(valor)
    if (u.protocol !== 'https:' || !hostValido(u.hostname)) return null
    return u.toString()
  } catch {
    return null
  }
}

export function urlSpotifySegura(valor: unknown): string | null {
  return httpsDe(valor, h => h === 'open.spotify.com')
}

const esCdnSpotify = (h: string) => h === 'scdn.co' || h.endsWith('.scdn.co')

function texto(valor: unknown, max: number): string {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : ''
}

export function limpiarCancionPublica(
  entrada: CancionPublicaEntrada,
  categorias: string[],
): ResultadoCancion {
  const guest_name = texto(entrada.guest_name, MAX_NOMBRE)
  const song_title = texto(entrada.song_title, MAX_TEXTO)
  if (!guest_name || !song_title) return { ok: false, error: 'faltan_datos' }

  const spotify_url = urlSpotifySegura(entrada.spotify_url)
  if (!spotify_url) return { ok: false, error: 'link_invalido' }

  const categoria = texto(entrada.category, MAX_TEXTO)
  const duracion = Number(entrada.duration_ms)

  return {
    ok: true,
    fila: {
      guest_name,
      song_title,
      artist: texto(entrada.artist, MAX_TEXTO),
      spotify_url,
      category: categoria && categorias.includes(categoria) ? categoria : null,
      thumbnail: httpsDe(entrada.thumbnail, esCdnSpotify),
      preview_url: httpsDe(entrada.preview_url, esCdnSpotify),
      duration_ms: Number.isInteger(duracion) && duracion > 0 && duracion <= MAX_DURACION_MS ? duracion : null,
    },
  }
}

export function cancionesDelInvitado(
  canciones: { guest_name: string; is_host_pick: boolean | null }[],
  nombre: string,
): number {
  const buscado = nombre.trim()
  return canciones.filter(c => !c.is_host_pick && c.guest_name === buscado).length
}
