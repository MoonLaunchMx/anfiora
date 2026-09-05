'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { sinAcentos } from '@/lib/phone'

export type OpcionGeo = {
  valor: string
  // Encabezado bajo el que se agrupa. Las opciones deben venir ya ordenadas
  // por grupo: el encabezado se pinta cada vez que cambia.
  grupo?: string
  nota?: string
  icono?: string
}

type Props = {
  valor: string
  onChange: (valor: string) => void
  opciones: OpcionGeo[]
  placeholder: string
  buscarPlaceholder?: string
  // Deja usar lo tecleado aunque no este en la lista. Para ciudad, donde
  // ninguna lista trae todos los pueblos y bloquear seria peor que un dedazo.
  libre?: boolean
  deshabilitado?: boolean
  textoDeshabilitado?: string
  sinOpcionesTexto?: string
  icono?: string
  className?: string
}

type Item =
  | { tipo: 'opcion'; opcion: OpcionGeo }
  | { tipo: 'libre'; texto: string }

export default function SelectorGeo({
  valor, onChange, opciones, placeholder, buscarPlaceholder,
  libre, deshabilitado, textoDeshabilitado, sinOpcionesTexto,
  icono, className = 'border-[#e0e0e0]',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pelar = (s: string) => sinAcentos(s).replace(/\s+/g, ' ').trim()

  const filtradas = useMemo(() => {
    const q = pelar(query)
    if (!q) return opciones
    return opciones.filter(o => pelar(o.valor).includes(q))
  }, [opciones, query])

  const tecleado = query.trim()
  const yaExiste = tecleado !== '' && opciones.some(o => pelar(o.valor) === pelar(tecleado))
  const puedeUsarLibre = !!libre && tecleado !== '' && !yaExiste

  const items: Item[] = useMemo(() => [
    ...filtradas.map((opcion): Item => ({ tipo: 'opcion', opcion })),
    ...(puedeUsarLibre ? [{ tipo: 'libre', texto: tecleado } as Item] : []),
  ], [filtradas, puedeUsarLibre, tecleado])

  const cerrar = () => { setOpen(false); setQuery('') }

  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) cerrar()
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [open])

  const escribir = (texto: string) => { setQuery(texto); setHighlight(0) }

  const abrir = () => {
    if (deshabilitado) return
    setQuery('')
    const idx = opciones.findIndex(o => o.valor === valor)
    setHighlight(idx >= 0 ? idx : 0)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const elegir = (item: Item) => {
    onChange(item.tipo === 'opcion' ? item.opcion.valor : item.texto)
    cerrar()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setHighlight(h => Math.min(h + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[highlight]
      if (item) elegir(item)
    } else if (e.key === 'Escape') {
      e.preventDefault(); cerrar()
    }
  }

  let grupoPintado: string | undefined

  return (
    <div ref={wrapperRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={abrir}
          disabled={deshabilitado}
          className={`flex w-full items-center gap-2 rounded-lg border ${className} bg-white px-3 py-2 text-left text-base outline-none transition focus:border-[#48C9B0] disabled:cursor-not-allowed disabled:bg-[#fafafa]`}
        >
          {icono && <span className="shrink-0 text-[15px] leading-none">{icono}</span>}
          <span className={`flex-1 truncate ${valor ? 'text-[#1D1E20]' : 'text-[#c2c2c2]'}`}>
            {valor || (deshabilitado ? textoDeshabilitado ?? placeholder : placeholder)}
          </span>
          <ChevronDown size={14} className="shrink-0 text-[#aaa]" />
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => escribir(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={buscarPlaceholder ?? placeholder}
          className="w-full rounded-lg border border-[#48C9B0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none"
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-auto rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
          {items.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-[#aaa]">
              {sinOpcionesTexto ?? 'Sin coincidencias'}
            </p>
          )}

          {items.map((item, i) => {
            const marcado = i === highlight

            if (item.tipo === 'libre') {
              return (
                <button
                  key="libre"
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => elegir(item)}
                  className={`flex w-full items-center gap-1.5 border-t border-[#f0f0f0] px-3 py-2.5 text-left text-sm font-medium text-[#1D9E75] transition ${
                    marcado ? 'bg-[#f5f5f5]' : 'bg-white'
                  }`}
                >
                  <Plus size={13} />
                  Usar «{item.texto}»
                </button>
              )
            }

            const { opcion } = item
            const encabezado = opcion.grupo && opcion.grupo !== grupoPintado ? opcion.grupo : null
            if (opcion.grupo) grupoPintado = opcion.grupo

            return (
              <div key={`${opcion.grupo ?? ''}-${opcion.valor}`}>
                {encabezado && (
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-[#bbb]">
                    {encabezado}
                  </p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => elegir(item)}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#1D1E20] transition ${
                    marcado ? 'bg-[#f5f5f5]' : 'bg-white'
                  }`}
                >
                  {opcion.icono && <span className="shrink-0 text-[15px] leading-none">{opcion.icono}</span>}
                  <span className="flex-1 truncate">{opcion.valor}</span>
                  {opcion.nota && <span className="shrink-0 text-[11px] text-[#999]">{opcion.nota}</span>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
