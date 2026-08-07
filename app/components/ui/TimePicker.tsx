'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Clock, X } from 'lucide-react'
import { useModalLayer } from '@/app/components/ui/Modal'

const emptySubscribe = () => () => {}

interface TimePickerProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

function formatDisplay(val: string): string {
  if (!val) return ''
  const [h, m] = val.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function to24(h: number, m: number, period: 'am' | 'pm'): string {
  let h24 = h
  if (period === 'pm' && h !== 12) h24 = h + 12
  if (period === 'am' && h === 12) h24 = 0
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parse(val: string): { h: number; m: number; period: 'am' | 'pm' } {
  if (!val) return { h: 12, m: 0, period: 'pm' }
  const [hh, mm] = val.split(':').map(Number)
  return { h: hh % 12 || 12, m: mm, period: hh >= 12 ? 'pm' : 'am' }
}

function clampN(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const AMPM: ('am' | 'pm')[] = ['am', 'pm']

const ITEM_H = 40
const PAD = ITEM_H * 2

function Wheel<T extends string | number>({
  items, value, onChange, render,
}: { items: T[]; value: T; onChange: (v: T) => void; render: (v: T) => string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = items.indexOf(value)
    if (idx < 0) return
    const target = idx * ITEM_H
    if (Math.abs(el.scrollTop - target) > ITEM_H / 2) el.scrollTop = target
  }, [value, items])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const idx = clampN(Math.round(el.scrollTop / ITEM_H), 0, items.length - 1)
    if (items[idx] !== value) onChange(items[idx])
  }

  const selectAt = (idx: number) => {
    ref.current?.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
    onChange(items[idx])
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="tp-wheel relative h-[200px] snap-y snap-mandatory overflow-y-scroll"
      style={{
        scrollbarWidth: 'none',
        maskImage: 'linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)',
      }}
    >
      <div style={{ height: PAD }} />
      {items.map((it, i) => {
        const on = it === value
        return (
          <button
            key={i}
            type="button"
            onClick={() => selectAt(i)}
            className={`flex h-10 w-full snap-center items-center justify-center text-lg tabular-nums transition ${
              on ? 'font-bold text-[#1D1E20]' : 'font-medium text-[#c4c4c4]'
            }`}
          >
            {render(it)}
          </button>
        )
      })}
      <div style={{ height: PAD }} />
    </div>
  )
}

export default function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const [open, setOpen]     = useState(false)
  const [h, setH]           = useState(12)
  const [m, setM]           = useState(0)
  const [period, setPeriod] = useState<'am' | 'pm'>('pm')
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  useModalLayer(open)

  useEffect(() => {
    if (value) {
      const p = parse(value)
      setH(p.h); setM(p.m); setPeriod(p.period)
    }
  }, [value])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleSave = () => {
    onChange(to24(h, m, period))
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
          disabled
            ? 'cursor-not-allowed border-[#f0f0f0] bg-[#f8f8f8] text-[#ccc]'
            : 'border-[#d0d0d0] bg-white text-[#1D1E20] hover:border-[#48C9B0]'
        }`}
      >
        <Clock size={14} className={`shrink-0 ${value ? 'text-[#48C9B0]' : 'text-[#bbb]'}`} />
        <span className={`flex-1 ${!value ? 'text-[#c0c0c0]' : ''}`}>
          {value ? formatDisplay(value) : 'Seleccionar hora'}
        </span>
        {value && !disabled && (
          <span onClick={handleClear} className="shrink-0 text-[#ccc] transition hover:text-[#888]">
            <X size={13} />
          </span>
        )}
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <style jsx global>{`
              .tp-wheel::-webkit-scrollbar { display: none; }
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
              <p className="text-sm font-semibold text-[#1D1E20]">Seleccionar hora</p>
              <button onClick={() => setOpen(false)} className="text-[#aaa] transition hover:text-[#555]">
                <X size={16} />
              </button>
            </div>

            {/* Ruedas */}
            <div className="px-4 pb-1 pt-3">
              <div className="grid grid-cols-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Hora</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Min</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">AM/PM</p>
              </div>

              <div className="relative">
                {/* Banda central */}
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-10 -translate-y-1/2 rounded-lg border-y border-[#48C9B0]/40 bg-[#48C9B0]/[0.07]" />
                <div className="grid grid-cols-3">
                  <Wheel items={HOURS} value={h} onChange={setH} render={v => String(v)} />
                  <Wheel items={MINUTES} value={m} onChange={setM} render={v => String(v).padStart(2, '0')} />
                  <Wheel items={AMPM} value={period} onChange={setPeriod} render={v => v.toUpperCase()} />
                </div>
              </div>
            </div>

            {/* Footer: preview + guardar */}
            <div className="flex items-center gap-3 border-t border-[#f0f0f0] px-4 py-3">
              <p className="text-base font-bold tabular-nums text-[#1D1E20]">
                {h}:{String(m).padStart(2, '0')} <span className="text-sm font-semibold uppercase text-[#888]">{period}</span>
              </p>
              <button
                onClick={handleSave}
                className="flex-1 rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
              >
                Guardar hora
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
