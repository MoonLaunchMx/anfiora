'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Music2, ChevronRight } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'playlist' }>['content']

export default function PlaylistSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const preview = ctx.mode === 'preview'
  if (!preview && !ctx.tokens.playlist) return null

  return (
    <SectionShell variant="band">
      <a
        href={ctx.tokens.playlist ? `/playlist/${ctx.tokens.playlist}` : '#'}
        className="flex items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4 transition hover:border-[var(--inv-acento)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ color: 'var(--inv-acento)', background: 'var(--inv-acento-bg)' }}>
          <Music2 size={17} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium" style={{ color: 'var(--inv-texto)' }}>{content.titulo}</span>
          <span className="block text-xs opacity-70" style={{ color: 'var(--inv-texto)' }}>{content.descripcion}</span>
        </span>
        <ChevronRight size={16} className="text-[#bbb]" />
      </a>
    </SectionShell>
  )
}
