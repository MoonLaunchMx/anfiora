'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Categoria, activas, buscarPorNombre, crearCategoria } from '@/lib/rolodex/categorias-store'
import { normalizarCategoria } from '@/lib/rolodex/categorias'

type Props = {
  categorias: Categoria[]
  valorId: string | null
  onChange: (categoria: Categoria) => void
  userId: string
  className: string
}

type Item =
  | { tipo: 'categoria'; categoria: Categoria }
  | { tipo: 'crear' }

export default function CategoriaPicker({ categorias, valorId, onChange, userId, className }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  // Categorias creadas en esta sesion del control que el padre todavia no
  // refleja en su prop. Sin esto, elegir "Crear" deja seleccionado un id que
  // no aparece en `categorias` y el campo vuelve a verse vacio aunque la
  // fila ya exista en la base de datos.
  const [creadas, setCreadas] = useState<Categoria[]>([])

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // El prop manda cuando trae la misma fila (el padre ya se actualizo);
  // `creadas` solo llena el hueco mientras eso no pasa.
  const todas = useMemo(() => {
    const vistas = new Set(categorias.map(c => c.id))
    const extra = creadas.filter(c => !vistas.has(c.id))
    return [...categorias, ...extra]
  }, [categorias, creadas])

  const propia = todas.find(c => c.id === valorId) ?? null

  // La propia categoria del proveedor siempre se ofrece, aunque este archivada:
  // si no, el campo saldria vacio y guardar le cambiaria la categoria sin querer.
  const opciones = useMemo(() => {
    const act = activas(todas)
    if (propia && propia.archived_at !== null && !act.some(c => c.id === propia.id)) {
      return [...act, propia]
    }
    return act
  }, [todas, propia])

  const filtradas = useMemo(() => {
    const q = normalizarCategoria(query)
    if (!q) return opciones
    return opciones.filter(c => normalizarCategoria(c.name).includes(q))
  }, [opciones, query])

  const nombreTecleado = query.trim()
  // Busca entre TODAS las categorias (incluidas archivadas ajenas y las
  // creadas en esta sesion), no solo las ofrecidas: si ya existe con ese
  // nombre no hay nada que crear.
  const coincideExacta = nombreTecleado !== '' && buscarPorNombre(todas, nombreTecleado) !== null
  const puedeCrear = nombreTecleado !== '' && !coincideExacta

  const items: Item[] = useMemo(() => [
    ...filtradas.map((categoria): Item => ({ tipo: 'categoria', categoria })),
    ...(puedeCrear ? [{ tipo: 'crear' } as Item] : []),
  ], [filtradas, puedeCrear])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) cerrar()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => { setHighlight(0) }, [query])

  const abrir = () => {
    setQuery('')
    setError('')
    const idx = opciones.findIndex(c => c.id === valorId)
    setHighlight(idx >= 0 ? idx : 0)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const cerrar = () => {
    setOpen(false)
    setQuery('')
    setError('')
  }

  const elegir = async (item: Item) => {
    if (item.tipo === 'categoria') {
      onChange(item.categoria)
      cerrar()
      return
    }
    if (creando) return
    const nombre = query.trim()
    if (!nombre) return
    setCreando(true)
    setError('')
    const { categoria, error: err } = await crearCategoria(userId, nombre, todas)
    setCreando(false)
    if (err || !categoria) {
      setError(err ?? 'No se pudo crear la categoría.')
      return
    }
    setCreadas(prev => prev.some(c => c.id === categoria.id) ? prev : [...prev, categoria])
    onChange(categoria)
    cerrar()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[highlight]
      if (item) elegir(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cerrar()
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={abrir}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border ${className} bg-white px-3 py-2 text-left text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]`}
        >
          <span className="truncate">{propia ? propia.name : 'Selecciona categoría'}</span>
          <ChevronDown size={14} className="shrink-0 text-[#aaa]" />
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={propia?.name ?? 'Buscar o crear categoría'}
          className="w-full rounded-lg border border-[#48C9B0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none"
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-auto rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
          {items.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-[#aaa]">Sin coincidencias</p>
          )}
          {items.map((item, i) => {
            const isHighlighted = i === highlight
            if (item.tipo === 'categoria') {
              const archivada = item.categoria.archived_at !== null
              return (
                <button
                  key={item.categoria.id}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => elegir(item)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                    isHighlighted ? 'bg-[#f5f5f5]' : 'bg-white'
                  } ${archivada ? 'text-[#999]' : 'text-[#1D1E20]'}`}
                >
                  <span className="truncate">{item.categoria.name}</span>
                  {archivada && (
                    <span className="shrink-0 rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-0.5 text-[10px] font-semibold text-[#999]">
                      Archivada
                    </span>
                  )}
                </button>
              )
            }
            return (
              <button
                key="crear"
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => elegir(item)}
                disabled={creando}
                className={`flex w-full items-center gap-1.5 border-t border-[#f0f0f0] px-3 py-2.5 text-left text-sm font-medium text-[#48C9B0] transition disabled:opacity-50 ${
                  isHighlighted ? 'bg-[#f5f5f5]' : 'bg-white'
                }`}
              >
                <Plus size={13} />
                {creando ? 'Creando...' : `Crear "${nombreTecleado}"`}
              </button>
            )
          })}
          {error && (
            <p className="border-t border-[#f0f0f0] px-3 py-2 text-xs text-[#cc3333]">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
