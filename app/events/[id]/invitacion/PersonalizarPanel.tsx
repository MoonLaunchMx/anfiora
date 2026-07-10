'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import { setTheme } from '@/lib/invite/doc'
import FontMenu from './FontMenu'
import ButtonStylePicker from './ButtonStylePicker'

function isHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // El color puede ser un gradiente (no editable por <input type=color>); mostramos el picker solo si es hex.
  const hex = isHex(value) ? value : '#ffffff'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[#666]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-32 rounded-lg border border-[#e0e0e0] px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
        />
        <input
          type="color"
          value={hex}
          onChange={e => onChange(e.target.value)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-[#e0e0e0] bg-white"
          aria-label={label}
        />
      </div>
    </div>
  )
}

export default function PersonalizarPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  const t = doc.theme
  const set = (patch: Parameters<typeof setTheme>[1]) => onChange(setTheme(doc, patch))

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-[#1D1E20]">Colores</p>
        <ColorRow label="Fondo" value={t.colores.fondo} onChange={v => set({ colores: { fondo: v } })} />
        <ColorRow label="Texto" value={t.colores.texto} onChange={v => set({ colores: { texto: v } })} />
        <ColorRow label="Acento" value={t.colores.acento} onChange={v => set({ colores: { acento: v } })} />
        <ColorRow label="Botón (fondo)" value={t.colores.botonBg} onChange={v => set({ colores: { botonBg: v } })} />
        <ColorRow label="Botón (texto)" value={t.colores.botonTexto} onChange={v => set({ colores: { botonTexto: v } })} />
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
