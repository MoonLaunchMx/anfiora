'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { formatFecha, formatHora } from '../format'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'detalles' }>['content']

export default function DetallesSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const fecha = formatFecha(ctx.event.event_date)
  const { venue, address, event_time } = ctx.event
  const mapsUrl = content.mostrar_mapa && address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  if (!fecha && !event_time && !venue && !address) return null

  return (
    <SectionShell variant="band">
      <h2 className="px-2 text-center text-xl font-semibold lg:text-2xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
        {content.titulo}
      </h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(fecha || event_time) && (
          <div className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">
              <Calendar size={13} style={{ color: 'var(--inv-acento)' }} /> Cuándo
            </p>
            {fecha && <p className="mt-1.5 text-sm capitalize" style={{ color: 'var(--inv-texto)' }}>{fecha}</p>}
            {event_time && (
              <p className="mt-1 flex items-center gap-1.5 text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>
                <Clock size={13} /> {formatHora(event_time)}
              </p>
            )}
          </div>
        )}

        {(venue || address) && (
          <div className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">
              <MapPin size={13} style={{ color: 'var(--inv-acento)' }} /> Dónde
            </p>
            {venue && <p className="mt-1.5 text-sm" style={{ color: 'var(--inv-texto)' }}>{venue}</p>}
            {address && <p className="mt-1 text-sm opacity-70" style={{ color: 'var(--inv-texto)' }}>{address}</p>}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-medium underline underline-offset-2"
                style={{ color: 'var(--inv-acento)' }}
              >
                Ver en el mapa
              </a>
            )}
          </div>
        )}
      </div>
    </SectionShell>
  )
}
