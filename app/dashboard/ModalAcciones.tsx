'use client'

import { ChevronRight } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { atajos } from './atajos'

export default function ModalAcciones({ open, onClose, eventId, puedeVerDinero }: {
  open: boolean
  onClose: () => void
  eventId: string
  puedeVerDinero: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <Modal.Header title="Acciones rápidas" subtitle="Lo que sueles hacer en este evento" />
      <Modal.Body className="!px-3">
        {atajos(eventId, puedeVerDinero).map(a => (
          <button
            key={a.label}
            onClick={() => { window.location.href = a.href }}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-[#F8F8F8]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F0FDFB]">
              <a.Icono size={16} className="text-[#1A9E88]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-[#1D1E20]">{a.label}</span>
              <span className="block truncate text-[12.5px] text-[#999]">{a.detalle}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-[#CCC]" />
          </button>
        ))}
      </Modal.Body>
    </Modal>
  )
}
