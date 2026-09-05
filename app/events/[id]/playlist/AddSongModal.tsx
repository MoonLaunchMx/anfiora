'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Music, Check } from 'lucide-react'
import { usePermiso } from '@/lib/event-access-context'
import { Modal } from '@/app/components/ui/Modal'

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

export default function AddSongModal({
  isOpen, eventId, hostLabel, nextPosition, onClose, onAdded,
}: {
  isOpen: boolean
  eventId: string
  hostLabel: string
  nextPosition: number
  onClose: () => void
  onAdded: (song: any) => void
}) {
  const permiso = usePermiso('playlist')
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SpotifyTrack[]>([])
  const [searching, setSearching]   = useState(false)
  const [adding, setAdding]         = useState(false)
  const [error, setError]           = useState('')
  const [lastAdded, setLastAdded]   = useState<string | null>(null)
  const debounceRef                 = useRef<NodeJS.Timeout | null>(null)
  const positionRef                 = useRef(nextPosition)

  useEffect(() => { positionRef.current = nextPosition }, [nextPosition])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setError('')
      setLastAdded(null)
    }
  }, [isOpen])

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
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
    setLastAdded(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(value), 400)
  }

  const addTrack = async (track: SpotifyTrack) => {
    if (!permiso.editar) return
    setAdding(true)
    setError('')
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
        position: positionRef.current,
      })
      .select('*')
      .single()

    if (insertError || !data) {
      setError('No se pudo agregar, intenta de nuevo')
    } else {
      onAdded(data)
      setLastAdded(`${track.title} — ${track.artist}`)
      setQuery('')
      setResults([])
    }
    setAdding(false)
  }

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header
        title="Agregar canción"
        subtitle="Se marcará como canción de los novios."
      />

      <Modal.Body>
        <div className="relative">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Busca una canción en Spotify..."
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#48C9B0] border-t-transparent" />
            </div>
          )}
        </div>

        {lastAdded && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f0fdfb] px-3 py-2">
            <Check size={14} className="shrink-0 text-[#1a9e88]" />
            <p className="truncate text-xs text-[#1a9e88]">Agregada: {lastAdded}</p>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-[#cc3333]">{error}</p>}

        {results.length > 0 && (
          <div className="mt-3 divide-y divide-[#f0f0f0] rounded-xl border border-[#e8e8e8]">
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

        {query.trim().length < 2 && results.length === 0 && !lastAdded && (
          <p className="mt-6 text-center text-xs text-[#bbb]">
            Escribe el nombre de la canción o del artista.
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="ml-auto rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
        >
          Listo
        </button>
      </Modal.Footer>
    </Modal>
  )
}
