'use client'

import { Plus, Sparkles, Eye } from 'lucide-react'
import type { ItineraryController } from './useItinerary'

// Acciones del itinerario que viven en la barra superior de la pagina,
// consistentes con "Agregar" / "Generar plan" de las vistas de tareas.
export function ItineraryToolbar({ itin }: { itin: ItineraryController }) {
  const { canEdit, eventInfo, moments, guestPreview, setGuestPreview, openNew, setShowGenerate } = itin

  return (
    <div className="ml-auto flex items-center gap-2">
      {canEdit && !guestPreview && eventInfo?.event_date && (
        <button
          onClick={() => setShowGenerate(true)}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#d4a853] hover:text-[#c49a3a]"
        >
          <Sparkles width={13} height={13} />Autogenerar
        </button>
      )}

      {moments.length > 0 && (
        <button
          onClick={() => setGuestPreview(p => !p)}
          className={['flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition', guestPreview ? 'border-[#d4a853] bg-[#fffbf0] text-[#c49a3a]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f5f5f5]'].join(' ')}
        >
          <Eye width={13} height={13} /><span className="hidden sm:inline">{guestPreview ? 'Vista organizador' : 'Ver como invitado'}</span>
        </button>
      )}

      {canEdit && !guestPreview && (
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm"
        >
          <Plus width={14} height={14} />Momento
        </button>
      )}
    </div>
  )
}
