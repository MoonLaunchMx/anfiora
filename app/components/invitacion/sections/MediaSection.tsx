'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'

type Content = Extract<Section, { type: 'media' }>['content']

export default function MediaSection({ content }: { content: Content; ctx: InviteCtx }) {
  if (!content.url.trim()) return null
  return (
    <figure className="mx-auto w-full max-w-md px-6 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.url} alt={content.caption || ''} className="block w-full rounded-2xl shadow-md" loading="lazy" />
      {content.caption && (
        <figcaption className="pt-2 text-center text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.caption}</figcaption>
      )}
    </figure>
  )
}
