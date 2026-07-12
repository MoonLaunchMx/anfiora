'use client'
import { useState } from 'react'
import { Play } from 'lucide-react'
import type { Section } from '@/lib/invite/schema'
import { parseVideoUrl } from '@/lib/invite/video'
import type { InviteCtx } from '../types'

type Content = Extract<Section, { type: 'video' }>['content']

export default function VideoSection({ content }: { content: Content; ctx: InviteCtx }) {
  const [playing, setPlaying] = useState(false)
  const video = parseVideoUrl(content.url)
  if (!video) return null

  const ratioClass = video.aspect === 'portrait' ? 'aspect-[9/16] max-w-[300px]' : 'aspect-video max-w-md'
  const showFacade = video.poster && !playing
  const iframeSrc =
    video.provider === 'youtube' && playing
      ? `${video.embedUrl}?autoplay=1&rel=0&modestbranding=1`
      : video.embedUrl

  return (
    <figure className="mx-auto w-full max-w-md px-6">
      <div className={`relative mx-auto w-full overflow-hidden rounded-2xl bg-black shadow-md ${ratioClass}`}>
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
      {content.caption && (
        <figcaption className="pt-2 text-center text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.caption}</figcaption>
      )}
    </figure>
  )
}
