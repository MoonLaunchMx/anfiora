'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { etiquetaQuienPago, filtrarSugerencias } from '@/lib/pagos/quien-pago'

type Props = {
  value: string
  onChange: (value: string) => void
  sugerencias: string[]
  placeholder?: string
  className?: string
}

const INPUT_DEFAULT = 'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'

export default function QuienPago({ value, onChange, sugerencias, placeholder, className }: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const opciones = useMemo(() => filtrarSugerencias(sugerencias, value), [sugerencias, value])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => { setHighlight(0) }, [value, open])

  const elegir = (opcion: string) => {
    onChange(opcion)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || opciones.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, opciones.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      const opcion = opciones[highlight]
      if (opcion) {
        e.preventDefault()
        elegir(opcion)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Quién pagó'}
        className={className ?? INPUT_DEFAULT}
      />

      {open && opciones.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-auto rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
          {opciones.map((opcion, i) => (
            <button
              key={opcion}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => elegir(opcion)}
              className={`flex w-full items-center px-3 py-2.5 text-left text-sm text-[#1D1E20] transition ${
                i === highlight ? 'bg-[#f5f5f5]' : 'bg-white'
              }`}
            >
              <span className="truncate">{etiquetaQuienPago(opcion)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
