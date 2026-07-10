'use client'
import { RotateCcw } from 'lucide-react'
import type { InviteDoc } from '@/lib/invite/schema'
import { setTheme, applyVibe } from '@/lib/invite/doc'
import FontMenu from './FontMenu'
import ButtonStylePicker from './ButtonStylePicker'
import ColorControls from './ColorControls'

export default function PersonalizarPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  const t = doc.theme
  const set = (patch: Parameters<typeof setTheme>[1]) => onChange(setTheme(doc, patch))

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <button
        type="button"
        onClick={() => onChange(applyVibe(doc, t.vibeId))}
        className="flex items-center gap-1.5 self-start rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
      >
        <RotateCcw size={13} /> Resetear a plantilla
      </button>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-[#1D1E20]">Colores</p>
        <ColorControls colores={t.colores} onColores={patch => set({ colores: patch })} />
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-[#1D1E20]">Tipografía</p>
        <FontMenu label="Títulos" value={t.fonts.titulo} onChange={v => set({ fonts: { titulo: v } })} />
        <FontMenu label="Cuerpo" value={t.fonts.cuerpo} onChange={v => set({ fonts: { cuerpo: v } })} />
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-[#1D1E20]">Botón</p>
        <ButtonStylePicker
          theme={t}
          onForma={f => set({ boton: { forma: f } })}
          onEstilo={e => set({ boton: { estilo: e } })}
        />
      </div>
    </div>
  )
}
