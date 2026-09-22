'use client'

import { useDraggable } from '@dnd-kit/core'
import { GripVertical, X } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { estatusDe } from './estatus'
import { ChipTitular, ChipSeparado } from './chips'
import { Palomita, idArrastre } from './PersonaItem'

// Renglon de una persona en la vista lista de escritorio. Va en el grid de la
// mesa (mismas columnas) y se puede jalar a otra mesa o al panel.
export default function FilaPersona({ persona, etiqueta, bg, cols, puedeEditar, tags, notas, onVer, onQuitar, onCheckin }: {
  persona: Persona; etiqueta: string | null; bg: string; cols: string; puedeEditar: boolean
  tags: React.ReactNode; notas: string | null
  onVer: () => void; onQuitar: () => void; onCheckin: () => void
}) {
  const st = estatusDe(persona.rsvp)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre(persona), data: { persona }, disabled: !puedeEditar })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`grid items-center border-b border-[#f5f5f5] px-4 py-2 ${bg} ${isDragging ? 'opacity-30' : ''} ${puedeEditar ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ gridTemplateColumns: cols }}>
      <div className="flex items-center text-[#ccc]">{puedeEditar && <GripVertical size={12} />}</div>
      <div />
      <div className="flex justify-center"><div className="h-5 w-[2px] rounded-full" style={{ background: st.border }} /></div>
      <div className={'flex flex-wrap items-center gap-1.5 ' + (persona.memberId ? 'pl-3' : '')}>
        <button onClick={onVer} className={'text-left hover:text-[#48C9B0] hover:underline ' + (persona.memberId ? 'text-[11px] text-[#666]' : 'text-xs font-semibold text-[#1D1E20]')}>{persona.nombre}</button>
        <ChipTitular persona={persona} />
        <ChipSeparado etiqueta={etiqueta} />
      </div>
      <div><span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ background: st.bg, borderColor: st.border, color: st.text }}>{st.label.slice(0, 4)}.</span></div>
      <div className="flex flex-wrap gap-1">{tags}</div>
      <div className="truncate text-[11px] text-[#aaa]">{notas || <span className="text-[#ddd]">—</span>}</div>
      <div />
      <div className="flex justify-center">
        {puedeEditar
          ? <button onClick={onCheckin} onMouseDown={e => e.stopPropagation()} className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${persona.checkedIn ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#d0d0d0] bg-white hover:border-[#48C9B0]'}`}>{persona.checkedIn && <Palomita />}</button>
          : <span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${persona.checkedIn ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#d0d0d0] bg-white'}`}>{persona.checkedIn && <Palomita />}</span>}
      </div>
      <div className="flex justify-end">{puedeEditar && <button onClick={onQuitar} onMouseDown={e => e.stopPropagation()} className="flex h-6 w-6 items-center justify-center rounded text-[#ccc] hover:text-[#cc3333]"><X width={11} height={11} /></button>}</div>
    </div>
  )
}
