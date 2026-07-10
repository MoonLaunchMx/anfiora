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
    <div ref={wrapperRef} className="flex flex-col gap-2">
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
  )
}
