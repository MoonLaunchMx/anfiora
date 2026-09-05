'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Globe, Mail, MapPin, Phone, Star } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiInstagram } from 'react-icons/fi'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget,
  SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import FichaDelEvento from './FichaDelEvento'
import { formatDisplay, toWhatsApp } from '@/lib/phone'
import {
  desplazamientoFicha, escalaFicha, indiceAlSoltar, indicePrimeraLetra, letraDe,
  moverIndice, ordenarFichas, puedeAvanzar, veloFicha,
} from '@/lib/rolodex/fichero'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  onSelect: (item: SupplierWithDetails) => void
}

// Una ficha no se encima sobre la de enfrente mientras se cumpla
// RADIO*sin(PASO) >= alto*(1+cos(PASO))/2 — con el alto de movil, que es el mayor:
// 540*sin26 = 236 >= 105*(1+cos26) = 199. Para pegarlas mas hay que bajar el paso
// y subir el radio a la vez, nunca solo el paso, o los planos se cruzan y la de
// atras tapa la mitad de abajo de la del frente. La perspectiva acompana al radio
// para que la ficha del frente no cambie de tamano.
const PASO_ESCRITORIO   = 26
const RADIO_ESCRITORIO  = 540
const PASO_MOVIL        = 24
const RADIO_MOVIL       = 400
const FICHAS_VISIBLES   = 3
const PIXELES_POR_FICHA = 62
const MS_ENTRE_GIROS    = 190
const ARRASTRE_MINIMO   = 0.08

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function useEsEscritorio(): boolean {
  const [esEscritorio, setEsEscritorio] = useState(false)
  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 1024px)')
    const aplicar = () => setEsEscritorio(consulta.matches)
    aplicar()
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [])
  return esEscritorio
}

