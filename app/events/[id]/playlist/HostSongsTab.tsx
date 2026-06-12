'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Music, Heart, Trash2, ExternalLink } from 'lucide-react'

interface HostSong {
  id: string
  song_title: string
  artist: string
  spotify_url: string | null
  thumbnail: string | null
  duration_ms: number | null
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

function formatDuration(ms: number | null): string {
  if (!ms) return ''
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function HostSongsTab({
  eventId, hostLabel, songs, onAdded, onRemove,
}: {
  eventId: string
  hostLabel: string
  songs: HostSong[]
  onAdded: (song: HostSong & { is_host_pick: boolean; guest_name: string }) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState<SpotifyTrack[]>([])
  const [searching, setSearching]       = useState(false)
  const [showResults, setShowResults]   = useState(false)
  const [adding, setAdding]             = useState(false)
  const [error, setError]               = useState('')
  const searchRef                       = useRef<HTMLDivElement>(null)
  const debounceRef                     = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setShowResults(false); return }
    setSearching(true)
    setShowResults(true)
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.tracks || [])
    } catch {
      setResults([])
    }
    setSearching(false)
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(value), 400)
  }

  const addTrack = async (track: SpotifyTrack) => {
    setAdding(true)
    setError('')
    setShowResults(false)
    const { data, error: insertError } = await supabase
      .from('song_recommendations')
      .insert({
        event_id: eventId,
        guest_name: hostLabel,
        song_title: track.title,
        artist: track.artist,
        category: null,
        spotify_url: track.spotify_url,
        thumbnail: track.thumbnail,
        preview_url: track.preview_url,
        duration_ms: track.duration_ms,
        is_host_pick: true,
      })
      .select('*')
      .single()

    if (insertError || !data) {
      setError('No se pudo agregar, intenta de nuevo')
    } else {
      onAdded(data)
      setQuery('')
      setResults([])
    }
    setAdding(false)
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5 rounded-xl border border-[#e8e8e8] bg-white p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <Heart size={14} className="text-[#48C9B0]" />
          <p className="text-sm font-semibold text-[#1D1E20]">Sus canciones</p>
        </div>
        <p className="mb-3 text-xs text-[#888]">
          Las que no pueden faltar. Se muestran destacadas a sus invitados y van primero en el archivo del DJ.
        </p>

        <div ref={searchRef} className="relative">
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowResults(true) }}
            placeholder="Busca una canción en Spotify..."
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#48C9B0] border-t-transparent" />
            </div>
          )}
          {showResults && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
              {results.map(track => (
                <button
                  key={track.id}
                  onClick={() => addTrack(track)}
                  disabled={adding}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#f0fdfb] disabled:opacity-50"
                >
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.title} className="h-10 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#f0f0f0]">
                      <Music size={16} className="text-[#ccc]" />
                    </div>
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
        {error && <p className="mt-2 text-xs text-[#cc3333]">{error}</p>}
      </div>

      {songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Heart size={24} className="mb-2 text-[#ddd]" />
          <p className="text-sm font-semibold text-[#1D1E20]">Aún no agregan canciones</p>
          <p className="mt-1 text-xs text-[#999]">Busca arriba y arma su lista.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {songs.map(song => (
            <div key={song.id} className="flex items-center gap-3 rounded-xl border border-[#d8d8d8] bg-white px-3 py-3">
              {song.thumbnail ? (
                <img src={song.thumbnail} alt={song.song_title} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f0f0f0]">
                  <Music size={18} className="text-[#ccc]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-sm font-semibold text-[#1D1E20]">{song.song_title}</p>
                  {song.duration_ms && (
                    <span className="shrink-0 text-xs text-[#aaa]">{formatDuration(song.duration_ms)}</span>
                  )}
                </div>
                <p className="truncate text-xs text-[#888]">{song.artist}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {song.spotify_url && (
                  <button
                    onClick={() => window.open(song.spotify_url!, '_blank')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#f5f5f5] hover:text-[#1DB954]"
                    title="Abrir en Spotify"
                  >
                    <ExternalLink size={16} />
                  </button>
                )}
                <button
                  onClick={() => onRemove(song.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#fff0f0] hover:text-[#cc3333]"
                  title="Quitar canción"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
