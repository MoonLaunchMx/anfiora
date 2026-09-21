'use client'

import { useState } from 'react'
import { Plus, Eye, CalendarPlus } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { Puede } from '@/lib/permisos/Puede'
import type { ItineraryController } from './useItinerary'

// Acciones del itinerario en la barra superior (como "Agregar" en Tareas):
// - Preview RSVP: previsualiza el itinerario como lo ve el invitado en la invitacion.
// - Armar el dia: plantilla sobre el dia activo (el que va creciendo con el scroll).
// - Momento: alta manual (se oculta mientras previsualizas).
// Esta barra es solo desktop; en movil vive ItineraryAddButton junto al TabToggle.
export function ItineraryToolbar({ itin }: { itin: ItineraryController }) {
  const { guestPreview, setGuestPreview, openNew, openTemplate, moments, days } = itin

  return (
    <div className="ml-auto flex items-center gap-2">
      {moments.length > 0 && (
        <button
          onClick={() => setGuestPreview(p => !p)}
          className={['flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition', guestPreview ? 'border-[#d4a853] bg-[#fffbf0] text-[#c49a3a]' : 'border-[#e0e0e0] text-[#888] hover:bg-[#f5f5f5]'].join(' ')}
        >
          <Eye width={13} height={13} />
          {guestPreview ? 'Vista organizador' : 'Preview RSVP'}
        </button>
      )}
      {!guestPreview && moments.length > 0 && days.length > 0 && (
        <Puede modulo="timeline" accion="editar">
          <button
            onClick={() => openTemplate()}
            className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
          >
            <CalendarPlus width={13} height={13} />
            Armar el día
          </button>
        </Puede>
      )}
      {!guestPreview && (
        <Puede modulo="timeline" accion="editar">
          <button
            onClick={() => openNew()}
            className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] sm:px-4 sm:text-sm"
          >
            <Plus width={14} height={14} />Momento
          </button>
        </Puede>
      )}
    </div>
  )
}

// Boton unico de movil: vive en la misma linea que el TabToggle.
// Con plantillas disponibles abre la hoja de dos opciones; si no, va directo al momento.
export function ItineraryAddButton({ itin }: { itin: ItineraryController }) {
  const { guestPreview, setGuestPreview, openNew, openTemplate, moments, days } = itin
  const [sheetOpen, setSheetOpen] = useState(false)

  // El preview solo se activa en desktop; si la ventana encoge con el preview
  // puesto, este boton es la unica salida.
  if (guestPreview) {
    return (
      <button
        onClick={() => setGuestPreview(false)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d4a853] bg-[#fffbf0] px-3 py-1.5 text-xs font-medium text-[#c49a3a]"
      >
        <Eye width={13} height={13} />
        Vista organizador
      </button>
    )
  }

  const canTemplate = moments.length > 0 && days.length > 0

  return (
    <Puede modulo="timeline" accion="editar">
      <>
        <button
          onClick={() => (canTemplate ? setSheetOpen(true) : openNew())}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          <Plus width={14} height={14} />Agregar
        </button>

        <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} size="sm">
          <Modal.Header title="Agregar al itinerario" />
          <Modal.Body className="!px-3 !py-2">
            <button
              onClick={() => { setSheetOpen(false); openNew() }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition hover:bg-[#f8f8f8]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eafaf6] text-[#1a9e88]">
                <Plus size={17} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#1D1E20]">Momento</span>
                <span className="block text-xs text-[#999]">Un momento suelto, en el día que elijas</span>
              </span>
            </button>
            <div className="mx-2.5 border-t border-[#f0f0f0]" />
            <button
              onClick={() => { setSheetOpen(false); openTemplate() }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition hover:bg-[#f8f8f8]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eafaf6] text-[#1a9e88]">
                <CalendarPlus size={17} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#1D1E20]">Armar el día</span>
                <span className="block text-xs text-[#999]">Llena un día completo con una plantilla</span>
              </span>
            </button>
          </Modal.Body>
        </Modal>
      </>
    </Puede>
  )
}
