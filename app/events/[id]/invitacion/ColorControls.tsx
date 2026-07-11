'use client'
import { useState } from 'react'
import ColorEditor from './ColorEditor'

type Colores = {
  fondo: string
  texto: string
  acento: string
  botonBg: string
  botonTexto: string
}

type ColorToken = keyof Colores

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
        <ColorEditor
          label={openLabel ?? ''}
          value={colores[open]}
          onChange={v => apply(open, v)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
