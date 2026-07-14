'use client'
import { useState } from 'react'
import { Play } from 'lucide-react'
import type { Section } from '@/lib/invite/schema'
import { parseVideoUrl } from '@/lib/invite/video'
import type { InviteCtx } from '../types'

type Content = Extract<Section, { type: 'video' }>['content']

// Alto visible del marco (box) vs alto real del iframe (frame). El iframe es mas
// alto que el marco para que el embed no genere scroll interno; el marco con
// overflow-hidden recorta el chrome (musica, comentarios) y deja el video limpio.
const PORTRAIT: Record<'tiktok' | 'instagram', { box: number; frame: number }> = {
  tiktok: { box: 575, frame: 800 },
  instagram: { box: 640, frame: 740 },
}

export default function VideoSection({ content }: { content: Content; ctx: InviteCtx }) {
  const [playing, setPlaying] = useState(false)
  const video = parseVideoUrl(content.url)
  if (!video) return null

  const caption = content.caption ? (
    <figcaption className="pt-2 text-center text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.caption}</figcaption>
  ) : null

  if (video.aspect === 'landscape') {
    const showFacade = video.poster && !playing
    const iframeSrc = playing ? `${video.embedUrl}?autoplay=1&rel=0&modestbranding=1` : video.embedUrl
    return (
      <figure className="mx-auto w-full max-w-md px-6">
        <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-2xl bg-black shadow-md">
          {showFacade ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Reproducir video"
              className="group absolute inset-0 h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={video.poster ?? ''} alt="" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-105">
                  <Play size={24} className="ml-0.5 text-[#1D1E20]" fill="#1D1E20" />
                </span>
              </span>
            </button>
          ) : (
            <iframe
              src={iframeSrc}
              title={content.caption || 'Video'}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
        {caption}
      </figure>
    )
  }

  const dims = PORTRAIT[video.provider === 'instagram' ? 'instagram' : 'tiktok']
  return (
    <figure className="mx-auto w-full max-w-md px-6">
      <div
        className="relative mx-auto w-full max-w-[325px] overflow-hidden rounded-2xl bg-black shadow-md"
        style={{ height: dims.box }}
      >
        <iframe
          src={video.embedUrl}
          title={content.caption || 'Video'}
          scrolling="no"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-x-0 top-0 w-full border-0"
          style={{ height: dims.frame }}
        />
      </div>
      {caption}
    </figure>
  )
}
