export type SpotifyType = 'track' | 'album' | 'playlist' | 'episode' | 'show' | 'artist'

export type ParsedSpotify = {
  type: SpotifyType
  id: string
  embedUrl: string
  compact: boolean
}

const TYPES = new Set<SpotifyType>(['track', 'album', 'playlist', 'episode', 'show', 'artist'])

function build(type: SpotifyType, id: string): ParsedSpotify {
  const compact = type === 'track' || type === 'episode'
  return {
    type,
    id,
    embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
    compact,
  }
}

export function parseSpotifyUrl(raw: string): ParsedSpotify | null {
  const value = raw.trim()
  if (!value) return null

  const uri = value.match(/^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]+)$/)
  if (uri) return build(uri[1] as SpotifyType, uri[2])

  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'open.spotify.com' && host !== 'spotify.com') return null

  const parts = url.pathname.split('/').filter(Boolean)
  const idx = parts.findIndex(p => TYPES.has(p as SpotifyType))
  if (idx === -1) return null
  const type = parts[idx] as SpotifyType
  const id = parts[idx + 1]
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return null
  return build(type, id)
}
