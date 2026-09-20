import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveMaxSongs } from '@/lib/types'
import { cancionesDelInvitado, limpiarCancionPublica, type CancionPublicaEntrada } from '@/lib/playlist/publica'

// La playlist publica, acotada por token, igual que la mesa de regalos y la
// opinion del cliente. Antes la pagina leia events, event_settings y
// song_recommendations con la llave anonima, y para eso RLS dejaba a
// cualquiera leer TODOS los eventos con playlist. Aqui el token se valida en
// el servidor y solo sale lo que la pagina pinta.

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const COLUMNAS_CANCION = 'id, guest_name, song_title, artist, spotify_url, category, created_at, thumbnail, preview_url, is_host_pick'

type Ajustes = { event_id: string; playlist_categories: unknown; playlist_max_songs: number | null }

async function ajustesDeToken(db: ReturnType<typeof admin>, token: string): Promise<Ajustes | null> {
  if (!token) return null
  const { data } = await db
    .from('event_settings')
    .select('event_id, playlist_categories, playlist_max_songs')
    .eq('playlist_token', token)
    .maybeSingle<Ajustes>()
  return data
}

function categoriasDe(ajustes: Ajustes): string[] {
  return Array.isArray(ajustes.playlist_categories)
    ? ajustes.playlist_categories.filter((c): c is string => typeof c === 'string')
    : []
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = admin()
  const ajustes = await ajustesDeToken(db, token)
  if (!ajustes) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: evento }, { data: canciones }] = await Promise.all([
    db.from('events').select('name, event_date, venue, host_name, host_name_2').eq('id', ajustes.event_id).maybeSingle(),
    db.from('song_recommendations').select(COLUMNAS_CANCION).eq('event_id', ajustes.event_id).order('created_at', { ascending: true }),
  ])
  if (!evento) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({
    evento,
    categorias: categoriasDe(ajustes),
    maxSongs: ajustes.playlist_max_songs,
    canciones: canciones ?? [],
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let body: CancionPublicaEntrada
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_body' }, { status: 400 }) }

  const db = admin()
  const ajustes = await ajustesDeToken(db, token)
  if (!ajustes) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const limpio = limpiarCancionPublica(body, categoriasDe(ajustes))
  if (!limpio.ok) return NextResponse.json({ error: limpio.error }, { status: 400 })

  const limite = resolveMaxSongs(ajustes.playlist_max_songs)
  if (Number.isFinite(limite)) {
    const { data: suyas } = await db
      .from('song_recommendations')
      .select('guest_name, is_host_pick')
      .eq('event_id', ajustes.event_id)
      .eq('guest_name', limpio.fila.guest_name)
    if (cancionesDelInvitado(suyas ?? [], limpio.fila.guest_name) >= limite) {
      return NextResponse.json({ error: 'limite' }, { status: 409 })
    }
  }

  const { data: cancion, error } = await db
    .from('song_recommendations')
    .insert({ ...limpio.fila, event_id: ajustes.event_id, is_host_pick: false })
    .select(COLUMNAS_CANCION)
    .single()
  if (error || !cancion) return NextResponse.json({ error: 'no_guardado' }, { status: 500 })

  return NextResponse.json({ cancion })
}
