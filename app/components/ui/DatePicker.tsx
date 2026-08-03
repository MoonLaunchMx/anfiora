'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatEventDate } from '@/lib/types'
import { useModalLayer } from '@/app/components/ui/Modal'
import 'react-day-picker/style.css'

const emptySubscribe = () => () => {}

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
  root:            'p-4 pt-2',
  month:           'w-full',
  month_caption:   'flex items-center justify-center px-1 pb-3',
  caption_label:   'text-sm font-semibold text-[#1D1E20] capitalize',
  weeks:           'w-full',
  weekdays:        'flex mb-1',
  weekday:         'flex-1 text-center text-[11px] font-medium text-[#bbb] uppercase pb-1',
  week:            'flex',
  day:             'flex-1 flex items-center justify-center p-0.5',
  day_button:      'h-9 w-9 rounded-lg text-sm text-[#1D1E20] transition hover:bg-[#f0fdfb] hover:text-[#1a9e88] cursor-pointer',
  selected:        'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_start:     'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_end:       'bg-[#48C9B0] text-white rounded-lg hover:bg-[#3ab89f]',
  range_middle:    'bg-[#d0f5ec] text-[#0F6E56] rounded-none',
  today:           'font-bold text-[#48C9B0]',
  outside:         'text-[#ddd]',
  disabled:        'text-[#e0e0e0] cursor-not-allowed',
  hidden:          'invisible',
}

const accentStyle = { '--rdp-accent-color': '#48C9B0', '--rdp-accent-background-color': '#f0fdfb' } as React.CSSProperties

export default function DatePicker(props: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date>(new Date())
  const disabled = props.disabled
  const placeholder = props.placeholder ?? 'Seleccionar fecha'
  const minDate = props.minDate
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  useModalLayer(open)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const init =
      (props.mode === 'range' ? parseLocal(props.startValue) : parseLocal(props.value)) ||
      (minDate ? parseLocal(minDate) : undefined) ||
      new Date()
    setMonth(init)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const goPrevMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const goNextMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  const navButtonClass = 'flex h-7 w-7 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]'

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

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-4 py-3">
              <p className="text-sm font-semibold text-[#1D1E20]">
                {isRange ? 'Seleccionar fechas' : 'Seleccionar fecha'}
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={goPrevMonth} className={navButtonClass}>
                  <ChevronLeft size={15} />
                </button>
                <button type="button" onClick={goNextMonth} className={navButtonClass}>
                  <ChevronRight size={15} />
                </button>
                <button onClick={() => setOpen(false)} className="ml-1 text-[#aaa] transition hover:text-[#555]">
                  <X size={16} />
                </button>
              </div>
            </div>

            {isRange ? (
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={handleSelectRange}
                locale={es}
                month={month}
                onMonthChange={setMonth}
                hideNavigation
                disabled={fromDate ? { before: fromDate } : undefined}
                style={accentStyle}
                classNames={dayPickerClassNames}
              />
            ) : (
              <DayPicker
                mode="single"
                selected={selectedSingle}
                onSelect={handleSelectSingle}
                locale={es}
                month={month}
                onMonthChange={setMonth}
                hideNavigation
                disabled={fromDate ? { before: fromDate } : undefined}
                style={accentStyle}
                classNames={dayPickerClassNames}
              />
            )}

            {props.mode === 'range' && (
              <div className="flex items-center justify-between gap-3 border-t border-[#f0f0f0] px-4 py-3">
                <span className="text-xs text-[#888]">
                  {props.startValue ? formatEventDate(props.startValue, props.endValue || null) : 'Elige uno o dos días'}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
