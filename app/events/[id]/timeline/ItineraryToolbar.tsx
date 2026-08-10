'use client'

import { Plus, Eye, CalendarPlus } from 'lucide-react'
import type { ItineraryController } from './useItinerary'

// Acciones del itinerario en la barra superior (como "Agregar" en Tareas):
// - Preview RSVP: previsualiza el itinerario como lo ve el invitado en la invitacion.
// - Armar el dia: plantilla sobre el dia activo (el que va creciendo con el scroll).
// - Momento: alta manual (se oculta mientras previsualizas).
export function ItineraryToolbar({ itin }: { itin: ItineraryController }) {
  const { canEdit, guestPreview, setGuestPreview, openNew, openTemplate, moments, days } = itin

  if (!canEdit) return null

  return (
    <div className="ml-auto flex items-center gap-2">
      {moments.length > 0 && (
        <button
          onClick={() => setGuestPreview(p => !p)}
          className={['flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition', guestPreview ? 'border-[#d4a853] bg-[#fffbf0] text-[#c49a3a]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f5f5f5]'].join(' ')}
        >
          <Eye width={13} height={13} />
          <span className="hidden sm:inline">{guestPreview ? 'Vista organizador' : 'Preview RSVP'}</span>
        </button>
      )}
      {!guestPreview && moments.length > 0 && days.length > 0 && (
        <button
          onClick={() => openTemplate()}
          className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
        >
          <CalendarPlus width={13} height={13} />
          <span className="hidden sm:inline">Armar el día</span>
        </button>
      )}
      {!guestPreview && (
        <button
          onClick={() => openNew()}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm"
        >
          <Plus width={14} height={14} />Momento
        </button>
      )}
    </div>
  )
}
