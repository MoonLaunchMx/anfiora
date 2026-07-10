'use client'

import { ItineraryMoment } from '@/lib/types'
import { PHASE_LABEL, PHASE_COLOR, formatMomentRange, formatDuration } from '@/lib/itinerary'
import { MapPin, Building2, User, Eye, EyeOff } from 'lucide-react'

interface MomentCardProps {
  moment: ItineraryMoment
  canEdit: boolean
  guestPreview: boolean
  onEdit: (m: ItineraryMoment) => void
  onToggleVisible: (m: ItineraryMoment) => void
}

export function MomentCard({ moment, canEdit, guestPreview, onEdit, onToggleVisible }: MomentCardProps) {
  const phase = PHASE_COLOR[moment.phase]
  const supplierName = moment.event_supplier?.supplier?.name || null
  const hidden = !moment.visible_to_guests

  return (
    <div className="flex items-stretch gap-3">
      {/* Columna izquierda: hora + duracion */}
      <div className="w-16 flex-shrink-0 pt-1 text-right">
        <p className="text-sm font-semibold text-[#1D1E20] tabular-nums leading-tight">
          {formatMomentRange(moment.start_time, moment.duration_min)}
        </p>
        <span className="mt-1 inline-block rounded-full bg-[#f8f8f8] px-2 py-0.5 text-[10px] font-medium text-[#999]">
          {formatDuration(moment.duration_min)}
        </span>
      </div>

      {/* Nodo + hilo dorado */}
      <div className="flex w-4 flex-shrink-0 flex-col items-center">
        <div className="mt-2 h-2.5 w-2.5 rounded-full border-2 border-[#c99a3f] bg-white" />
        <div className="w-px flex-1 bg-[#ecdcb8]" />
      </div>

      {/* Tarjeta */}
      <div
        onClick={() => { if (canEdit && !guestPreview) onEdit(moment) }}
        className={[
          'mb-3 flex-1 rounded-xl border p-3 transition-all',
          canEdit && !guestPreview ? 'cursor-pointer hover:border-[#d4a853]' : '',
          hidden && !guestPreview ? 'border-dashed border-[#e0e0e0] bg-[#fbfbfb] opacity-70' : 'border-[#e8e8e8] bg-white',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[#1D1E20]">{moment.title}</p>
          {!guestPreview && (
            <button
              onClick={e => { e.stopPropagation(); if (canEdit) onToggleVisible(moment) }}
              disabled={!canEdit}
              className={[
                'flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition',
                moment.visible_to_guests
                  ? 'border-[#c8ede7] bg-[#f0fdfb] text-[#0F6E56]'
                  : 'border-[#e0e0e0] bg-white text-[#999]',
                canEdit ? 'hover:opacity-80' : 'cursor-default',
              ].join(' ')}
            >
              {moment.visible_to_guests ? <Eye size={11} /> : <EyeOff size={11} />}
              <span className="hidden sm:inline">{moment.visible_to_guests ? 'Visible' : 'Solo interno'}</span>
            </button>
          )}
        </div>

        {(supplierName || moment.assigned_to_name || moment.location) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {moment.location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fffbf0] px-2 py-0.5 text-[11px] text-[#c49a3a]">
                <MapPin size={10} />{moment.location}
              </span>
            )}
            {supplierName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f0fdfb] px-2 py-0.5 text-[11px] text-[#0F6E56]">
                <Building2 size={10} />{supplierName}
              </span>
            )}
            {moment.assigned_to_name && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f0fdfb] px-2 py-0.5 text-[11px] text-[#0F6E56]">
                <User size={10} />{moment.assigned_to_name}
              </span>
            )}
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ color: phase.text, background: phase.bg, border: `1px solid ${phase.border}` }}
            >
              {PHASE_LABEL[moment.phase]}
            </span>
          </div>
        )}

        {!guestPreview && moment.notes && (
          <p className="mt-2 hidden sm:block text-xs text-[#888] whitespace-pre-line">{moment.notes}</p>
        )}
      </div>
    </div>
  )
}
