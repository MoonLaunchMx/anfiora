import { parseDriveUrl } from './drive'

export type VideoProvider = 'youtube' | 'tiktok' | 'instagram' | 'drive'

export type ParsedVideo = {
  provider: VideoProvider
  id: string
  embedUrl: string
  aspect: 'landscape' | 'portrait'
  poster: string | null
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/
const IG_KINDS = new Set(['reel', 'reels', 'p', 'tv'])

function clean(raw: string): string {
  return raw.trim()
}

function parseYouTube(url: URL): ParsedVideo | null {
  const host = url.hostname.replace(/^www\./, '')
  let id = ''
  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] ?? ''
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v') ?? ''
    } else {
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1] ?? ''
    }
  } else {
    return null
  }
  if (!YT_ID.test(id)) return null
  return {
    provider: 'youtube',
    id,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    aspect: 'landscape',
    poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  }
}

function parseTikTok(url: URL): ParsedVideo | null {
  const host = url.hostname.replace(/^www\./, '')
  if (!host.endsWith('tiktok.com')) return null
  const parts = url.pathname.split('/').filter(Boolean)
  // .../@user/video/123456  |  /embed/v2/123456  |  /v/123456
  const digits = parts.find(p => /^\d{6,}$/.test(p))
  if (!digits) return null
  return {
    provider: 'tiktok',
    id: digits,
    embedUrl: `https://www.tiktok.com/embed/v2/${digits}`,
    aspect: 'portrait',
    poster: null,
  }
}

function parseInstagram(url: URL): ParsedVideo | null {
  const host = url.hostname.replace(/^www\./, '')
  if (!host.endsWith('instagram.com')) return null
  const parts = url.pathname.split('/').filter(Boolean)
  const kindIdx = parts.findIndex(p => IG_KINDS.has(p))
  if (kindIdx === -1) return null
  const rawKind = parts[kindIdx]
  const kind = rawKind === 'reels' ? 'reel' : rawKind
  const code = parts[kindIdx + 1]
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  return {
    provider: 'instagram',
    id: code,
    embedUrl: `https://www.instagram.com/${kind}/${code}/embed`,
    aspect: 'portrait',
    poster: null,
  }
}

export function parseVideoUrl(raw: string): ParsedVideo | null {
  const value = clean(raw)
  if (!value) return null
  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }
  const social = parseYouTube(url) ?? parseTikTok(url) ?? parseInstagram(url)
  if (social) return social

  const drive = parseDriveUrl(value)
  if (drive) {
    return {
      provider: 'drive',
      id: drive.id,
      embedUrl: drive.embedUrl,
      aspect: 'landscape',
      poster: null,
    }
  }
  return null
}
