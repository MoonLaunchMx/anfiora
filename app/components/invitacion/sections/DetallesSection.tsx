'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { formatFecha } from '../format'

type Content = Extract<Section, { type: 'detalles' }>['content']

export default function DetallesSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const fecha = formatFecha(ctx.event.event_date)
  const { venue, address, event_time } = ctx.event
  const mapsUrl = content.mostrar_mapa && address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  if (!fecha && !event_time && !venue && !address) return null

  return (
    <section className="px-6 py-8">
      <h2 className="px-2 text-center text-xl font-semibold text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-4">
        {(fecha || event_time) && (
          <div className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">
              <Calendar size={13} className="text-[#d4a853]" /> Cuándo
            </p>
            {fecha && <p className="mt-1.5 text-sm capitalize text-[#1D1E20]">{fecha}</p>}
            {event_time && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#666]">
                <Clock size={13} /> {event_time}
              </p>
            )}
          </div>
        )}

        {(venue || address) && (
          <div className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">
              <MapPin size={13} className="text-[#d4a853]" /> Dónde
            </p>
            {venue && <p className="mt-1.5 text-sm text-[#1D1E20]">{venue}</p>}
            {address && <p className="mt-1 text-sm text-[#666]">{address}</p>}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-medium text-[#48C9B0] underline underline-offset-2"
              >
                Ver en el mapa
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
