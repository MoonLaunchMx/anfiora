'use client'

import { useState, useEffect } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, X } from 'lucide-react'
import { formatEventDate } from '@/lib/types'
import 'react-day-picker/style.css'

type SingleProps = {
  mode?: 'single'
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minDate?: string
  disabled?: boolean
}

type RangeProps = {
  mode: 'range'
  startValue: string
  endValue: string
  onRangeChange: (start: string, end: string) => void
  placeholder?: string
  minDate?: string
  disabled?: boolean
}

type DatePickerProps = SingleProps | RangeProps

function parseLocal(str: string): Date | undefined {
  if (!str) return undefined
  const [y, m, d] = str.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDisplay(str: string): string {
  if (!str) return ''
  const [y, m, d] = str.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

const dayPickerClassNames = {
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
  range_start:     'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_end:       'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_middle:    'bg-[#f0fdfb] text-[#1a9e88] rounded-none',
  today:           'font-bold text-[#48C9B0]',
  outside:         'text-[#ddd]',
  disabled:        'text-[#e0e0e0] cursor-not-allowed',
  hidden:          'invisible',
}

const accentStyle = { '--rdp-accent-color': '#48C9B0', '--rdp-accent-background-color': '#f0fdfb' } as React.CSSProperties

export default function DatePicker(props: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const disabled = props.disabled
  const placeholder = props.placeholder ?? 'Seleccionar fecha'
  const minDate = props.minDate

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const fromDate = minDate ? parseLocal(minDate) : undefined
  const isRange = props.mode === 'range'

  const hasValue = isRange ? !!props.startValue : !!props.value
  const buttonLabel = isRange
    ? formatEventDate(props.startValue || null, props.endValue || null)
    : formatDisplay(props.value)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (props.mode === 'range') props.onRangeChange('', '')
    else props.onChange('')
  }

  const handleSelectSingle = (date: Date | undefined) => {
    if (!date || props.mode === 'range') return
    props.onChange(toYMD(date))
    setOpen(false)
  }

  const handleSelectRange = (range: DateRange | undefined) => {
    if (props.mode !== 'range') return
    const start = range?.from ? toYMD(range.from) : ''
    const end = range?.to ? toYMD(range.to) : ''
    props.onRangeChange(start, end)
  }

  const selectedSingle = props.mode !== 'range' ? parseLocal(props.value) : undefined
  const selectedRange: DateRange | undefined = props.mode === 'range'
    ? { from: parseLocal(props.startValue), to: parseLocal(props.endValue) }
    : undefined
  const defaultMonth =
    (props.mode === 'range' ? parseLocal(props.startValue) : parseLocal(props.value)) || fromDate || undefined

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
        <CalendarDays size={14} className={`shrink-0 ${hasValue ? 'text-[#48C9B0]' : 'text-[#bbb]'}`} />
        <span className={`flex-1 truncate ${!hasValue ? 'text-[#c0c0c0]' : ''}`}>
          {hasValue ? buttonLabel : placeholder}
        </span>
        {hasValue && !disabled && (
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
              <p className="text-sm font-semibold text-[#1D1E20]">
                {isRange ? 'Seleccionar fechas' : 'Seleccionar fecha'}
              </p>
              <div className="flex items-center gap-2">
                {isRange && (
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-[#48C9B0] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
                  >
                    Listo
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-[#aaa] transition hover:text-[#555]">
                  <X size={16} />
                </button>
              </div>
            </div>

            {props.mode === 'range' && props.startValue && (
              <div className="border-b border-[#f0f0f0] px-4 py-2 text-center text-xs text-[#888]">
                {formatEventDate(props.startValue, props.endValue || null)}
              </div>
            )}

            {isRange ? (
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={handleSelectRange}
                locale={es}
                disabled={fromDate ? { before: fromDate } : undefined}
                defaultMonth={defaultMonth || new Date()}
                style={accentStyle}
                classNames={dayPickerClassNames}
              />
            ) : (
              <DayPicker
                mode="single"
                selected={selectedSingle}
                onSelect={handleSelectSingle}
                locale={es}
                disabled={fromDate ? { before: fromDate } : undefined}
                defaultMonth={defaultMonth || new Date()}
                style={accentStyle}
                classNames={dayPickerClassNames}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
