'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'saludo' }>['content']

export default function SaludoSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const n = ctx.companions.length
  const chip = n > 0
    ? `Reservamos lugar para ti + ${n} acompañante${n === 1 ? '' : 's'}`
    : 'Reservamos lugar para ti'

  return (
    <SectionShell variant="band" className="text-center">
      <h2 className="px-2 text-2xl font-semibold text-[#1D1E20] sm:text-3xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}, {ctx.guest.name}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#666] sm:text-base">{content.mensaje}</p>
      <span className="mt-6 inline-block rounded-full border border-[#f0e2bf] bg-[#fffbf0] px-4 py-2 text-xs font-medium text-[#8a6d2f]">
        {chip}
      </span>
    </SectionShell>
  )
}
