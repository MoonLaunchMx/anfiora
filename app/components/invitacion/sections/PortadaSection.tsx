'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { resolveInviteHeading, resolveEventKicker } from '@/lib/invite'
import { formatFecha } from '../format'
import { Calendar, MapPin } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'portada' }>['content']

export default function PortadaSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const titulo = content.titulo || resolveInviteHeading(ctx.event)
  const kicker = content.kicker || resolveEventKicker(ctx.event.event_type)
  const fecha = formatFecha(ctx.event.event_date)

  return (
    <SectionShell variant="hero" className="text-center" innerClassName="flex flex-col items-center gap-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: 'var(--inv-acento)' }}>{kicker}</p>
      <h1
        className="w-full break-words px-2 text-4xl font-semibold leading-tight lg:text-5xl"
        style={{ color: 'var(--inv-texto)', fontFamily: 'var(--inv-font-titulo)' }}
      >
        {titulo}
      </h1>
      {content.subtitulo && (
        <p className="max-w-xs text-sm leading-relaxed opacity-70 lg:max-w-md lg:text-base" style={{ color: 'var(--inv-texto)' }}>{content.subtitulo}</p>
      )}
      <div className="mt-2 h-px w-12" style={{ background: 'var(--inv-acento)' }} />
      <div className="flex flex-col items-center gap-2 text-sm opacity-80 lg:text-base" style={{ color: 'var(--inv-texto)' }}>
        {fecha && (
          <span className="flex items-center gap-2">
            <Calendar size={15} style={{ color: 'var(--inv-acento)' }} />
            {fecha}
          </span>
        )}
        {ctx.event.venue && (
          <span className="flex items-center gap-2">
            <MapPin size={15} style={{ color: 'var(--inv-acento)' }} />
            {ctx.event.venue}
          </span>
        )}
      </div>
    </SectionShell>
  )
}
