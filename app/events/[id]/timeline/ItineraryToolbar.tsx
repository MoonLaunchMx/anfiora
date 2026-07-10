'use client'

import { Plus } from 'lucide-react'
import type { ItineraryController } from './useItinerary'

// Accion principal del itinerario en la barra superior (como "Agregar" en Tareas).
// Autogenerar vive en el estado vacio (es accion de arranque, no de edicion);
// "Ver como invitado" vive en la barra de compartir (es contextual).
export function ItineraryToolbar({ itin }: { itin: ItineraryController }) {
  const { canEdit, guestPreview, openNew } = itin

  if (!canEdit || guestPreview) return null

  return (
    <div className="ml-auto flex items-center gap-2">
      <button
        onClick={openNew}
        className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm"
      >
        <Plus width={14} height={14} />Momento
      </button>
    </div>
  )
}
