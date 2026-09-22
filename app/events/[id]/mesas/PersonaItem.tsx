'use client'

import { useDraggable } from '@dnd-kit/core'
import { GripVertical, X } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { estatusDe } from './estatus'
import { ChipTitular, ChipSeparado } from './chips'

// Ids de dnd-kit: 'p:<clave>' para personas, 't:<tableId>' para mesas y
// 'panel' para el panel de sin mesa (soltar ahi = quitar de la mesa).
export const idArrastre = (p: Persona) => 'p:' + p.clave

// Chip del panel "Sin mesa" y del DragOverlay. Se arrastra solo con mouse.
export function PersonaChip({ persona, arrastrable, sombra, onTap }: { persona: Persona; arrastrable: boolean; sombra?: boolean; onTap?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre(persona), data: { persona }, disabled: !arrastrable })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onTap}
      className={'flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-xs text-[#1D1E20] ' + (persona.memberId ? 'ml-3 ' : '') + (sombra ? 'border-[#48C9B0] bg-[#f0fdfb] shadow-xl ' : 'border-[#e0e0e0] ') + (isDragging ? 'opacity-30 ' : '') + (arrastrable ? 'cursor-grab active:cursor-grabbing' : onTap ? 'cursor-pointer' : '')}>
      {arrastrable && <GripVertical size={12} className="shrink-0 text-[#bbb]" />}
      <span className="min-w-0 flex-1 truncate font-medium">{persona.nombre}</span>
    </div>
  )
}

// Tarjeta de una persona sentada: detalle de mesa en el plano y cards del celular.
export function PersonaCard({ persona, etiqueta, puedeEditar, arrastrable, onTap, onQuitar, onCheckin }: {
  persona: Persona; etiqueta: string | null; puedeEditar: boolean; arrastrable: boolean
  onTap?: () => void; onQuitar?: () => void; onCheckin?: () => void
}) {
  const st = estatusDe(persona.rsvp)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre(persona), data: { persona }, disabled: !arrastrable })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={'rounded-xl border px-3 py-2 ' + (isDragging ? 'opacity-30 ' : '') + (arrastrable ? 'cursor-grab active:cursor-grabbing' : '')} style={{ background: st.bg, borderColor: st.border }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onTap} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
          <span className="truncate text-sm font-semibold" style={{ color: st.text }}>{persona.nombre}</span>
          <ChipTitular persona={persona} />
          <ChipSeparado etiqueta={etiqueta} />
        </button>
        <span className="shrink-0 text-[11px] font-semibold" style={{ color: st.text }}>{st.label}</span>
        {onCheckin && (
          puedeEditar
            ? <button type="button" onClick={onCheckin} aria-label="Check-in" className={'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ' + (persona.checkedIn ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#d0d0d0] bg-white hover:border-[#48C9B0]')}>{persona.checkedIn && <Palomita />}</button>
            : <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ' + (persona.checkedIn ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#d0d0d0] bg-white')}>{persona.checkedIn && <Palomita />}</span>
        )}
        {puedeEditar && onQuitar && <button type="button" onClick={onQuitar} aria-label="Quitar de la mesa" className="shrink-0 opacity-40 hover:opacity-100" style={{ color: st.text }}><X size={12} /></button>}
      </div>
    </div>
  )
}

// Lo que se ve pegado al cursor mientras arrastras: un chip sin hooks.
export function ChipFantasma({ persona }: { persona: Persona }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-2 py-1.5 text-xs font-medium text-[#1D1E20] shadow-xl" style={{ transform: 'rotate(-2deg)' }}>
      <GripVertical size={12} className="text-[#48C9B0]" />{persona.nombre}
    </div>
  )
}

export function Palomita() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
