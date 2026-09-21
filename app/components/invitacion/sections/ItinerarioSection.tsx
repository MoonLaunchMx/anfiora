'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Clock, MapPin } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'itinerario' }>['content']

export default function ItinerarioSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  if (ctx.itinerary.length === 0) {
    if (ctx.mode !== 'preview') return null
    return (
      <SectionShell variant="band" className="text-center">
        <p className="rounded-xl border border-dashed border-[#e0e0e0] px-4 py-6 text-xs" style={{ background: 'var(--inv-tarjeta)', color: 'var(--inv-tarjeta-texto)', opacity: 0.6 }}>
          Se mostrará cuando configures el itinerario en Timeline
        </p>
      </SectionShell>
    )
  }

  const varios = ctx.itinerary.length > 1

  return (
    <SectionShell variant="band">
      <h2 className="px-2 text-center text-xl font-semibold lg:text-2xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
        {content.titulo}
      </h2>

      <div className="mx-auto mt-8 flex max-w-md flex-col gap-6">
        {ctx.itinerary.map(day => (
          <div key={day.date}>
            {varios && (
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--inv-acento)' }}>
                  {day.label}
                </span>
                <span className="h-px flex-1 bg-[#e8e8e8]" />
              </div>
            )}
            <ol className="flex flex-col gap-0">
              {day.items.map((item, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ color: 'var(--inv-acento)', background: 'var(--inv-acento-bg)' }}>
                      <Clock size={13} />
                    </span>
                    {i < day.items.length - 1 && <span className="my-1 w-px flex-1 bg-[#e8e8e8]" />}
                  </div>
                  <div className="pb-6">
                    <p className="text-xs font-semibold" style={{ color: 'var(--inv-acento)' }}>{item.start_time}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--inv-texto)' }}>{item.title}</p>
                    {item.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs opacity-70" style={{ color: 'var(--inv-texto)' }}>
                        <MapPin size={12} /> {item.location}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </SectionShell>
  )
}
