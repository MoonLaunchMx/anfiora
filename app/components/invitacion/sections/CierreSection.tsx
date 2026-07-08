'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { resolveInviteHeading } from '@/lib/invite'

type Content = Extract<Section, { type: 'cierre' }>['content']

export default function CierreSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const firma = resolveInviteHeading(ctx.event)

  return (
    <section className="flex flex-col items-center gap-4 bg-[#FBF7F0] px-6 py-10 text-center">
      <h2 className="px-2 text-2xl font-semibold text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>
      <div className="h-px w-10 bg-[#d4a853]" />
      <p className="px-2 text-sm font-semibold text-[#666]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {firma}
      </p>
      <p className="mt-6 text-[11px] uppercase tracking-wider text-[#bbb]">Hecho con Anfiora</p>
    </section>
  )
}
