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
  const saludo = content.titulo.trim()
    ? `${content.titulo}, ${ctx.guest.name}`
    : ctx.guest.name

  return (
    <SectionShell variant="band" className="text-center">
      <h2 className="px-2 text-2xl font-semibold lg:text-3xl" style={{ color: 'var(--inv-texto)', fontFamily: 'var(--inv-font-titulo)' }}>
        {saludo}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed opacity-70 lg:text-base" style={{ color: 'var(--inv-texto)' }}>{content.mensaje}</p>
      <span
        className="mt-6 inline-block rounded-full border px-4 py-2 text-xs font-medium"
        style={{ background: 'var(--inv-acento-bg)', borderColor: 'var(--inv-acento-borde)', color: 'var(--inv-acento)' }}
      >
        {chip}
      </span>
    </SectionShell>
  )
}
