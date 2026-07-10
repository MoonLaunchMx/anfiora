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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4a853]">{content.eyebrow}</p>
      )}
      {content.titulo.trim() && (
        <h2
          className="mt-2 px-2 text-xl font-semibold text-[#1D1E20] lg:text-2xl"
          style={{ fontFamily: "'Josefin Sans', sans-serif" }}
        >
          {content.titulo}
        </h2>
      )}
      {content.cuerpo.trim() && (
        <p className="mx-auto mt-4 max-w-md whitespace-pre-line text-sm leading-relaxed text-[#666] sm:text-base">
          {content.cuerpo}
        </p>
      )}
    </SectionShell>
  )
}
