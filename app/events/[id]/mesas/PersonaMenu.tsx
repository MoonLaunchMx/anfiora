'use client'

import { ArrowRightLeft, User, X } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import type { Persona } from '@/lib/mesas/asientos'
import { ChipTitular, IconoEstatus } from './chips'

// Lo que puedes hacer con una persona al tocarla (celular) o darle clic
// (escritorio, para quien no arrastra).
export default function PersonaMenu({ persona, mesa, sentado, puedeEditar, onMover, onVer, onQuitar, onClose }: {
  persona: Persona | null
  mesa: string
  sentado: boolean
  puedeEditar: boolean
  onMover: () => void
  onVer: () => void
  onQuitar: () => void
  onClose: () => void
}) {
  if (!persona) return null
  const fila = 'flex w-full items-center gap-3 border-b border-[#f5f5f5] px-4 py-3.5 text-left text-[15px] last:border-0 hover:bg-[#f8f8f8]'
  return (
    <Modal open onClose={onClose} size="sm">
      <div className="flex items-start gap-3 border-b border-[#f0f0f0] px-4 py-3">
        <IconoEstatus rsvp={persona.rsvp} size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-bold text-[#1D1E20]">{persona.nombre}</span>
            <ChipTitular persona={persona} />
          </div>
          <p className="text-xs text-[#999]">{mesa}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] hover:bg-[#f5f5f5] hover:text-[#1D1E20]"><X size={15} /></button>
      </div>
      <button type="button" onClick={() => { onClose(); onVer() }} className={fila}><User size={17} className="text-[#888]" />Ver invitado</button>
      {puedeEditar && <button type="button" onClick={() => { onClose(); onMover() }} className={fila}><ArrowRightLeft size={17} className="text-[#48C9B0]" />{sentado ? 'Mover a otra mesa' : 'Sentar en una mesa'}</button>}
      {puedeEditar && sentado && <button type="button" onClick={() => { onClose(); onQuitar() }} className={fila + ' text-[#cc3333]'}><X size={17} />Quitar de la mesa</button>}
    </Modal>
  )
}
