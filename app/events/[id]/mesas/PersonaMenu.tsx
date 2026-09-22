'use client'

import { ArrowRightLeft, User, X } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import type { Persona } from '@/lib/mesas/asientos'
import { ChipTitular } from './chips'

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
  const fila = 'flex w-full items-center gap-3 border-b border-[#f5f5f5] px-4 py-3.5 text-left text-sm last:border-0 hover:bg-[#f8f8f8]'
  return (
    <Modal open onClose={onClose} size="sm">
      <div className="border-b border-[#f0f0f0] px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-[#1D1E20]">{persona.nombre}</span>
          <ChipTitular persona={persona} />
        </div>
        <p className="text-[11px] text-[#999]">{mesa}</p>
      </div>
      {puedeEditar && <button type="button" onClick={() => { onClose(); onMover() }} className={fila}><ArrowRightLeft size={15} className="text-[#48C9B0]" />{sentado ? 'Mover a otra mesa' : 'Sentar en una mesa'}</button>}
      <button type="button" onClick={() => { onClose(); onVer() }} className={fila}><User size={15} className="text-[#888]" />Ver invitado</button>
      {puedeEditar && sentado && <button type="button" onClick={() => { onClose(); onQuitar() }} className={fila + ' text-[#cc3333]'}><X size={15} />Quitar de la mesa</button>}
    </Modal>
  )
}
