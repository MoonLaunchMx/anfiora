'use client'
import { useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import type { Section } from '@/lib/invite/schema'
import { parseDriveUrl } from '@/lib/invite/drive'
import type { InviteCtx } from '../types'

type Content = Extract<Section, { type: 'audio' }>['content']

export default function AudioSection({ content }: { content: Content; ctx: InviteCtx }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const hasClip = content.url.trim().length > 0
  const drive = parseDriveUrl(content.drive_url)
  if (!hasClip && !drive) return null

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
    <figure className="mx-auto flex w-full max-w-md flex-col gap-3 px-6">
      {hasClip && (
        <div
          className="flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm"
          style={{ borderColor: 'color-mix(in srgb, var(--inv-texto) 15%, transparent)', color: 'var(--inv-texto)' }}
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow transition hover:opacity-90"
            style={{ backgroundColor: 'var(--inv-boton-bg, #48C9B0)', color: 'var(--inv-boton-texto, #ffffff)' }}
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-0.5" fill="currentColor" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{content.titulo.trim() || 'Un mensaje para ti'}</p>
            {content.caption.trim() && <p className="truncate text-xs opacity-70">{content.caption}</p>}
          </div>
          <audio ref={audioRef} src={content.url} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
        </div>
      )}

      {drive && (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'color-mix(in srgb, var(--inv-texto) 15%, transparent)' }}>
          <iframe
            src={drive.embedUrl}
            title="Reproductor de audio"
            className="w-full border-0"
            style={{ height: 80 }}
            loading="lazy"
            allow="autoplay; encrypted-media"
          />
        </div>
      )}
    </figure>
  )
}
