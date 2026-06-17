'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Music, Heart, Check } from 'lucide-react'
import { resolveMaxSongs } from '@/lib/types'

interface Event {
  id: string
  name: string
  event_date: string | null
  venue: string | null
  host_name: string | null
  host_name_2: string | null
}

interface Song {
  id: string
  guest_name: string
  song_title: string
  artist: string
  spotify_url: string | null
  category: string | null
  created_at: string
  thumbnail: string | null
  preview_url: string | null
  is_host_pick: boolean | null
}

interface SpotifyTrack {
  id: string
  title: string
  artist: string
  album: string
  thumbnail: string | null
  spotify_url: string
  duration_ms: number
  preview_url: string | null
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  const months = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ]
  return `${day} de ${months[month - 1]} de ${year}`
}

const STORAGE_KEY_PREFIX = 'anfiora_playlist_'
const josefin = { fontFamily: "'Josefin Sans', sans-serif" }

export default function PlaylistPublicPage() {
  const { token } = useParams()

  const [event, setEvent]                 = useState<Event | null>(null)
  const [categories, setCategories]       = useState<string[]>([])
  const [songs, setSongs]                 = useState<Song[]>([])
  const [maxSongs, setMaxSongs]           = useState<number>(3)
  const [loading, setLoading]             = useState(true)
  const [notFound, setNotFound]           = useState(false)

  const [guestName, setGuestName]         = useState('')
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [category, setCategory]           = useState('')
  const [myCount, setMyCount]             = useState(0)
  const [done, setDone]                   = useState(false)

  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [searching, setSearching]         = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null)
  const [showResults, setShowResults]     = useState(false)
  const searchRef                         = useRef<HTMLDivElement>(null)
  const debounceRef                       = useRef<NodeJS.Timeout | null>(null)

  const [submitting, setSubmitting]       = useState(false)
  const [submitError, setSubmitError]     = useState('')
  const [nameError, setNameError]         = useState('')

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const countMySongs = async (eventId: string, name: string): Promise<number> => {
    const { count } = await supabase
      .from('song_recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('guest_name', name)
      .eq('is_host_pick', false)
    return count || 0
  }

  const loadData = async () => {
    const { data: settingsData } = await supabase
      .from('event_settings')
      .select('event_id, playlist_categories, playlist_max_songs')
      .eq('playlist_token', token)
      .single()

    if (!settingsData) { setNotFound(true); setLoading(false); return }

    const limit = resolveMaxSongs(settingsData.playlist_max_songs)
    setMaxSongs(limit)

    const { data: eventData } = await supabase
      .from('events')
      .select('id, name, event_date, venue, host_name, host_name_2')
      .eq('id', settingsData.event_id)
      .single()

    if (!eventData) { setNotFound(true); setLoading(false); return }

    setEvent(eventData)
    setCategories(Array.isArray(settingsData.playlist_categories) ? settingsData.playlist_categories : [])

    const { data: songsData } = await supabase
      .from('song_recommendations')
      .select('id, guest_name, song_title, artist, spotify_url, category, created_at, thumbnail, preview_url, is_host_pick')
      .eq('event_id', eventData.id)
      .order('created_at', { ascending: true })

    setSongs(songsData || [])

    const storageKey = STORAGE_KEY_PREFIX + token
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.name && parsed.eventId === eventData.id) {
          setGuestName(parsed.name)
          setNameConfirmed(true)
          const dbCount = await countMySongs(eventData.id, parsed.name)
          setMyCount(dbCount)
          if (Number.isFinite(limit) && dbCount >= limit) setDone(true)
        }
      } catch {}
    }

    setLoading(false)
  }

  const handleConfirmName = async () => {
    const trimmed = guestName.trim()
    if (!trimmed) { setNameError('¿Cómo te llaman?'); return }
    setNameError('')

    const dbCount = await countMySongs(event!.id, trimmed)
    setMyCount(dbCount)
    if (Number.isFinite(maxSongs) && dbCount >= maxSongs) {
      setDone(true)
      setNameConfirmed(true)
      return
    }

    localStorage.setItem(STORAGE_KEY_PREFIX + token, JSON.stringify({
      name: trimmed,
      eventId: event!.id,
    }))
    setNameConfirmed(true)
  }

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); setShowResults(false); return }
    setSearching(true)
    setShowResults(true)
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSearchResults(data.tracks || [])
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedTrack(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(value), 400)
  }

  const handleSelectTrack = (track: SpotifyTrack) => {
    setSelectedTrack(track)
    setSearchQuery(`${track.title} — ${track.artist}`)
    setShowResults(false)
    setSearchResults([])
  }

  const handleSubmit = async () => {
    if (!selectedTrack) { setSubmitError('Busca y selecciona una canción primero'); return }
    if (Number.isFinite(maxSongs) && myCount >= maxSongs) return

    const dbCount = await countMySongs(event!.id, guestName.trim())
    if (Number.isFinite(maxSongs) && dbCount >= maxSongs) {
      setDone(true)
      setMyCount(dbCount)
      return
    }

    setSubmitting(true)
    setSubmitError('')

    const { error } = await supabase.from('song_recommendations').insert({
      event_id: event!.id,
      guest_name: guestName.trim(),
      song_title: selectedTrack.title,
      artist: selectedTrack.artist,
      category: category || null,
      spotify_url: selectedTrack.spotify_url,
      thumbnail: selectedTrack.thumbnail,
      preview_url: selectedTrack.preview_url,
      duration_ms: selectedTrack.duration_ms,
    })

    if (error) { setSubmitError('Algo salió mal, intenta de nuevo'); setSubmitting(false); return }

    setSongs(prev => [...prev, {
      id: crypto.randomUUID(),
      guest_name: guestName.trim(),
      song_title: selectedTrack.title,
      artist: selectedTrack.artist,
      category: category || null,
      spotify_url: selectedTrack.spotify_url,
      created_at: new Date().toISOString(),
      thumbnail: selectedTrack.thumbnail,
      preview_url: selectedTrack.preview_url,
      is_host_pick: false,
    }])

    const newCount = myCount + 1
    setMyCount(newCount)
    setSearchQuery('')
    setSelectedTrack(null)
    setCategory('')
    setSubmitError('')
    setSubmitting(false)
    if (Number.isFinite(maxSongs) && newCount >= maxSongs) setDone(true)
  }

  const hostSongs  = songs.filter(s => !!s.is_host_pick)
  const guestSongs = songs.filter(s => !s.is_host_pick)

  const couple = event?.host_name && event?.host_name_2
    ? `${event.host_name} & ${event.host_name_2}`
    : event?.name || ''

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
    </div>
  )

  if (notFound) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
      <a href="/" className="mb-10 text-2xl font-bold tracking-tight text-[#1D1E20]" style={josefin}>
        Anfiora
      </a>
      <Music size={32} className="mb-3 text-[#bbb]" />
      <h1 className="text-lg font-semibold text-[#1D1E20]">Playlist no encontrada</h1>
      <p className="mt-1 text-sm text-[#888]">
        Es posible que este link haya expirado o no sea válido.
      </p>
      <a
        href="/"
        className="mt-8 rounded-full bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Ir a Anfiora
      </a>
    </div>
  )

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#FBF7F0]">

      {/* Hero (fijo) */}
      <section className="mx-auto w-full max-w-2xl shrink-0 px-6 pb-4 pt-8 text-center sm:pt-10">
        <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-[#aaa]" style={josefin}>
          Playlist del evento
        </p>
        <h1 className="text-4xl font-bold leading-tight text-[#1D1E20] sm:text-5xl" style={josefin}>
          {couple}
        </h1>
        {event?.event_date && (
          <p className="mt-4 text-sm tracking-wide text-[#666]" style={josefin}>
            {formatEventDate(event.event_date)}
          </p>
        )}
        {event?.venue && <p className="mt-1 text-xs text-[#999]">{event.venue}</p>}
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#666]">
          Ayúdanos a armar la playlist con las canciones que no pueden faltar.
        </p>
      </section>

      {/* Solo esta zona scrollea (debajo del hero) */}
      <div className="flex flex-1 flex-col overflow-y-auto">

        {/* Canciones de los novios */}
        {hostSongs.length > 0 && (
          <section className="mx-auto w-full max-w-lg px-5 pb-2">
            <div className="mb-3 flex items-center justify-center gap-1.5">
              <Heart size={13} className="text-[#48C9B0]" fill="currentColor" />
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#aaa]" style={josefin}>
                Las canciones de los novios
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {hostSongs.map(song => (
                <a
                  key={song.id}
                  href={song.spotify_url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl border border-[#d8f0ea] bg-white px-4 py-3 transition hover:border-[#48C9B0]"
                >
                  <div className="flex items-center gap-3">
                    {song.thumbnail ? (
                      <img src={song.thumbnail} alt={song.song_title} className="h-9 w-9 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#f0fdfb]">
                        <Music size={14} className="text-[#48C9B0]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#1D1E20]">{song.song_title}</p>
                      <p className="truncate text-xs text-[#999]">{song.artist}</p>
                    </div>
                    <Heart size={13} className="shrink-0 text-[#48C9B0]" fill="currentColor" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Form */}
        <div className="mx-auto w-full max-w-lg px-5 py-4">

          {!done && Number.isFinite(maxSongs) && (
            <p className="mb-6 text-center text-sm text-[#999]">
              Hasta {maxSongs} canci{maxSongs === 1 ? 'ón' : 'ones'} por persona.
            </p>
          )}

          {!nameConfirmed ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#eee4d6] bg-white p-5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888]">Tu nombre</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={e => { setGuestName(e.target.value); setNameError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleConfirmName() }}
                  placeholder="¿Cómo te llaman?"
                  className="min-w-0 flex-1 rounded-lg border border-[#e0e0e0] bg-white px-4 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
                <button
                  onClick={handleConfirmName}
                  className="shrink-0 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3aa896]"
                >
                  Continuar
                </button>
              </div>
              {nameError && <p className="text-xs text-[#cc3333]">{nameError}</p>}
            </div>

          ) : done ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#f0fdfb] text-[#1a9e88]">
                <Check size={20} strokeWidth={2.4} />
              </div>
              <p className="text-xl font-bold text-[#1D1E20]" style={josefin}>
                ¡Gracias, {guestName.split(' ')[0]}!
              </p>
              <p className="mt-1 text-sm text-[#888]">
                Ya agregaste tus {maxSongs === 1 ? 'canción' : `${maxSongs} canciones`}.
              </p>
            </div>

          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#eee4d6] bg-white p-5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Hola, {guestName.split(' ')[0]}
                </label>
                {Number.isFinite(maxSongs) && (
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#48C9B0]">
                    {myCount}/{maxSongs} canciones
                  </span>
                )}
              </div>

              {categories.length > 0 && (
                <>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888]">Etapa</label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat: string) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(prev => prev === cat ? '' : cat)}
                        className={'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                          (category === cat
                            ? 'border-[#48C9B0] bg-[#48C9B0] text-white'
                            : 'border-[#e0e0e0] text-[#888] hover:border-[#48C9B0] hover:text-[#48C9B0]'
                          )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888]">Canción</label>
              <div ref={searchRef} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowResults(true) }}
                  placeholder="Busca una canción en Spotify..."
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-4 py-2.5 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#48C9B0] border-t-transparent" />
                  </div>
                )}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#eee4d6] bg-white shadow-lg">
                    {searchResults.map(track => (
                      <button
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f0fdfb]"
                      >
                        {track.thumbnail ? (
                          <img src={track.thumbnail} alt={track.title} className="h-10 w-10 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded bg-[#f0f0f0]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#1D1E20]">{track.title}</p>
                          <p className="truncate text-xs text-[#999]">{track.artist} · {track.album}</p>
                        </div>
                        <span className="shrink-0 text-xs text-[#ccc]">{formatDuration(track.duration_ms)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTrack && (
                <div className="rounded-xl border border-[#48C9B0] bg-[#f0fdfb] px-4 py-3">
                  <div className="flex items-center gap-3">
                    {selectedTrack.thumbnail && (
                      <img src={selectedTrack.thumbnail} alt={selectedTrack.title} className="h-10 w-10 shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#1D1E20]">{selectedTrack.title}</p>
                      <p className="truncate text-xs text-[#999]">{selectedTrack.artist}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTrack(null)
                        setSearchQuery('')
                      }}
                      className="shrink-0 text-[#aaa] transition hover:text-[#666]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {submitError && <p className="text-xs text-[#cc3333]">{submitError}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedTrack}
                className="w-full rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-30"
              >
                {submitting
                  ? 'Guardando...'
                  : myCount === 0 || !Number.isFinite(maxSongs)
                    ? 'Agregar canción'
                    : `Agregar canción (${myCount + 1} de ${maxSongs})`}
              </button>
            </div>
          )}
        </div>

        {/* Lista de sugerencias */}
        {guestSongs.length > 0 && (
          <div className="mx-auto w-full max-w-lg px-5 pb-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#eee4d6]" />
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#bbb]" style={josefin}>
                {guestSongs.length} canci{guestSongs.length !== 1 ? 'ones' : 'ón'} en la lista
              </p>
              <div className="h-px flex-1 bg-[#eee4d6]" />
            </div>

            <div className="flex flex-col gap-2">
              {guestSongs.map(song => (
                <a
                  key={song.id}
                  href={song.spotify_url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl border border-[#eee4d6] bg-white px-4 py-3 transition hover:border-[#48C9B0]"
                >
                  <div className="flex items-center gap-3">
                    {song.thumbnail ? (
                      <img src={song.thumbnail} alt={song.song_title} className="h-9 w-9 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded bg-[#f5f0e8]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#1D1E20]">
                        {song.song_title}
                      </p>
                      <p className="truncate text-xs text-[#bbb]">
                        {song.artist}
                        <span className="mx-1.5 text-[#ddd]">·</span>
                        <span className="text-[#1a9e88]">{song.guest_name}</span>
                      </p>
                    </div>
                    {song.category && (
                      <span className="shrink-0 rounded-full border border-[#eee4d6] px-2.5 py-0.5 text-[10px] text-[#bbb]">
                        {song.category}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-auto border-t border-[#eee4d6] bg-[#F5EFE3] py-6 text-center">
          <p className="text-base font-bold tracking-wide text-[#1D1E20]" style={josefin}>Anfiora</p>
          <p className="mt-1 text-[11px] text-[#aaa]">La playlist de tu evento</p>
        </footer>
      </div>
    </div>
  )
}
