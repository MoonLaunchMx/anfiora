'use client'

import { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, X } from 'lucide-react'
import 'react-day-picker/style.css'

interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minDate?: string
  disabled?: boolean
}

function parseLocal(str: string): Date | undefined {
  if (!str) return undefined
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDisplay(str: string): string {
  if (!str) return ''
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', minDate, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const selected  = parseLocal(value)
  const fromDate  = minDate ? parseLocal(minDate) : undefined

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    onChange(toYMD(date))
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
        <CalendarDays size={14} className={`shrink-0 ${value ? 'text-[#48C9B0]' : 'text-[#bbb]'}`} />
        <span className={`flex-1 truncate ${!value ? 'text-[#c0c0c0]' : ''}`}>
          {value ? formatDisplay(value) : placeholder}
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
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
              <p className="text-sm font-semibold text-[#1D1E20]">Seleccionar fecha</p>
              <button onClick={() => setOpen(false)} className="text-[#aaa] transition hover:text-[#555]">
                <X size={16} />
              </button>
            </div>
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              locale={es}
              disabled={fromDate ? { before: fromDate } : undefined}
              defaultMonth={selected || fromDate || new Date()}
              style={{ '--rdp-accent-color': '#48C9B0', '--rdp-accent-background-color': '#f0fdfb' } as React.CSSProperties}
              classNames={{
                root:            'p-4',
                month:           'w-full',
                month_caption:   'flex items-center justify-between px-1 pb-3',
                caption_label:   'text-sm font-semibold text-[#1D1E20] capitalize',
                nav:             'flex items-center gap-1',
                button_previous: 'flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]',
                button_next:     'flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]',
                weeks:           'w-full',
                weekdays:        'flex mb-1',
                weekday:         'flex-1 text-center text-[11px] font-medium text-[#bbb] uppercase pb-1',
                week:            'flex',
                day:             'flex-1 flex items-center justify-center p-0.5',
                day_button:      'h-9 w-9 rounded-lg text-sm text-[#1D1E20] transition hover:bg-[#f0fdfb] hover:text-[#1a9e88] cursor-pointer',
                selected:        'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
                today:           'font-bold text-[#48C9B0]',
                outside:         'text-[#ddd]',
                disabled:        'text-[#e0e0e0] cursor-not-allowed',
                hidden:          'invisible',
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}