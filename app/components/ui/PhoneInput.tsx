'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  toE164,
  formatAsYouType,
  detectCountry,
  isValidPhone,
  nationalNumber,
  dialCode,
  sinAcentos,
  type CountryCode,
} from '@/lib/phone'
import { useModalLayer } from '@/app/components/ui/Modal'

const emptySubscribe = () => () => {}

const DROPDOWN_WIDTH = 256
const DROPDOWN_GAP = 4
const DROPDOWN_HEADER_HEIGHT = 41
const DROPDOWN_LIST_HEIGHT = 224
const DROPDOWN_MIN_LIST_HEIGHT = 96
// Una fila de pais (text-sm, 20px de line-height + py-2) mas el py-1 superior de la
// lista: el alto minimo con el que todavia se alcanza a ver y tocar un pais completo.
const DROPDOWN_MIN_USABLE_LIST = 40
// Alto de la caja del campo: border 1+1, py-2 8+8, line-height del text-base 24.
const FIELD_HEIGHT = 42
// Peor caso del popover anclado: campo centrado verticalmente, cada lado recibe
// (vh - FIELD_HEIGHT) / 2. Un lado sirve solo si alcanza para gap + buscador +
// una fila de pais + gap. Debajo de este alto visible no hay NINGUNA posicion del
// campo en la que el popover quepa, asi que se abre como hoja centrada.
const SHEET_VIEWPORT_HEIGHT =
  2 * (DROPDOWN_GAP + DROPDOWN_HEADER_HEIGHT + DROPDOWN_MIN_USABLE_LIST + DROPDOWN_GAP) + FIELD_HEIGHT

type DropdownLayout =
  | { mode: 'popover'; top: number; left: number; listMaxHeight: number }
  | { mode: 'sheet'; top: number; left: number; width: number; height: number }

type PhoneInputProps = {
  value: string
  onChange: (e164OrEmpty: string) => void
  defaultCountry?: CountryCode
  placeholder?: string
  disabled?: boolean
  className?: string
  compact?: boolean
}