export default function SupplierFicheroView({ items, budgets, currency, categorias, onSelect }: Props) {
  const esEscritorio = useEsEscritorio()
  const [abierta, setAbierta] = useState<SupplierWithDetails | null>(null)
  const fichas = useMemo(() => ordenarFichas(items), [items])
  const total  = fichas.length

  const [activo, setActivo] = useState(0)
  const [arrastre, setArrastre] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)

  const [vuelo, setVuelo] = useState<{ item: SupplierWithDetails; desde: DOMRect; hacia: DOMRect } | null>(null)
  const [enDestino, setEnDestino] = useState(false)

  const escenarioRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const ultimoGiroRef = useRef(0)
  const arrastreRef = useRef({ activo: false, y0: 0, base: 0, movio: false })

  // Al filtrar o buscar cambia el conjunto de fichas y el indice viejo apuntaria
  // a otro proveedor: se vuelve a la primera. Editar una ficha no cambia la lista.
  const claveDelConjunto = useMemo(() => fichas.map(f => f.id).join(','), [fichas])
  useEffect(() => { setActivo(0) }, [claveDelConjunto])

  // Si la ficha abierta se cae del filtro, el panel se queda mostrando algo que
  // ya no esta en el fichero.
  useEffect(() => {
    setAbierta(previa => (previa && fichas.some(f => f.id === previa.id) ? fichas.find(f => f.id === previa.id)! : null))
  }, [fichas])

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

  const abrirFicha = (item: SupplierWithDetails) => {
    if (!esEscritorio) { onSelect(item); return }

    const tarjeta = escenarioRef.current?.querySelector('[data-frente="1"]')
    const panel = panelRef.current
    const sinAnimacion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!tarjeta || !panel || sinAnimacion) { setAbierta(item); return }

    setEnDestino(false)
    setVuelo({ item, desde: tarjeta.getBoundingClientRect(), hacia: panel.getBoundingClientRect() })
  }

  // El vuelo es puro adorno: si algo falla, la ficha abre igual al terminar.
  useEffect(() => {
    if (!vuelo) return
    const cuadro = requestAnimationFrame(() => setEnDestino(true))
    const aterriza = setTimeout(() => { setAbierta(vuelo.item); setVuelo(null) }, 440)
    return () => { cancelAnimationFrame(cuadro); clearTimeout(aterriza) }
  }, [vuelo])

  // Sin esto, soltar el arrastre encima de una ficha abre su modal.
  const alClicarFicha = (indice: number) => {
    if (arrastreRef.current.movio) {
      arrastreRef.current.movio = false
      return
    }
    if (indice === activo) abrirFicha(fichas[indice])
    else setActivo(indice)
  }

  const alTeclear = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); girar(1) }
    if (e.key === 'ArrowUp'   || e.key === 'PageUp')   { e.preventDefault(); girar(-1) }
    if (e.key === 'Home') { e.preventDefault(); setActivo(0) }
    if (e.key === 'End')  { e.preventDefault(); setActivo(Math.max(0, total - 1)) }
    if ((e.key === 'Enter' || e.key === ' ') && fichas[activo]) {
      e.preventDefault()
      abrirFicha(fichas[activo])
    }
  }

  const porLetra = useMemo(() => indicePrimeraLetra(fichas), [fichas])
  const alFrente = moverIndice(Math.round(activo + arrastre), 0, total)
  const letraActiva = fichas[alFrente] ? letraDe(fichas[alFrente].supplier.name) : ''

  if (total === 0) return null

  return (
    <div className="flex h-full min-h-0">

      <div ref={panelRef} className="hidden min-h-0 flex-1 lg:flex">
      {abierta ? (
        <div className="flex min-h-0 flex-1">
          <FichaDelEvento
            item={abierta}
            budgets={budgets}
            currency={currency}
            categorias={categorias}
            onCerrar={() => setAbierta(null)}
            onAbrirCompleta={() => onSelect(abierta)}
          />
        </div>
      ) : (
        <ResumenDeLaBoda items={fichas} currency={currency} />
      )}
      </div>

      <div className="flex h-full min-h-0 w-full flex-col lg:w-[40%] lg:shrink-0 lg:border-l lg:border-[#e8e8e8]">
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
          className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden bg-white pr-7 outline-none [perspective:2400px] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#48C9B0]"
          style={{ cursor: arrastrando ? 'grabbing' : 'grab' }}
        >
          <button
            type="button"
            onClick={() => girar(-1)}
            disabled={activo === 0}
            aria-label="Ficha anterior"
            className="absolute left-1/2 top-2 z-20 flex h-7 w-9 -translate-x-1/2 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#666] transition hover:text-[#1D1E20] disabled:opacity-30"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => girar(1)}
            disabled={activo >= total - 1}
            aria-label="Ficha siguiente"
            className="absolute bottom-2 left-1/2 z-20 flex h-7 w-9 -translate-x-1/2 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#666] transition hover:text-[#1D1E20] disabled:opacity-30"
          >
            <ChevronDown size={16} />
          </button>

          <div className="absolute inset-y-3 right-0.5 z-20 flex flex-col justify-center">
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
                  className={`flex max-h-4 min-h-0 w-5 flex-1 items-center justify-center rounded text-[10px] font-bold leading-none transition ${
                    letra === letraActiva ? 'bg-[#48C9B0] text-white'
                    : hay                 ? 'text-[#8a8a8a] hover:bg-[#f5f5f5]'
                                          : 'text-[#dcdcdc]'
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
                  paso={esEscritorio ? PASO_ESCRITORIO : PASO_MOVIL}
                  radio={esEscritorio ? RADIO_ESCRITORIO : RADIO_MOVIL}
                  item={item}
                  budgets={budgets}
                  currency={currency}
                  categorias={categorias}
                  activa={i === alFrente}
                  arrastrando={arrastrando}
                  desplazamiento={off}
                  onClick={() => alClicarFicha(i)}
                  onAbrir={() => abrirFicha(item)}
                />
              )
            })}
          </div>
        </div>

        {vuelo && (
          <div
            aria-hidden
            style={{
              left:   enDestino ? vuelo.hacia.left + 24 : vuelo.desde.left,
              top:    enDestino ? vuelo.hacia.top + 16  : vuelo.desde.top,
              width:  enDestino ? vuelo.hacia.width - 48 : vuelo.desde.width,
              height: enDestino ? 96 : vuelo.desde.height,
              opacity: enDestino ? 0 : 1,
              transition: 'left .44s cubic-bezier(.3,.85,.3,1), top .44s cubic-bezier(.3,.85,.3,1), width .44s cubic-bezier(.3,.85,.3,1), height .44s cubic-bezier(.3,.85,.3,1), opacity .18s ease .3s',
            }}
            className="pointer-events-none fixed z-50 overflow-hidden rounded-2xl border border-[#dcd7cd] bg-white p-4 shadow-[0_26px_54px_-20px_rgba(0,0,0,.42)]"
          >
            <p className="truncate text-[15px] font-semibold leading-tight text-[#1D1E20]">{vuelo.item.supplier.name}</p>
            <p className="mt-0.5 truncate text-xs text-[#888]">{nombrePorId(categorias, vuelo.item.supplier.category_id)}</p>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between border-t border-[#f0f0f0] px-4 py-2 text-[11px] text-[#999]">
          <span className="hidden sm:inline">Rueda, arrastra o usa las flechas</span>
          <span className="sm:hidden">Desliza para pasar · toca para abrir</span>
          <span aria-live="polite" className="tabular-nums">{alFrente + 1} de {total}</span>
        </div>
      </div>
    </div>
  )
}

function ResumenDeLaBoda({ items, currency }: { items: SupplierWithDetails[]; currency: Currency }) {
  const nuevos      = items.filter(i => i.status === 'nuevo').length
  const cotizando   = items.filter(i => i.status === 'cotizado').length
  const contratados = items.filter(i => i.status === 'contratado').length
  const inversion   = items
    .filter(i => i.status === 'contratado')
    .reduce((suma, i) => suma + (i.contract_amount || 0), 0)

  return (
    <aside className="hidden min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 lg:flex">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#888]">Esta boda</h2>

      <div className="grid grid-cols-2 gap-3">
        <Numero label="Nuevos"      valor={nuevos.toString()} />
        <Numero label="Cotizando"   valor={cotizando.toString()} />
        <Numero label="Contratados" valor={contratados.toString()} destacado />
        <Numero label="Inversión"   valor={formatCurrency(inversion, currency)} chico />
      </div>

      <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] px-4 py-3 text-xs text-[#999]">
        Hojea el fichero de la derecha. Pícale a una ficha para abrir su detalle.
      </div>
    </aside>
  )
}

function Numero({ label, valor, destacado, chico }: {
  label: string
  valor: string
  destacado?: boolean
  chico?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">{label}</p>
      <p className={`mt-1.5 font-bold tabular-nums ${chico ? 'text-lg' : 'text-2xl'} ${
        destacado ? 'text-[#1D9E75]' : 'text-[#1D1E20]'
      }`}>
        {valor}
      </p>
    </div>
  )
}

function Ficha({ item, budgets, currency, categorias, activa, arrastrando, desplazamiento, paso, radio, onClick, onAbrir }: {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  activa: boolean
  arrastrando: boolean
  desplazamiento: number
  paso: number
  radio: number
  onClick: () => void
  onAbrir: () => void
}) {
  const s = item.supplier
  const categoria = nombrePorId(categorias, s.category_id)

  const telCrudo   = s.phone ? (s.phone.startsWith('+') ? s.phone : `${s.phone_country_code ?? '+52'} ${s.phone}`) : null
  const waDigitos  = telCrudo ? toWhatsApp(telCrudo) : null
  const telVisible = telCrudo ? formatDisplay(telCrudo) : null

  const igLink     = s.instagram ? `https://instagram.com/${s.instagram.replace('@', '')}` : null
  const webLink    = s.website ? (s.website.startsWith('http') ? s.website : `https://${s.website}`) : null

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
      data-frente={activa ? '1' : undefined}
      onClick={onClick}
      style={{
        transform: `translate(-50%, -50%) rotateX(${-desplazamiento * paso}deg) translateZ(${radio}px) scale(${escalaFicha(desplazamiento)})`,
        zIndex: 100 - Math.round(Math.abs(desplazamiento)),
        pointerEvents: Math.abs(desplazamiento) > 2 ? 'none' : 'auto',
        transition: arrastrando
          ? 'none'
          : 'transform .42s cubic-bezier(.22,.9,.28,1), box-shadow .3s ease',
      }}
      className={`absolute left-1/2 top-1/2 flex h-[150px] w-[86%] max-w-[420px] cursor-pointer flex-col rounded-2xl border bg-white p-3.5 [backface-visibility:hidden] lg:h-[224px] lg:p-5 ${
        activa
          ? 'border-[#dcd7cd] shadow-[0_26px_54px_-20px_rgba(0,0,0,.42)] ring-1 ring-black/5'
          : 'border-[#ececec] shadow-[0_8px_20px_-14px_rgba(0,0,0,.24)]'
      }`}
    >
      <span aria-hidden className="absolute -left-px top-1/2 h-9 w-4 -translate-y-1/2 rounded-r-full border border-l-0 border-[#e8e8e8] bg-white" />
      <span aria-hidden className="absolute -right-px top-1/2 h-9 w-4 -translate-y-1/2 rounded-l-full border border-r-0 border-[#e8e8e8] bg-white" />

      <div className="flex h-full flex-col gap-2 lg:hidden">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-[#1D1E20]">{s.name}</h3>
            <p className="mt-0.5 truncate text-[11px] text-[#888]">
              {categoria}{s.city ? ` · ${s.city}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${SUPPLIER_STATUS_COLORS[item.status]}`}>
            {SUPPLIER_STATUS_LABELS[item.status]}
          </span>
        </div>

        <div className="mt-auto flex gap-6 border-t border-[#f0f0f0] pt-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa]">Cotizado</p>
            <p className={`text-[13px] font-bold tabular-nums ${item.quoted_amount == null ? 'text-[#ccc]' : 'text-[#1D1E20]'}`}>
              {item.quoted_amount == null ? '—' : formatCurrency(item.quoted_amount, currency)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#aaa]">Contratado</p>
            <p className={`text-[13px] font-bold tabular-nums ${item.contract_amount == null ? 'text-[#ccc]' : 'text-[#1D9E75]'}`}>
              {item.contract_amount == null ? '—' : formatCurrency(item.contract_amount, currency)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {waDigitos && (
            <button
              aria-label="Abrir WhatsApp"
              onClick={e => abrirEnlace(e, `https://wa.me/${waDigitos}`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#48C9B0] text-white transition hover:bg-[#3aa896]"
            >
              <FaWhatsapp size={15} />
            </button>
          )}
          {s.email && (
            <button
              aria-label="Enviar correo"
              onClick={e => abrirEnlace(e, `mailto:${s.email}`)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#666] transition hover:bg-[#f5f5f5]"
            >
              <Mail size={15} />
            </button>
          )}
          {igLink && (
            <button
              aria-label="Abrir Instagram"
              onClick={e => abrirEnlace(e, igLink)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#666] transition hover:bg-[#f5f5f5]"
            >
              <FiInstagram size={15} />
            </button>
          )}
          {webLink && (
            <button
              aria-label="Abrir sitio web"
              onClick={e => abrirEnlace(e, webLink)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#666] transition hover:bg-[#f5f5f5]"
            >
              <Globe size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="hidden h-full flex-col lg:flex">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-[#1D1E20] sm:text-[17px]">{s.name}</h3>
            <p className="mt-0.5 truncate text-xs text-[#888]">
              {categoria}{s.subcategory ? ` · ${s.subcategory}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold sm:text-[11px] ${SUPPLIER_STATUS_COLORS[item.status]}`}>
            {SUPPLIER_STATUS_LABELS[item.status]}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#666] sm:text-xs">
          {s.city && (
            <span className="flex min-w-0 items-center gap-1.5"><MapPin size={12} className="shrink-0 text-[#aaa]" /><span className="truncate">{s.city}</span></span>
          )}
          {telVisible && (
            <span className="flex items-center gap-1.5"><Phone size={12} className="shrink-0 text-[#aaa]" />{telVisible}</span>
          )}
          {item.rating ? (
            <span className="flex items-center gap-1.5">
              <Star size={12} className="shrink-0 fill-[#48C9B0] text-[#48C9B0]" />{item.rating}.0
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-x-4 border-t border-[#f0f0f0] pt-2.5">
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
          <p className={`mt-1 truncate text-[11px] font-medium ${excede ? 'text-red-500' : 'text-emerald-600'}`}>
            {excede
              ? `Excede por ${formatCurrency(contraMeta - meta, currency)}`
              : `Ahorro de ${formatCurrency(meta - contraMeta, currency)}`}
          </p>
        )}

        {activa && (
          <div className="mt-auto flex flex-wrap gap-2 pt-2.5">
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

      </div>

      <span
        aria-hidden
        style={{ opacity: veloFicha(desplazamiento), transition: arrastrando ? 'none' : 'opacity .42s ease' }}
        className="pointer-events-none absolute inset-0 rounded-2xl bg-white"
      />
    </article>
  )
}
