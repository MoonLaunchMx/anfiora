'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { resolveInviteHeading, resolveEventKicker } from '@/lib/invite'
import { formatFecha } from '../format'
import { Calendar, MapPin } from 'lucide-react'

type Content = Extract<Section, { type: 'portada' }>['content']

export default function PortadaSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const titulo = content.titulo || resolveInviteHeading(ctx.event)
  const kicker = content.kicker || resolveEventKicker(ctx.event.event_type)
  const fecha = formatFecha(ctx.event.event_date)

  return (
    <section className="flex flex-col items-center justify-center gap-5 bg-[#FBF7F0] px-6 py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4a853]">{kicker}</p>
      <h1
        className="w-full break-words px-2 text-4xl font-semibold leading-tight text-[#1D1E20]"
        style={{ fontFamily: "'Josefin Sans', sans-serif" }}
      >
        {titulo}
      </h1>
      {content.subtitulo && (
        <p className="max-w-xs text-sm leading-relaxed text-[#666]">{content.subtitulo}</p>
      )}
      <div className="mt-2 h-px w-12 bg-[#d4a853]" />
      <div className="flex flex-col items-center gap-2 text-sm text-[#666]">
        {fecha && (
          <span className="flex items-center gap-2">
            <Calendar size={15} className="text-[#d4a853]" />
            {fecha}
          </span>
        )}
        {ctx.event.venue && (
          <span className="flex items-center gap-2">
            <MapPin size={15} className="text-[#d4a853]" />
            {ctx.event.venue}
          </span>
        )}
      </div>
    </section>
  )
}
