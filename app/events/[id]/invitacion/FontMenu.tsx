'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { FONTS, fontStack, googleFontsHref } from '@/lib/invite/fonts'

const FONT_IDS = Object.keys(FONTS)

export default function FontMenu({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const href = useMemo(() => googleFontsHref(FONT_IDS), [])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const current = FONTS[value]

  return (
    <div ref={wrapperRef} className="relative">
      {href && <link rel="stylesheet" href={href} />}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-left outline-none focus:border-[#48C9B0]"
      >
        <span className="flex flex-col gap-0.5 overflow-hidden">
          <span className="text-[10px] text-[#666]">{label}</span>
          <span
            className="truncate text-sm text-[#1D1E20]"
            style={{ fontFamily: fontStack(value) }}
          >
            {current?.family ?? value}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#666] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[#e0e0e0] bg-white shadow-lg">
          {FONT_IDS.map(id => {
            const isActive = id === value
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onChange(id)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-base hover:bg-[#f5f5f5] ${
                  isActive ? 'text-[#48C9B0] font-semibold' : 'text-[#1D1E20]'
                }`}
                style={{ fontFamily: fontStack(id) }}
              >
                <span className="truncate">{FONTS[id].family}</span>
                {isActive && <Check size={14} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
