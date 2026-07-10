'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import { setTheme } from '@/lib/invite/doc'
import { FONTS } from '@/lib/invite/fonts'
import { BUTTON_FORMAS, BUTTON_ESTILOS } from '@/lib/invite/theme'

const FONT_IDS = Object.keys(FONTS)
const FORMA_LABEL: Record<string, string> = { pill: 'Pastilla', redondo: 'Redondo', recto: 'Recto' }
const ESTILO_LABEL: Record<string, string> = {
  relleno: 'Relleno', contorno: 'Contorno', degradado: 'Degradado', elevado: 'Elevado', retro3d: 'Retro 3D', neon: 'Neón', cromo: 'Cromo',
}

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
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Personalizar</p>

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
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Títulos</span>
          <select
            value={t.fonts.titulo}
            onChange={e => set({ fonts: { titulo: e.target.value } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {FONT_IDS.map(id => <option key={id} value={id}>{FONTS[id].family}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Cuerpo</span>
          <select
            value={t.fonts.cuerpo}
            onChange={e => set({ fonts: { cuerpo: e.target.value } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {FONT_IDS.map(id => <option key={id} value={id}>{FONTS[id].family}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-[#1D1E20]">Botón</p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Forma</span>
          <select
            value={t.boton.forma}
            onChange={e => set({ boton: { forma: e.target.value as typeof t.boton.forma } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {BUTTON_FORMAS.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Estilo</span>
          <select
            value={t.boton.estilo}
            onChange={e => set({ boton: { estilo: e.target.value as typeof t.boton.estilo } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {BUTTON_ESTILOS.map(s => <option key={s} value={s}>{ESTILO_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
