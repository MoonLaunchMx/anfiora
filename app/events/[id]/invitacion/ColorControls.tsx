'use client'
import { useEffect, useRef, useState } from 'react'

type Colores = {
  fondo: string
  texto: string
  acento: string
  botonBg: string
  botonTexto: string
}

type ColorToken = keyof Colores

const PALETTES: { name: string; c: Colores }[] = [
  { name: 'Warm Sunset', c: { fondo: 'linear-gradient(160deg,#ff9a52,#ff5e8a)', texto: '#ffffff', acento: '#ffe0b3', botonBg: '#ffffff', botonTexto: '#ff5e6c' } },
  { name: 'Midnight Club', c: { fondo: '#0a0620', texto: '#eaeaff', acento: '#8b5cf6', botonBg: '#8b5cf6', botonTexto: '#ffffff' } },
  { name: 'Emerald Luxury', c: { fondo: 'linear-gradient(160deg,#0f3d2e,#0a2a20)', texto: '#e8f5e9', acento: '#d4af37', botonBg: '#d4af37', botonTexto: '#0f3d2e' } },
  { name: 'Blush Romance', c: { fondo: 'linear-gradient(160deg,#fbe9ec,#eabfce)', texto: '#8a4a5e', acento: '#c76b86', botonBg: '#c76b86', botonTexto: '#ffffff' } },
  { name: 'Ocean Breeze', c: { fondo: 'linear-gradient(180deg,#7ec8e3,#b8e0d2)', texto: '#0d5a6e', acento: '#0d5a6e', botonBg: '#0d5a6e', botonTexto: '#ffffff' } },
  { name: 'Golden Hour', c: { fondo: 'linear-gradient(160deg,#faf6ec,#f0e4c8)', texto: '#7a5f24', acento: '#b8912f', botonBg: '#b8912f', botonTexto: '#ffffff' } },
  { name: 'Noir', c: { fondo: '#0a0a0a', texto: '#ffffff', acento: '#e11d1d', botonBg: '#e11d1d', botonTexto: '#ffffff' } },
  { name: 'Cotton Candy', c: { fondo: 'linear-gradient(135deg,#c0c0ff,#ffd1f0)', texto: '#5a2a8a', acento: '#7a3bd4', botonBg: '#7a3bd4', botonTexto: '#ffffff' } },
]

const QUICK_SWATCHES = ['#ffffff', '#1D1E20', '#48C9B0', '#F4C430', '#d4a853', '#e11d1d', '#c76b86', '#6b8455', '#8b5cf6', '#0d5a6e']

const TOKENS: { key: ColorToken; label: string }[] = [
  { key: 'fondo', label: 'Fondo' },
  { key: 'texto', label: 'Texto' },
  { key: 'acento', label: 'Acento' },
  { key: 'botonBg', label: 'Botón' },
  { key: 'botonTexto', label: 'Texto botón' },
]

function isHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)
}

export default function ColorControls({
  colores,
  onColores,
}: {
  colores: Colores
  onColores: (patch: Partial<Colores>) => void
}) {
  const [open, setOpen] = useState<ColorToken | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(null)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function apply(token: ColorToken, v: string) {
    onColores({ [token]: v } as Partial<Colores>)
  }

  return (
    <div ref={wrapperRef} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">Paletas</p>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => onColores(p.c)}
              className="flex w-[72px] shrink-0 flex-col gap-1 rounded-lg p-1 transition-transform hover:-translate-y-0.5"
              title={p.name}
            >
              <span className="relative block h-8 w-full overflow-hidden rounded-md border border-[#e8e8e8]" style={{ background: p.c.fondo }}>
                <span className="absolute bottom-1 right-1 flex gap-0.5">
                  <span className="h-2 w-2 rounded-full border border-white/40" style={{ background: p.c.acento }} />
                  <span className="h-2 w-2 rounded-full border border-white/40" style={{ background: p.c.texto }} />
                  <span className="h-2 w-2 rounded-full border border-white/40" style={{ background: p.c.botonBg }} />
                </span>
              </span>
              <span className="truncate text-[10px] text-[#666]">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">Colores</p>
        <div className="flex flex-wrap gap-4">
          {TOKENS.map(({ key, label }) => {
            const value = colores[key]
            const isOpen = open === key
            return (
              <div key={key} className="relative flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="h-10 w-10 rounded-full border border-[#e0e0e0] shadow-sm outline-none transition-transform hover:scale-105 focus:border-[#48C9B0]"
                  style={{ background: value }}
                  aria-label={label}
                />
                <span className="text-[10px] text-[#666]">{label}</span>

                {isOpen && (
                  <div className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-[#eee] bg-white p-3 shadow-xl">
                    <input
                      type="color"
                      value={isHex(value) ? value : '#ffffff'}
                      onChange={e => apply(key, e.target.value)}
                      className="h-10 w-full cursor-pointer rounded-lg border border-[#e0e0e0]"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={e => apply(key, e.target.value)}
                      className="mt-2 w-full rounded-lg border border-[#e0e0e0] px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
                      placeholder="#hex o gradient(...)"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {QUICK_SWATCHES.map(sw => (
                        <button
                          key={sw}
                          type="button"
                          onClick={() => apply(key, sw)}
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
          })}
        </div>
      </div>
    </div>
  )
}
