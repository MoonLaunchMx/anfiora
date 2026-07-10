'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { InviteDoc } from '@/lib/invite/schema'
import { applyVibe } from '@/lib/invite/doc'
import VibePicker from './VibePicker'
import PersonalizarPanel from './PersonalizarPanel'

export default function EstiloPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  const [personalizarOpen, setPersonalizarOpen] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <VibePicker activeVibeId={doc.theme.vibeId} onSelect={id => onChange(applyVibe(doc, id))} />

      <div className="border-t border-[#eee] pt-4">
        <button
          type="button"
          onClick={() => setPersonalizarOpen(o => !o)}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-[#1D1E20]">Personalizar</span>
            <span className="block text-xs text-[#999]">Ajusta colores, fuentes y botón sobre el vibe</span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-[#999] transition-transform ${personalizarOpen ? 'rotate-180' : ''}`} />
        </button>
        {personalizarOpen && (
          <div className="mt-4">
            <PersonalizarPanel doc={doc} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  )
}
