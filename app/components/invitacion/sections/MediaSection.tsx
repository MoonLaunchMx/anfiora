'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'

type Content = Extract<Section, { type: 'media' }>['content']

export default function MediaSection({ content }: { content: Content; ctx: InviteCtx }) {
  if (!content.url.trim()) return null
  return (
    <figure className="w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.url} alt={content.caption || ''} className="block max-h-[90vh] w-full object-cover" loading="lazy" />
      {content.caption && (
        <figcaption className="px-6 pt-2 text-center text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.caption}</figcaption>
      )}
    </figure>
  )
}
