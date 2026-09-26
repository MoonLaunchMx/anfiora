'use client'

import { GripVertical } from 'lucide-react'
import type { Persona } from '@/lib/mesas/asientos'
import { estatusDe } from './estatus'
import { ChipTitular, ChipSeparado, IconoEstatus } from './chips'

// Tarjeta de una persona sentada: el detalle de mesa del plano.
export function PersonaCard({ persona, etiqueta, onTap }: { persona: Persona; etiqueta: string | null; onTap?: () => void }) {
  const st = estatusDe(persona.rsvp)
  return (
    <button type="button" onClick={onTap} className={'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left ' + (persona.memberId ? 'ml-4 w-[calc(100%-1rem)]' : '')} style={{ background: st.bg, borderColor: st.border }}>
      <IconoEstatus rsvp={persona.rsvp} size={16} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: st.text }}>{persona.nombre}</span>
      <ChipTitular persona={persona} />
      <ChipSeparado etiqueta={etiqueta} />
    </button>
  )
}

// Lo que se ve pegado al cursor mientras arrastras: la familia o la persona.
export function ChipFantasma({ personas }: { personas: Persona[] }) {
  const p = personas[0]
  if (!p) return null
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-2.5 py-1.5 text-xs font-medium text-[#1D1E20] shadow-xl" style={{ transform: 'rotate(-2deg)' }}>
      <GripVertical size={12} className="text-[#48C9B0]" />
      <IconoEstatus rsvp={p.rsvp} size={14} />
      {p.nombre}
      {personas.length > 1 && <span className="font-semibold text-[#1f8a75]">+{personas.length - 1}</span>}
    </div>
  )
}

export function Palomita() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
