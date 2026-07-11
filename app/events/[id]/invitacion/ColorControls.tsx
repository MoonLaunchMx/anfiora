'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import HsvColorPicker from './HsvColorPicker'

type Colores = {
  fondo: string
  texto: string
  acento: string
  botonBg: string
  botonTexto: string
}

type ColorToken = keyof Colores

const QUICK_SWATCHES = ['#ffffff', '#1D1E20', '#48C9B0', '#F4C430', '#d4a853', '#e11d1d', '#c76b86', '#6b8455', '#8b5cf6', '#0d5a6e']

const TOKENS: { key: ColorToken; label: string }[] = [
  { key: 'fondo', label: 'Fondo' },
  { key: 'texto', label: 'Texto' },
  { key: 'acento', label: 'Acento' },
  { key: 'botonBg', label: 'Botón' },
  { key: 'botonTexto', label: 'Texto botón' },
]

export default function ColorControls({
  colores,
  onColores,
}: {
  colores: Colores
  onColores: (patch: Partial<Colores>) => void
}) {
  const [open, setOpen] = useState<ColorToken | null>(null)
  const apply = (token: ColorToken, v: string) => onColores({ [token]: v } as Partial<Colores>)
  const openLabel = TOKENS.find(t => t.key === open)?.label

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        {TOKENS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(open === key ? null : key)}
              className={`h-10 w-10 rounded-full shadow-sm outline-none transition-transform hover:scale-105 ${open === key ? 'border-2 border-[#48C9B0]' : 'border border-[#e0e0e0]'}`}
              style={{ background: colores[key] }}
              aria-label={label}
            />
            <span className="text-[10px] text-[#666]">{label}</span>
          </div>
        ))}
      </div>

      {open && (
        <div className="rounded-2xl border border-[#e8e8e8] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1D1E20]">{openLabel}</span>
            <button type="button" onClick={() => setOpen(null)} className="text-[#bbb] transition hover:text-[#666]" aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>
          <HsvColorPicker value={colores[open]} onChange={v => apply(open, v)} />
          <input
            type="text"
            value={colores[open]}
            onChange={e => apply(open, e.target.value)}
            className="mt-2 w-full rounded-lg border border-[#e0e0e0] px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
            placeholder="#hex o gradient(...)"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_SWATCHES.map(sw => (
              <button
                key={sw}
                type="button"
                onClick={() => apply(open, sw)}
                className="h-6 w-6 rounded-full border border-[#e0e0e0]"
                style={{ background: sw }}
                aria-label={sw}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