export default function PhoneInput({
  value,
  onChange,
  defaultCountry = DEFAULT_COUNTRY,
  placeholder = 'Número de teléfono',
  disabled,
  className = '',
  compact,
}: PhoneInputProps) {
  // py-2 en ambos casos: con el input a text-base (16px), iguala el alto de los
  // campos hermanos de los modales (px-3 py-2 text-base) que usan PhoneInput.
  const padY = 'py-2'
  const txt = compact ? 'text-[13px]' : 'text-sm'
  const [country, setCountry] = useState<CountryCode>(defaultCountry)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [layout, setLayout] = useState<DropdownLayout>({
    mode: 'popover',
    top: 0,
    left: 0,
    listMaxHeight: DROPDOWN_LIST_HEIGHT,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Guarda el ultimo valor E.164 conocido (recibido por props o emitido por nosotros)
  // para no volver a derivar country/text cuando el padre solo nos regresa lo que ya emitimos.
  const lastSyncedRef = useRef<string | null>(null)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  useModalLayer(open)

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

  // El pais por defecto puede llegar DESPUES del primer render: la puerta publica
  // lo deriva del navegador, que no existe al renderizar en el servidor. Mientras
  // no haya numero escrito se adopta; si ya empezo a teclear, no se le mueve.
  useEffect(() => {
    if (value || text) return
    setCountry(defaultCountry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCountry])

  const computeDropdownPosition = () => {
    const vv = window.visualViewport
    const viewportHeight = vv?.height ?? window.innerHeight
    // La hoja se ancla al viewport VISIBLE, no al de layout: con el teclado de iOS
    // abierto, `inset-0` cubriria tambien la franja que el teclado tapa.
    const openAsSheet = () =>
      setLayout({
        mode: 'sheet',
        top: vv?.offsetTop ?? 0,
        left: vv?.offsetLeft ?? 0,
        width: vv?.width ?? window.innerWidth,
        height: viewportHeight,
      })

    if (viewportHeight < SHEET_VIEWPORT_HEIGHT) {
      openAsSheet()
      return
    }

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8))

    const spaceBelow = viewportHeight - rect.bottom - DROPDOWN_GAP
    const spaceAbove = rect.top - DROPDOWN_GAP
    // Solo decide de que lado abrir. La posicion manda sobre el alto, no al reves:
    // una vez elegido el lado, el borde pegado al campo es fijo y el alto es el que
    // realmente quepa ahi.
    const flipUp = spaceBelow < DROPDOWN_HEADER_HEIGHT + DROPDOWN_MIN_LIST_HEIGHT && spaceAbove > spaceBelow

    // El lado elegido tiene que dar para el buscador mas un pais completo. Si no da,
    // no se degrada el popover (colapsarlo o moverlo lo dejaria inservible o encima
    // del campo): se abre la hoja, que no depende del espacio alrededor del campo.
    const anchoredHeight = flipUp
      ? rect.top - DROPDOWN_GAP - DROPDOWN_GAP - DROPDOWN_HEADER_HEIGHT
      : viewportHeight - rect.bottom - DROPDOWN_GAP - DROPDOWN_GAP - DROPDOWN_HEADER_HEIGHT
    if (anchoredHeight < DROPDOWN_MIN_USABLE_LIST) {
      openAsSheet()
      return
    }

    const listMaxHeight = Math.min(DROPDOWN_LIST_HEIGHT, anchoredHeight)
    const top = flipUp
      ? rect.top - DROPDOWN_GAP - (DROPDOWN_HEADER_HEIGHT + listMaxHeight)
      : rect.bottom + DROPDOWN_GAP
    setLayout({ mode: 'popover', top, left, listMaxHeight })
  }

  const toggleOpen = () => {
    if (!open) computeDropdownPosition()
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    window.addEventListener('scroll', computeDropdownPosition, true)
    window.addEventListener('resize', computeDropdownPosition)
    vv?.addEventListener('resize', computeDropdownPosition)
    vv?.addEventListener('scroll', computeDropdownPosition)
    return () => {
      window.removeEventListener('scroll', computeDropdownPosition, true)
      window.removeEventListener('resize', computeDropdownPosition)
      vv?.removeEventListener('resize', computeDropdownPosition)
      vv?.removeEventListener('scroll', computeDropdownPosition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
      setFilter('')
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open || layout.mode !== 'sheet') return
    const body = document.body
    // Se restaura el valor guardado, no la cadena vacia: si el <Modal> padre ya
    // habia bloqueado el scroll, al cerrar la hoja se le devuelve su 'hidden'
    // en vez de desbloquearle el fondo por debajo.
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [open, layout.mode])

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

  // Sin acentos y sin el "+" de la lada: quien escribe "España" o "+34" tiene que
  // encontrar su pais, no una lista vacia.
  const filtroNorm = sinAcentos(filter.trim())
  const filtroDigitos = filter.replace(/\D/g, '')
  const filteredCountries = filtroNorm
    ? COUNTRIES.filter(c =>
        sinAcentos(c.name).includes(filtroNorm) ||
        (filtroDigitos !== '' && c.dial.replace(/\D/g, '').startsWith(filtroDigitos)) ||
        sinAcentos(c.iso).includes(filtroNorm)
      )
    : COUNTRIES

  const close = () => {
    setOpen(false)
    setFilter('')
  }

  const countryOptions = (
    <>
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
    </>
  )

  const searchField = (
    <input
      autoFocus
      value={filter}
      onChange={e => setFilter(e.target.value)}
      placeholder="Buscar país"
      className="w-full bg-transparent text-base text-[#1D1E20] outline-none placeholder:text-[#c0c0c0]"
    />
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-stretch rounded-lg border bg-white transition ${
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
          onClick={() => !disabled && toggleOpen()}
          className={`flex shrink-0 items-center gap-1 rounded-l-lg border-r px-2.5 ${padY} ${txt} font-medium transition ${
            disabled
              ? 'cursor-not-allowed border-[#f0f0f0] text-[#ccc]'
              : 'border-[#e8e8e8] text-[#1D1E20] hover:bg-[#f8f8f8]'
          }`}
        >
          <span>{current?.dial ?? dialCode(country)}</span>
          <ChevronDown size={12} className="text-[#999]" />
        </button>

        <input
          type="tel"
          inputMode="tel"
          disabled={disabled}
          value={text}
          onChange={handleTextChange}
          placeholder={placeholder}
          className={`min-w-0 flex-1 rounded-r-lg bg-transparent px-3 ${padY} text-base text-[#1D1E20] outline-none placeholder:text-[#c0c0c0] disabled:cursor-not-allowed disabled:text-[#ccc]`}
        />
      </div>

      {open && mounted && createPortal(
        layout.mode === 'sheet' ? (
          <div
            style={{ top: layout.top, left: layout.left, width: layout.width, height: layout.height }}
            className="fixed z-[350] flex items-center justify-center p-2"
            onClick={close}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              ref={dropdownRef}
              onClick={e => e.stopPropagation()}
              className="relative flex max-h-full w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-[#eee] px-3 py-2">
                <Search size={13} className="shrink-0 text-[#999]" />
                {searchField}
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={close}
                  className="shrink-0 text-[#999] transition hover:text-[#1D1E20]"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                {countryOptions}
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={dropdownRef}
            style={{ top: layout.top, left: layout.left }}
            className="fixed z-[350] w-64 overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-[#eee] px-3 py-2">
              <Search size={13} className="shrink-0 text-[#999]" />
              {searchField}
              {filter && (
                <button type="button" onClick={() => setFilter('')} className="text-[#999] transition hover:text-[#1D1E20]">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="overflow-y-auto overscroll-contain py-1" style={{ maxHeight: layout.listMaxHeight }}>
              {countryOptions}
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  )
}
