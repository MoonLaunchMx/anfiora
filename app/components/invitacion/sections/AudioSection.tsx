'use client'
import { useRef, useState } from 'react'
import { Play, Pause, Music2 } from 'lucide-react'
import { FaSpotify } from 'react-icons/fa'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'

type Content = Extract<Section, { type: 'audio' }>['content']

export default function AudioSection({ content }: { content: Content; ctx: InviteCtx }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const hasClip = content.url.trim().length > 0
  const hasSpotify = content.spotify_url.trim().length > 0
  if (!hasClip && !hasSpotify) return null

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  return (
    <figure className="mx-auto w-full max-w-md px-6">
      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm"
        style={{ borderColor: 'color-mix(in srgb, var(--inv-texto) 15%, transparent)', color: 'var(--inv-texto)' }}
      >
        {hasClip ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow transition hover:opacity-90"
            style={{ backgroundColor: 'var(--inv-boton-bg, #48C9B0)', color: 'var(--inv-boton-texto, #ffffff)' }}
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-0.5" fill="currentColor" />}
          </button>
        ) : (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'color-mix(in srgb, var(--inv-texto) 10%, transparent)' }}
          >
            <Music2 size={18} className="opacity-70" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{content.titulo.trim() || 'Un mensaje para ti'}</p>
          {content.caption.trim() && <p className="truncate text-xs opacity-70">{content.caption}</p>}
        </div>

        {hasSpotify && (
          <a
            href={content.spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#1DB954' }}
          >
            <FaSpotify size={14} /> Spotify
          </a>
        )}
      </div>
      {hasClip && (
        <audio ref={audioRef} src={content.url} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      )}
    </figure>
  )
}
