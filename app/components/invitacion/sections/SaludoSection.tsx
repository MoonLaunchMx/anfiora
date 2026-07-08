'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'

type Content = Extract<Section, { type: 'saludo' }>['content']

export default function SaludoSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const n = ctx.companions.length
  const chip = n > 0
    ? `Reservamos lugar para ti + ${n} acompañante${n === 1 ? '' : 's'}`
    : 'Reservamos lugar para ti'

  return (
    <section className="px-6 py-14 text-center">
      <h2 className="text-2xl text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}, {ctx.guest.name}
      </h2>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#666]">{content.mensaje}</p>
      <span className="mt-6 inline-block rounded-full border border-[#f0e2bf] bg-[#fffbf0] px-4 py-2 text-xs font-medium text-[#8a6d2f]">
        {chip}
      </span>
    </section>
  )
}
