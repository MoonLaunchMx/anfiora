'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'media' }>['content']

export default function MediaSection({ content }: { content: Content; ctx: InviteCtx }) {
  if (!content.url.trim()) return null
  return (
    <SectionShell variant="band">
      <figure className="mx-auto max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content.url} alt={content.caption || ''} className="w-full rounded-2xl shadow-md" loading="lazy" />
        {content.caption && (
          <figcaption className="mt-2 text-center text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.caption}</figcaption>
        )}
      </figure>
    </SectionShell>
  )
}
