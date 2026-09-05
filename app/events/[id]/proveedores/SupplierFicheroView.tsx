'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Mail, MapPin, Phone, Star } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget,
  SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import { formatDisplay, toWhatsApp } from '@/lib/phone'
import {
  brilloFicha, desplazamientoFicha, escalaFicha, indiceAlSoltar, indicePrimeraLetra, letraDe,
  moverIndice, opacidadFicha, ordenarFichas, puedeAvanzar,
} from '@/lib/rolodex/fichero'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  onSelect: (item: SupplierWithDetails) => void
}

const PASO_GRADOS       = 17
const RADIO_PX          = 340
const FICHAS_VISIBLES   = 3
const PIXELES_POR_FICHA = 62
const MS_ENTRE_GIROS    = 190
const ARRASTRE_MINIMO   = 0.08

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function SupplierFicheroView({ items, budgets, currency, categorias, onSelect }: Props) {
  const fichas = useMemo(() => ordenarFichas(items), [items])
  const total  = fichas.length

  const [activo, setActivo] = useState(0)
  const [arrastre, setArrastre] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)

  const escenarioRef = useRef<HTMLDivElement>(null)
  const ultimoGiroRef = useRef(0)
  const arrastreRef = useRef({ activo: false, y0: 0, base: 0, movio: false })

  // Al filtrar o buscar cambia el conjunto de fichas y el indice viejo apuntaria
  // a otro proveedor: se vuelve a la primera. Editar una ficha no cambia la lista.
  const claveDelConjunto = useMemo(() => fichas.map(f => f.id).join(','), [fichas])
  useEffect(() => { setActivo(0) }, [claveDelConjunto])

  const girar = useCallback((delta: number) => {
    setActivo(a => moverIndice(a, delta, total))
  }, [total])

  // La rueda solo se queda el scroll mientras el fichero pueda girar; en la primera
  // y la ultima ficha se lo devuelve a la pagina.
  useEffect(() => {
    const el = escenarioRef.current
    if (!el) return

    const alGirarRueda = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 4) return
      const delta = e.deltaY > 0 ? 1 : -1
      if (!puedeAvanzar(activo, delta, total)) return
      e.preventDefault()
      const ahora = Date.now()
      if (ahora - ultimoGiroRef.current < MS_ENTRE_GIROS) return
      ultimoGiroRef.current = ahora
      girar(delta)
    }

    el.addEventListener('wheel', alGirarRueda, { passive: false })
    return () => el.removeEventListener('wheel', alGirarRueda)
  }, [activo, total, girar])

  const alPresionar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (total < 2) return
    arrastreRef.current = { activo: true, y0: e.clientY, base: activo, movio: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setArrastrando(true)
  }

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastreRef.current.activo) return
    const crudo = (arrastreRef.current.y0 - e.clientY) / PIXELES_POR_FICHA
    const base  = arrastreRef.current.base
    if (Math.abs(crudo) > ARRASTRE_MINIMO) arrastreRef.current.movio = true
    setArrastre(Math.min(Math.max(crudo, -base), total - 1 - base))
  }

  const alSoltar = () => {
    if (!arrastreRef.current.activo) return
    arrastreRef.current.activo = false
    setActivo(a => indiceAlSoltar(a, arrastre, total))
    setArrastre(0)
    setArrastrando(false)
  }

  // Sin esto, soltar el arrastre encima de una ficha abre su modal.
  const alClicarFicha = (indice: number) => {
    if (arrastreRef.current.movio) {
      arrastreRef.current.movio = false
      return
    }
    if (indice === activo) onSelect(fichas[indice])
    else setActivo(indice)
  }

  const alTeclear = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); girar(1) }
    if (e.key === 'ArrowUp'   || e.key === 'PageUp')   { e.preventDefault(); girar(-1) }
    if (e.key === 'Home') { e.preventDefault(); setActivo(0) }
    if (e.key === 'End')  { e.preventDefault(); setActivo(Math.max(0, total - 1)) }
    if ((e.key === 'Enter' || e.key === ' ') && fichas[activo]) {
      e.preventDefault()
      onSelect(fichas[activo])
    }
  }

  const porLetra = useMemo(() => indicePrimeraLetra(fichas), [fichas])
  const alFrente = moverIndice(Math.round(activo + arrastre), 0, total)
  const letraActiva = fichas[alFrente] ? letraDe(fichas[alFrente].supplier.name) : ''

  if (total === 0) return null

  return (
    <div className="pb-4">
      <div
        ref={escenarioRef}
        tabIndex={0}
        role="group"
        aria-label="Fichero de proveedores"
        onKeyDown={alTeclear}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        className="relative flex h-[420px] touch-none select-none items-center justify-center rounded-2xl bg-[#f8f5f0] outline-none [perspective:1500px] focus-visible:ring-2 focus-visible:ring-[#48C9B0] sm:h-[460px]"
        style={{ cursor: arrastrando ? 'grabbing' : 'grab' }}
      >
        <button
          type="button"
          onClick={() => girar(-1)}
          disabled={activo === 0}
          aria-label="Ficha anterior"
          className="absolute left-1/2 top-2 z-20 flex h-7 w-9 -translate-x-1/2 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#666] transition hover:text-[#1D1E20] disabled:opacity-35"
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          onClick={() => girar(1)}
          disabled={activo >= total - 1}
          aria-label="Ficha siguiente"
          className="absolute bottom-2 left-1/2 z-20 flex h-7 w-9 -translate-x-1/2 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#666] transition hover:text-[#1D1E20] disabled:opacity-35"
        >
          <ChevronDown size={16} />
        </button>

        <div className="absolute right-1.5 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-px">
          {ALFABETO.map(letra => {
            const indice = porLetra[letra]
            const hay = indice !== undefined
            return (
              <button
                key={letra}
                type="button"
                disabled={!hay}
                onClick={() => setActivo(indice)}
                aria-label={`Ir a la letra ${letra}`}
                className={`h-4 w-5 rounded text-[10px] font-bold leading-4 transition ${
                  letra === letraActiva ? 'bg-[#48C9B0] text-white'
                  : hay                 ? 'text-[#7a7a7a] hover:bg-white'
                                        : 'text-[#d4d0c8]'
                }`}
              >
                {letra}
              </button>
            )
          })}
        </div>

        <div className="absolute inset-0 [transform-style:preserve-3d]">
          {fichas.map((item, i) => {
            const off = desplazamientoFicha(i, activo, arrastre)
            if (Math.abs(off) > FICHAS_VISIBLES) return null

            return (
              <Ficha
                key={item.id}
                item={item}
                budgets={budgets}
                currency={currency}
                categorias={categorias}
                activa={i === alFrente}
                arrastrando={arrastrando}
                desplazamiento={off}
                onClick={() => alClicarFicha(i)}
                onAbrir={() => onSelect(item)}
              />
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-xs text-[#999]">
        <span className="hidden sm:inline">Rueda del mouse, arrastra la ficha o usa las flechas del teclado</span>
        <span className="sm:hidden">Desliza para pasar las fichas</span>
        <span aria-live="polite" className="tabular-nums">
          {alFrente + 1} de {total}
        </span>
      </div>
    </div>
  )
}

function Ficha({ item, budgets, currency, categorias, activa, arrastrando, desplazamiento, onClick, onAbrir }: {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  activa: boolean
  arrastrando: boolean
  desplazamiento: number
  onClick: () => void
  onAbrir: () => void
}) {
  const s = item.supplier
  const categoria = nombrePorId(categorias, s.category_id)

  const telCrudo   = s.phone ? (s.phone.startsWith('+') ? s.phone : `${s.phone_country_code ?? '+52'} ${s.phone}`) : null
  const waDigitos  = telCrudo ? toWhatsApp(telCrudo) : null
  const telVisible = telCrudo ? formatDisplay(telCrudo) : null

  const partida    = budgets.find(b => b.id === item.event_budget_id)
  const meta       = partida?.budget_amount ?? null
  const contraMeta = item.contract_amount ?? item.quoted_amount ?? null
  const excede     = meta !== null && contraMeta !== null && contraMeta > meta
  const ahorra     = meta !== null && contraMeta !== null && contraMeta < meta

  const abrirEnlace = (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <article
      aria-hidden={!activa}
      onClick={onClick}
      style={{
        transform: `translate(-50%, -50%) rotateX(${-desplazamiento * PASO_GRADOS}deg) translateZ(${RADIO_PX}px) scale(${escalaFicha(desplazamiento)})`,
        opacity: opacidadFicha(desplazamiento),
        filter: `brightness(${brilloFicha(desplazamiento)})`,
        zIndex: 100 - Math.round(Math.abs(desplazamiento)),
        pointerEvents: Math.abs(desplazamiento) > 2 ? 'none' : 'auto',
        transition: arrastrando
          ? 'none'
          : 'transform .42s cubic-bezier(.22,.9,.28,1), opacity .42s ease, filter .42s ease, box-shadow .3s ease',
      }}
      className={`absolute left-1/2 top-1/2 h-[236px] w-[min(88vw,430px)] cursor-pointer rounded-2xl border bg-white p-4 [backface-visibility:hidden] sm:h-[224px] sm:p-5 ${
        activa
          ? 'border-[#dcd7cd] shadow-[0_26px_54px_-20px_rgba(0,0,0,.42)] ring-1 ring-black/5'
          : 'border-[#ececec] shadow-[0_8px_20px_-14px_rgba(0,0,0,.24)]'
      }`}
    >
      <span aria-hidden className="absolute -left-px top-1/2 h-9 w-4 -translate-y-1/2 rounded-r-full border border-l-0 border-[#e8e8e8] bg-[#f8f5f0]" />
      <span aria-hidden className="absolute -right-px top-1/2 h-9 w-4 -translate-y-1/2 rounded-l-full border border-r-0 border-[#e8e8e8] bg-[#f8f5f0]" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-tight text-[#1D1E20] sm:text-[17px]">{s.name}</h3>
          <p className="mt-0.5 truncate text-xs text-[#888]">
            {categoria}{s.subcategory ? ` · ${s.subcategory}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${SUPPLIER_STATUS_COLORS[item.status]}`}>
          {SUPPLIER_STATUS_LABELS[item.status]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666]">
        {s.city && (
          <span className="flex items-center gap-1.5"><MapPin size={13} className="text-[#aaa]" />{s.city}</span>
        )}
        {telVisible && (
          <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#aaa]" />{telVisible}</span>
        )}
        {item.rating ? (
          <span className="flex items-center gap-1.5">
            <Star size={13} className="fill-[#48C9B0] text-[#48C9B0]" />{item.rating}.0
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 border-t border-[#f0f0f0] pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#aaa]">Cotizado</p>
          <p className={`text-sm font-semibold tabular-nums ${item.quoted_amount == null ? 'text-[#ccc]' : 'text-[#1D1E20]'}`}>
            {item.quoted_amount == null ? '—' : formatCurrency(item.quoted_amount, currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#aaa]">Contratado</p>
          <p className={`text-sm font-semibold tabular-nums ${item.contract_amount == null ? 'text-[#ccc]' : 'text-[#1D9E75]'}`}>
            {item.contract_amount == null ? '—' : formatCurrency(item.contract_amount, currency)}
          </p>
        </div>
      </div>

      {meta !== null && contraMeta !== null && (excede || ahorra) && (
        <p className={`mt-1.5 text-[11px] font-medium ${excede ? 'text-red-500' : 'text-emerald-600'}`}>
          {excede
            ? `Excede el presupuesto por ${formatCurrency(contraMeta - meta, currency)}`
            : `Ahorro de ${formatCurrency(meta - contraMeta, currency)}`}
        </p>
      )}

      {activa && (
        <div className="mt-3 flex flex-wrap gap-2">
          {waDigitos && (
            <button
              onClick={e => abrirEnlace(e, `https://wa.me/${waDigitos}`)}
              className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
            >
              <FaWhatsapp size={14} /> WhatsApp
            </button>
          )}
          {s.email && (
            <button
              onClick={e => abrirEnlace(e, `mailto:${s.email}`)}
              className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1E20] transition hover:bg-[#f5f5f5]"
            >
              <Mail size={14} /> Correo
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onAbrir() }}
            className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1E20] transition hover:bg-[#f5f5f5]"
          >
            <ExternalLink size={14} /> Ver ficha
          </button>
        </div>
      )}
    </article>
  )
}
