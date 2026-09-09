'use client'

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatEventDate } from '@/lib/types'
import { maskDateInput, parseTypedDate, formatTypedDate, isCompleteDateInput } from '@/lib/fecha-escrita'
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
  root:            'p-0',
  month:           'w-full',
  month_caption:   'hidden',
  nav:             'hidden',
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

const typedInputClass = (bad: boolean) =>
  `w-full rounded-lg border px-2.5 py-2 text-sm tabular-nums tracking-wide outline-none transition placeholder:text-[#c8c8c8] ${
    bad ? 'border-[#e0a17a] bg-[#fdf3ec] text-[#b4632a]' : 'border-[#e0e0e0] bg-white text-[#1D1E20] focus:border-[#48C9B0]'
  }`

export default function DatePicker(props: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date>(new Date())
  const [typedStart, setTypedStart] = useState('')
  const [typedEnd, setTypedEnd] = useState('')
  const [badStart, setBadStart] = useState(false)
  const [badEnd, setBadEnd] = useState(false)
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
    setTypedStart(formatTypedDate(props.mode === 'range' ? props.startValue : props.value))
    setTypedEnd(formatTypedDate(props.mode === 'range' ? props.endValue : ''))
    setBadStart(false)
    setBadEnd(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fromDate = minDate ? parseLocal(minDate) : undefined
  const isRange = props.mode === 'range'

  const hasValue = isRange ? !!props.startValue : !!props.value
  const buttonLabel = isRange
    ? formatEventDate(props.startValue || null, props.endValue || null)
    : formatDisplay(props.value)

  const years = useMemo(() => {
    const now = new Date().getFullYear()
    const marks = [now - 2, now + 6, month.getFullYear()]
    if (fromDate) marks.push(fromDate.getFullYear())
    const selected = parseLocal(isRange ? (props as RangeProps).startValue : (props as SingleProps).value)
    if (selected) marks.push(selected.getFullYear())
    const min = Math.min(...marks)
    const max = Math.max(...marks)
    return Array.from({ length: max - min + 1 }, (_, i) => min + i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, minDate, isRange, isRange ? (props as RangeProps).startValue : (props as SingleProps).value])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('es-MX', { month: 'long' })),
    []
  )

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
    setTypedStart(formatTypedDate(start))
    setTypedEnd(formatTypedDate(end))
    setBadStart(false)
    setBadEnd(false)
  }

  const belowMin = (ymd: string) => !!minDate && ymd < minDate

  const commitTyped = (raw: string, target: 'start' | 'end') => {
    const complete = isCompleteDateInput(raw)
    const ymd = parseTypedDate(raw)
    const invalid = complete && (!ymd || belowMin(ymd))

    if (target === 'start') setBadStart(invalid)
    else setBadEnd(invalid)
    if (!ymd || invalid) return

    setMonth(parseLocal(ymd)!)

    if (props.mode === 'range') {
      if (target === 'start') {
        const end = props.endValue && props.endValue < ymd ? '' : props.endValue
        props.onRangeChange(ymd, end)
        if (!end) setTypedEnd('')
      } else {
        if (!props.startValue || ymd < props.startValue) {
          props.onRangeChange(ymd, '')
          setTypedStart(formatTypedDate(ymd))
          setTypedEnd('')
        } else {
          props.onRangeChange(props.startValue, ymd)
        }
      }
    } else {
      props.onChange(ymd)
    }
  }

  const onTypedChange = (raw: string, target: 'start' | 'end') => {
    const masked = maskDateInput(raw)
    if (target === 'start') setTypedStart(masked)
    else setTypedEnd(masked)
    commitTyped(masked, target)
  }

  const selectedSingle = props.mode !== 'range' ? parseLocal(props.value) : undefined
  const selectedRange: DateRange | undefined = props.mode === 'range'
    ? { from: parseLocal(props.startValue), to: parseLocal(props.endValue) }
    : undefined

  const goPrevMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const goNextMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  const navButtonClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]'
  const selectClass = 'cursor-pointer rounded-lg border border-[#e0e0e0] bg-white px-2 py-1.5 text-sm font-semibold capitalize text-[#1D1E20] outline-none transition hover:border-[#48C9B0] focus:border-[#48C9B0]'

  const anyBad = badStart || badEnd

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
        <div
          data-datepicker-portal
          className="fixed inset-0 z-[350] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-[336px] max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-4 py-3">
              <p className="text-sm font-semibold text-[#1D1E20]">
                {isRange ? 'Seleccionar fechas' : 'Seleccionar fecha'}
              </p>
              <button onClick={() => setOpen(false)} className="text-[#aaa] transition hover:text-[#555]" aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 pb-3 pt-3">
              <div className="flex items-center justify-center gap-1.5 pb-3">
                <button type="button" onClick={goPrevMonth} className={navButtonClass} aria-label="Mes anterior">
                  <ChevronLeft size={15} />
                </button>
                <select
                  aria-label="Mes"
                  value={month.getMonth()}
                  onChange={e => setMonth(m => new Date(m.getFullYear(), Number(e.target.value), 1))}
                  className={`${selectClass} w-[116px]`}
                >
                  {months.map((label, i) => <option key={label} value={i}>{label}</option>)}
                </select>
                <select
                  aria-label="Año"
                  value={month.getFullYear()}
                  onChange={e => setMonth(m => new Date(Number(e.target.value), m.getMonth(), 1))}
                  className={`${selectClass} w-[82px]`}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button type="button" onClick={goNextMonth} className={navButtonClass} aria-label="Mes siguiente">
                  <ChevronRight size={15} />
                </button>
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
                  fixedWeeks
                  showOutsideDays
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
                  fixedWeeks
                  showOutsideDays
                  disabled={fromDate ? { before: fromDate } : undefined}
                  style={accentStyle}
                  classNames={dayPickerClassNames}
                />
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-[#f0f0f0] px-4 py-3">
              {isRange ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Desde</p>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="dd/mm/aaaa"
                      value={typedStart}
                      onChange={e => onTypedChange(e.target.value, 'start')}
                      className={typedInputClass(badStart)}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Hasta</p>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="dd/mm/aaaa"
                      value={typedEnd}
                      onChange={e => onTypedChange(e.target.value, 'end')}
                      className={typedInputClass(badEnd)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="dd/mm/aaaa"
                    value={typedStart}
                    onChange={e => onTypedChange(e.target.value, 'start')}
                    className={typedInputClass(badStart)}
                  />
                  <button
                    onClick={() => setOpen(false)}
                    className="shrink-0 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
                  >
                    Listo
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className={`text-[11px] ${anyBad ? 'text-[#b4632a]' : 'text-[#888]'}`}>
                  {anyBad
                    ? 'Esa fecha no es válida'
                    : isRange
                      ? (props.mode === 'range' && props.startValue
                          ? formatEventDate(props.startValue, props.endValue || null)
                          : 'Elige uno o dos días')
                      : 'Escribe la fecha o elígela arriba'}
                </span>
                {isRange && (
                  <button
                    onClick={() => setOpen(false)}
                    className="shrink-0 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
                  >
                    Listo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
