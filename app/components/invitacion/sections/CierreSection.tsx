'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { resolveInviteHeading } from '@/lib/invite'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'cierre' }>['content']

export default function CierreSection({ content, ctx, portadaTitulo }: { content: Content; ctx: InviteCtx; portadaTitulo?: string }) {
  const firma = portadaTitulo?.trim() || resolveInviteHeading(ctx.event)

  return (
    <SectionShell variant="hero" className="text-center" innerClassName="flex flex-col items-center gap-4">
      <h2 className="px-2 text-2xl font-semibold lg:text-3xl" style={{ color: 'var(--inv-texto)', fontFamily: 'var(--inv-font-titulo)' }}>
        {content.titulo}
      </h2>
      <div className="h-px w-10" style={{ background: 'var(--inv-acento)' }} />
      <p className="px-2 text-sm font-semibold opacity-70 lg:text-base" style={{ color: 'var(--inv-texto)', fontFamily: 'var(--inv-font-titulo)' }}>
        {firma}
      </p>
      <a
        href="/?utm_source=invitacion"
        target="_blank"
        rel="noreferrer"
        className="mt-6 text-[11px] uppercase tracking-wider text-[#bbb] opacity-60 transition hover:opacity-100"
      >
        Hecho con Anfiora
      </a>
    </SectionShell>
  )
}
