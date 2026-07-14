'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import type { LucideIcon } from 'lucide-react'
import { Calendar, Clock, MapPin, Navigation } from 'lucide-react'
import { formatFecha, formatHora } from '../format'
import { buildMapsUrl } from '@/lib/invite/maps'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'detalles' }>['content']

type Row = { icon: LucideIcon; label: string; value: string; cap?: boolean }

export default function DetallesSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const fecha = formatFecha(ctx.event.event_date)
  const { venue, address, event_time } = ctx.event
  const hora = formatHora(event_time)
  const mapsUrl = content.mostrar_mapa ? buildMapsUrl(content.maps_url, address) : null

  const rows: Row[] = []
  if (fecha) rows.push({ icon: Calendar, label: 'Fecha', value: fecha, cap: true })
  if (hora) rows.push({ icon: Clock, label: 'Hora', value: hora })
  if (venue) rows.push({ icon: MapPin, label: 'Lugar', value: venue })
  if (address) rows.push({ icon: Navigation, label: 'Dirección', value: address })

  if (rows.length === 0 && !mapsUrl) return null

  return (
    <SectionShell variant="band" className="text-center">
      <h2 className="px-2 text-xl font-semibold lg:text-2xl" style={{ color: 'var(--inv-texto-titulo)', fontFamily: 'var(--inv-font-titulo)' }}>
        {content.titulo}
      </h2>

      <div className="mx-auto mt-8 flex max-w-md flex-col gap-2.5 text-left">
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-[#e8e8e8] px-4 py-3"
              style={{ background: 'var(--inv-tarjeta)' }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ color: 'var(--inv-acento)', background: 'var(--inv-acento-bg)' }}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--inv-tarjeta-texto)', opacity: 0.55 }}>{row.label}</p>
                <p className={`text-sm font-medium ${row.cap ? 'capitalize' : ''}`} style={{ color: 'var(--inv-tarjeta-texto)' }}>{row.value}</p>
              </div>
            </div>
          )
        })}

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:opacity-90"
            style={{ color: 'var(--inv-acento)', borderColor: 'var(--inv-acento-borde)', background: 'var(--inv-acento-bg)' }}
          >
            <MapPin size={15} /> Ver en Google Maps
          </a>
        )}
      </div>
    </SectionShell>
  )
}
