import { NextRequest, NextResponse } from 'next/server'
import { usuarioDeRequest } from '@/lib/workspace/servidor'

type GiphyImage = { url?: string }
type GiphyGif = { id: string; images?: Record<string, GiphyImage> }

// Pide sesion: la llave de Giphy es nuestra y la cuota tambien. La unica
// pantalla que la llama es el editor de invitacion, con el planner dentro.
export async function GET(req: NextRequest) {
  if (!(await usuarioDeRequest(req))) {
    return NextResponse.json({ error: 'No autorizado', results: [] }, { status: 401 })
  }
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const key = process.env.GIPHY_API_KEY
  if (!key) return NextResponse.json({ error: 'no_key', results: [] })
  if (!q) return NextResponse.json({ results: [] })
  const api = `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
  try {
    const r = await fetch(api)
    if (!r.ok) return NextResponse.json({ error: 'giphy_error', results: [] })
    const data = (await r.json()) as { data?: GiphyGif[] }
    const results = (data.data ?? [])
      .map(g => ({
        id: g.id,
        preview: g.images?.fixed_height_small?.url ?? g.images?.fixed_height?.url ?? '',
        url: g.images?.downsized?.url ?? g.images?.fixed_height?.url ?? '',
      }))
      .filter(x => x.url)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'fetch_failed', results: [] })
  }
}
