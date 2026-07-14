export type ParsedDrive = {
  id: string
  embedUrl: string
}

export function parseDriveUrl(raw: string): ParsedDrive | null {
  const value = raw.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'drive.google.com') return null

  let id = ''
  const pathMatch = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)
  if (pathMatch) {
    id = pathMatch[1]
  } else {
    id = url.searchParams.get('id') ?? ''
  }
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null
  return { id, embedUrl: `https://drive.google.com/file/d/${id}/preview` }
}
