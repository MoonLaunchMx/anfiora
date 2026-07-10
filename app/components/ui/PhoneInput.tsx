'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  toE164,
  formatAsYouType,
  detectCountry,
  isValidPhone,
  nationalNumber,
  type CountryCode,
} from '@/lib/phone'

type PhoneInputProps = {
  value: string
  onChange: (e164OrEmpty: string) => void
  defaultCountry?: CountryCode
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function PhoneInput({
  value,
  onChange,
  defaultCountry = DEFAULT_COUNTRY,
  placeholder = 'Número de teléfono',
  disabled,
  className = '',
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  // Guarda el ultimo valor E.164 conocido (recibido por props o emitido por nosotros)
  // para no volver a derivar country/text cuando el padre solo nos regresa lo que ya emitimos.
  const lastSyncedRef = useRef<string | null>(null)

  useEffect(() => {
    if (value === lastSyncedRef.current) return
    lastSyncedRef.current = value
    if (!value) {
      setText('')
      setCountry(defaultCountry)
      return
    }
    const detected = detectCountry(value) ?? defaultCountry
    setCountry(detected)
    setText(formatAsYouType(value, detected))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFilter('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const emit = (raw: string, targetCountry: CountryCode) => {
    const next = raw.trim() ? (toE164(raw, targetCountry) ?? '') : ''
    lastSyncedRef.current = next
    onChange(next)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const detected = raw ? detectCountry(raw) : null
    const nextCountry = detected ?? country
    if (nextCountry !== country) setCountry(nextCountry)
    setText(raw ? formatAsYouType(raw, nextCountry) : '')
    emit(raw, nextCountry)
  }

  const handleSelectCountry = (iso: CountryCode) => {
    setCountry(iso)
    setOpen(false)
    setFilter('')
    const nat = nationalNumber(text)
    setText(nat ? formatAsYouType(nat, iso) : '')
    emit(nat, iso)
  }

  const current = COUNTRIES.find(c => c.iso === country)
  const showError = text.trim() !== '' && !isValidPhone(text, country)

  const filteredCountries = filter.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.dial.includes(filter) ||
        c.iso.toLowerCase().includes(filter.toLowerCase())
      )
    : COUNTRIES

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center rounded-lg border bg-white transition ${
          disabled
            ? 'cursor-not-allowed border-[#f0f0f0] bg-[#f8f8f8]'
            : showError
              ? 'border-[#ffc0c0]'
              : 'border-[#d0d0d0] focus-within:border-[#48C9B0]'
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(o => !o)}
          className={`flex shrink-0 items-center gap-1 rounded-l-lg border-r px-2.5 py-2.5 text-sm font-medium transition ${
            disabled
              ? 'cursor-not-allowed border-[#f0f0f0] text-[#ccc]'
              : 'border-[#e8e8e8] text-[#1D1E20] hover:bg-[#f8f8f8]'
          }`}
        >
          <span>{current?.dial ?? ''}</span>
          <ChevronDown size={12} className="text-[#999]" />
        </button>

        <input
          type="tel"
          inputMode="tel"
          disabled={disabled}
          value={text}
          onChange={handleTextChange}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2.5 text-sm text-[#1D1E20] outline-none placeholder:text-[#c0c0c0] disabled:cursor-not-allowed disabled:text-[#ccc]"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[100] w-64 overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-[#eee] px-3 py-2">
            <Search size={13} className="shrink-0 text-[#999]" />
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar país"
              className="w-full bg-transparent text-sm text-[#1D1E20] outline-none placeholder:text-[#c0c0c0]"
            />
            {filter && (
              <button type="button" onClick={() => setFilter('')} className="text-[#999] transition hover:text-[#1D1E20]">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredCountries.length === 0 && (
              <p className="px-3 py-2 text-sm text-[#999]">Sin resultados</p>
            )}
            {filteredCountries.map(c => (
              <button
                key={c.iso}
                type="button"
                onClick={() => handleSelectCountry(c.iso)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                  c.iso === country ? 'bg-[#f0f0f0] text-[#1D1E20]' : 'text-[#333] hover:bg-[#f8f8f8]'
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-[#999]">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
