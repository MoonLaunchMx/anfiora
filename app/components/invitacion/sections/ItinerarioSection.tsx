'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Clock, MapPin } from 'lucide-react'

type Content = Extract<Section, { type: 'itinerario' }>['content']

export default function ItinerarioSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  if (ctx.itinerary.length === 0) {
    if (ctx.mode !== 'preview') return null
    return (
      <section className="px-6 py-7 text-center">
        <p className="rounded-xl border border-dashed border-[#e0e0e0] bg-white px-4 py-6 text-xs text-[#bbb]">
          Se mostrará cuando configures el itinerario en Timeline
        </p>
      </section>
    )
  }

  return (
    <section className="px-6 py-8">
      <h2 className="px-2 text-center text-xl font-semibold text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      <ol className="mx-auto mt-8 flex max-w-sm flex-col gap-0">
        {ctx.itinerary.map((item, i) => (
          <li key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fffbf0] text-[#d4a853]">
                <Clock size={13} />
              </span>
              {i < ctx.itinerary.length - 1 && <span className="my-1 w-px flex-1 bg-[#e8e8e8]" />}
            </div>
            <div className="pb-6">
              <p className="text-xs font-semibold text-[#d4a853]">{item.start_time}</p>
              <p className="text-sm font-medium text-[#1D1E20]">{item.title}</p>
              {item.location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[#666]">
                  <MapPin size={12} /> {item.location}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
