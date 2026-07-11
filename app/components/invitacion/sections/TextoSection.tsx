'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'texto' }>['content']

export default function TextoSection({ content }: { content: Content; ctx: InviteCtx }) {
  if (!content.eyebrow.trim() && !content.titulo.trim() && !content.cuerpo.trim()) return null

  return (
    <SectionShell variant="band" className="text-center">
      {content.eyebrow.trim() && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--inv-acento)' }}>{content.eyebrow}</p>
      )}
      {content.titulo.trim() && (
        <h2
          className="mt-2 px-2 text-xl font-semibold lg:text-2xl"
          style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}
        >
          {content.titulo}
        </h2>
      )}
      {content.cuerpo.trim() && (
        <p className="mx-auto mt-4 max-w-md whitespace-pre-line text-sm leading-relaxed opacity-70 sm:text-base" style={{ color: 'var(--inv-texto)' }}>
          {content.cuerpo}
        </p>
      )}
    </SectionShell>
  )
}
