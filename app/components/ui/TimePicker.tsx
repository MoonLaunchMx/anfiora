'use client'

import { useState, useEffect } from 'react'
import { Clock, X } from 'lucide-react'

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

const HOURS   = [1,2,3,4,5,6,7,8,9,10,11,12]
const MINUTES = [0,5,10,15,20,25,30,35,40,45,50,55]

export default function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const [open, setOpen]     = useState(false)
  const [h, setH]           = useState(12)
  const [m, setM]           = useState(0)
  const [period, setPeriod] = useState<'am' | 'pm'>('pm')

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

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
              <p className="text-sm font-semibold text-[#1D1E20]">Seleccionar hora</p>
              <button onClick={() => setOpen(false)} className="text-[#aaa] transition hover:text-[#555]">
                <X size={16} />
              </button>
            </div>

            <div className="p-4">

              {/* Horas */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Hora</p>
              <div className="mb-4 grid grid-cols-6 gap-1.5">
                {HOURS.map(hr => (
                  <button key={hr}
                    onClick={() => setH(hr)}
                    className={`rounded-lg py-2 text-center text-sm font-medium transition ${
                      h === hr ? 'bg-[#48C9B0] text-white' : 'border border-[#e8e8e8] text-[#555] hover:border-[#48C9B0] hover:text-[#1a9e88]'
                    }`}
                  >{hr}</button>
                ))}
              </div>

              {/* Minutos */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Minutos</p>
              <div className="mb-4 grid grid-cols-6 gap-1.5">
                {MINUTES.map(min => (
                  <button key={min}
                    onClick={() => setM(min)}
                    className={`rounded-lg py-2 text-center text-sm font-medium transition ${
                      m === min ? 'bg-[#48C9B0] text-white' : 'border border-[#e8e8e8] text-[#555] hover:border-[#48C9B0] hover:text-[#1a9e88]'
                    }`}
                  >{String(min).padStart(2, '0')}</button>
                ))}
              </div>

              {/* AM / PM — siempre los dos visibles */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">AM / PM</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['am', 'pm'] as const).map(p => (
                  <button key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-lg py-2.5 text-sm font-semibold uppercase transition ${
                      period === p
                        ? 'bg-[#48C9B0] text-white'
                        : 'border border-[#e0e0e0] text-[#888] hover:border-[#48C9B0] hover:text-[#1a9e88]'
                    }`}
                  >{p === 'am' ? 'AM' : 'PM'}</button>
                ))}
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
        </div>
      )}
    </>
  )
}