'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { resolveInviteHeading } from '@/lib/invite'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'cierre' }>['content']

export default function CierreSection({ content, ctx, portadaTitulo }: { content: Content; ctx: InviteCtx; portadaTitulo?: string }) {
  const firma = portadaTitulo?.trim() || resolveInviteHeading(ctx.event)

  return (
    <SectionShell variant="hero" className="bg-[#FBF7F0] text-center" innerClassName="flex flex-col items-center gap-4">
      <h2 className="px-2 text-2xl font-semibold text-[#1D1E20] lg:text-3xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>
      <div className="h-px w-10 bg-[#d4a853]" />
      <p className="px-2 text-sm font-semibold text-[#666] lg:text-base" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {firma}
      </p>
      <a
        href="/?utm_source=invitacion"
        target="_blank"
        rel="noreferrer"
        className="mt-6 text-[11px] uppercase tracking-wider text-[#bbb] transition hover:text-[#d4a853]"
      >
        Hecho con Anfiora
      </a>
    </SectionShell>
  )
}
