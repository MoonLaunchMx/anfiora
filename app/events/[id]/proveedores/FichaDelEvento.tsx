'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Globe, Mail, Star, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiInstagram } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget, SupplierPayment, SupplierStatus,
  SUPPLIER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS, PAID_BY_LABELS,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import { formatDisplay, toWhatsApp } from '@/lib/phone'
import { accionesDe, carpetasDe, type Accion } from '@/lib/rolodex/ficha-por-estado'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  bodaPaso: boolean
  onCerrar: () => void
  onAbrirCompleta: () => void
  onStatusChange: (itemId: string, nuevo: SupplierStatus) => void
}

const CHIP_ESTATUS: Record<SupplierStatus, string> = {
  nuevo:      'bg-[#f1efe8] text-[#5F5C57]',
  cotizado:   'bg-[#FBF3E0] text-[#A87C1F]',
  contratado: 'bg-[#E6F3EC] text-[#1D9E75]',
  descartado: 'bg-[#FAEAE6] text-[#A63B27]',
}

const ORDEN_CAMINO: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado']

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

export default function FichaDelEvento({
  item, budgets, currency, categorias, bodaPaso, onCerrar, onAbrirCompleta, onStatusChange,
}: Props) {
  const [pagos, setPagos] = useState<SupplierPayment[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(true)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [carpeta, setCarpeta] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const carpetas = useMemo(() => carpetasDe(item.status, bodaPaso), [item.status, bodaPaso])
  const acciones = useMemo(() => accionesDe(item.status, bodaPaso), [item.status, bodaPaso])

  useEffect(() => { setCarpeta(0) }, [item.id, item.status])

  useEffect(() => {
    let vigente = true
    setCargandoPagos(true)
    supabase
      .from('supplier_payments').select('*')
      .eq('event_supplier_id', item.id)
      .order('payment_date', { ascending: false })
      .then(({ data }) => {
        if (!vigente) return
        setPagos((data as SupplierPayment[]) ?? [])
        setCargandoPagos(false)
      })
    return () => { vigente = false }
  }, [item.id])

  useEffect(() => {
    if (!menuAbierto) return
    const alClicarFuera = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [menuAbierto])

  const s = item.supplier
  const categoria = nombrePorId(categorias, s.category_id)

  const telCrudo   = s.phone ? (s.phone.startsWith('+') ? s.phone : `${s.phone_country_code ?? '+52'} ${s.phone}`) : null
  const waDigitos  = telCrudo ? toWhatsApp(telCrudo) : null
  const telVisible = telCrudo ? formatDisplay(telCrudo) : null
  const igLink     = s.instagram ? `https://instagram.com/${s.instagram.replace('@', '')}` : null
  const webLink    = s.website ? (s.website.startsWith('http') ? s.website : `https://${s.website}`) : null

  const partida     = budgets.find(b => b.id === item.event_budget_id)
  const presupuesto = partida?.budget_amount ?? null
  const pagado      = pagos.reduce((suma, p) => suma + (p.amount || 0), 0)
  const contratado  = item.contract_amount ?? null
  const falta       = contratado ? Math.max(0, contratado - pagado) : null
  const avance      = contratado && contratado > 0 ? Math.min(100, Math.round((pagado / contratado) * 100)) : 0

  const abrir = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  const ejecutar = (accion: Accion) => {
    setMenuAbierto(false)
    if (accion.nuevoEstado) onStatusChange(item.id, accion.nuevoEstado)
    else onAbrirCompleta()
  }

  return (
    <motion.section
      key={item.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 0.9, 0.28, 1] }}
      className="flex min-h-0 flex-1 flex-col bg-[#f8f8f8]"
    >
      <header className="shrink-0 bg-white px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#f0e4c8] bg-[#fffbf0] text-[13px] font-bold text-[#b8912f]">
            {iniciales(s.name)}
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="truncate text-[17px] font-bold tracking-tight text-[#1D1E20]">{s.name}</h2>
            <p className="truncate text-xs text-[#999]">
              {[categoria, s.subcategory, s.city].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => setMenuAbierto(v => !v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${CHIP_ESTATUS[item.status]}`}
            >
              {SUPPLIER_STATUS_LABELS[item.status]}
              <ChevronDown size={12} className="opacity-70" />
            </button>

            {menuAbierto && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-56 flex-col gap-0.5 rounded-xl border border-[#e8e8e8] bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,.45)]">
                <p className="px-2.5 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-wider text-[#bbb]">
                  Qué puedes hacer
                </p>
                {acciones.map((accion, i) =>
                  accion.separador ? (
                    <span key={`sep-${i}`} className="mx-1.5 my-1 h-px bg-[#eee]" />
                  ) : (
                    <button
                      key={accion.texto}
                      onClick={() => ejecutar(accion)}
                      className={`rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                        accion.tono === 'principal' ? 'bg-[#48C9B0] text-white hover:bg-[#3aa896]'
                        : accion.tono === 'mala'    ? 'text-[#cc3333] hover:bg-[#fff5f5]'
                                                    : 'text-[#1D1E20] hover:bg-[#f6f6f6]'
                      }`}
                    >
                      {accion.texto}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <button
            onClick={onCerrar}
            aria-label="Cerrar ficha"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#999] transition hover:text-[#1D1E20]"
          >
            <X size={13} />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {waDigitos && (
            <button
              onClick={() => abrir(`https://wa.me/${waDigitos}`)}
              className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#3aa896]"
            >
              <FaWhatsapp size={13} /> WhatsApp
            </button>
          )}
          {s.email && (
            <button onClick={() => abrir(`mailto:${s.email}`)} aria-label="Enviar correo"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#1D1E20]">
              <Mail size={13} />
            </button>
          )}
          {igLink && (
            <button onClick={() => abrir(igLink)} aria-label="Abrir Instagram"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#1D1E20]">
              <FiInstagram size={13} />
            </button>
          )}
          {webLink && (
            <button onClick={() => abrir(webLink)} aria-label="Abrir sitio web"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#1D1E20]">
              <Globe size={13} />
            </button>
          )}

          <span className="ml-auto flex items-center gap-1.5" aria-hidden>
            {ORDEN_CAMINO.map((paso, i) => {
              const indiceActual = item.status === 'descartado' ? 2 : ORDEN_CAMINO.indexOf(item.status)
              const esAqui = item.status === 'descartado' ? i === 2 : i === indiceActual
              const hecho  = i < indiceActual
              return (
                <span
                  key={paso}
                  className={`h-1.5 w-1.5 rounded-full ${
                    esAqui
                      ? item.status === 'descartado'
                        ? 'bg-[#cc3333] ring-[3px] ring-[#cc3333]/20'
                        : 'bg-[#48C9B0] ring-[3px] ring-[#48C9B0]/25'
                      : hecho ? 'bg-[#c4c4c4]' : 'bg-[#e8e8e8]'
                  }`}
                />
              )
            })}
          </span>
        </div>
      </header>

      <div className="flex shrink-0 gap-[3px] px-4">
        {carpetas.map((nombre, i) => (
          <button
            key={nombre}
            onClick={() => setCarpeta(i)}
            className={`relative top-px flex items-center gap-1.5 rounded-t-[10px] border border-b-0 border-[#e4e1db] px-3.5 pb-2 pt-2 text-xs font-semibold transition ${
              i === carpeta ? 'bg-white pb-2.5 text-[#1D1E20]' : 'bg-[#efede8] text-[#8a8a8a] hover:text-[#5F5C57]'
            }`}
          >
            {nombre}
            {nombre === 'Pagos' && pagos.length > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${i === carpeta ? 'bg-[#f4f4f4] text-[#666]' : 'bg-white/70 text-[#777]'}`}>
                {pagos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-[#e4e1db] bg-white px-5 py-4">
        {carpetas[carpeta] === 'Contacto' && (
          <>
            <Bloque titulo="Cómo le hablas">
              <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                <Dato etiqueta="WhatsApp" valor={telVisible} />
                <Dato etiqueta="Correo" valor={s.email} />
                <Dato etiqueta="Instagram" valor={s.instagram} />
                <Dato etiqueta="Sitio" valor={s.website} />
                <Dato etiqueta="Persona de contacto" valor={s.contact_name} />
                <Dato etiqueta="Dónde" valor={[s.city, s.state_region].filter(Boolean).join(', ') || null} />
              </dl>
              <p className="mt-3 text-[11px] text-[#aaa]">
                Esto vive en tu Rolodex: si lo corriges, queda corregido en todas tus bodas.
              </p>
            </Bloque>

            <Bloque titulo="Notas de esta boda">
              <Texto valor={item.event_notes} vacio="Sin notas de esta boda." />
            </Bloque>

            <Bloque titulo="Notas del proveedor">
              <Texto valor={s.general_notes} vacio="Sin notas generales." />
            </Bloque>
          </>
        )}

        {carpetas[carpeta] === 'Cotización' && (
          <>
            <Bloque titulo="Los tres montos">
              <div className="overflow-hidden rounded-xl border border-[#e8e8e8]">
                <Renglon etiqueta="Presupuestado" valor={presupuesto} currency={currency} />
                <Renglon etiqueta="Cotizado" valor={item.quoted_amount} currency={currency} />
                <Renglon
                  etiqueta="Contratado"
                  valor={contratado}
                  currency={currency}
                  vacio="Sin contratar"
                  fuerte
                  color={contratado ? 'text-[#1D9E75]' : undefined}
                />
              </div>
              <Diferencia
                presupuesto={presupuesto}
                cotizado={item.quoted_amount}
                contratado={contratado}
                currency={currency}
              />
            </Bloque>

            {partida && (
              <Bloque titulo="Partida del presupuesto">
                <p className="text-sm text-[#1D1E20]">
                  {partida.subcategory || nombrePorId(categorias, partida.category_id)}
                </p>
              </Bloque>
            )}
          </>
        )}

        {carpetas[carpeta] === 'Pagos' && (
          <>
            <Bloque titulo="Lo que llevas">
              <div className="overflow-hidden rounded-xl border border-[#e8e8e8]">
                <Renglon etiqueta="Contratado" valor={contratado} currency={currency} />
                <Renglon etiqueta="Pagado" valor={cargandoPagos ? null : pagado} currency={currency} color="text-[#1D9E75]" />
                <Renglon etiqueta="Falta" valor={cargandoPagos ? null : falta} currency={currency} fuerte />
              </div>
              {contratado ? (
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
                  <div className="h-full rounded-full bg-[#1D9E75] transition-all duration-500" style={{ width: `${avance}%` }} />
                </div>
              ) : null}
            </Bloque>

            <Bloque titulo="Pagos registrados">
              {cargandoPagos ? (
                <div className="h-12 animate-pulse rounded-lg bg-[#f5f5f5]" />
              ) : pagos.length === 0 ? (
                <p className="text-xs text-[#999]">Todavía no le registras pagos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {pagos.map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-3 py-2">
                      <span className="min-w-0 text-xs text-[#666]">
                        <span className="block text-[#1D1E20]">
                          {new Date(p.payment_date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                        <span className="truncate">
                          {p.payment_method ? PAYMENT_METHOD_LABELS[p.payment_method] : 'Sin método'}
                          {p.paid_by ? ` · ${PAID_BY_LABELS[p.paid_by]}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[#1D1E20]">
                        {formatCurrency(p.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={onAbrirCompleta}
                className="mt-3 rounded-lg bg-[#48C9B0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
              >
                Registrar un pago
              </button>
            </Bloque>
          </>
        )}

        {carpetas[carpeta] === 'Reseña' && (
          <>
            <div className="rounded-xl border border-[#f0e4c8] bg-[#fffbf0] px-4 py-3 text-xs font-medium text-[#b8912f]">
              Esta boda ya pasó. ¿Cómo te fue con {s.name}?
            </div>
            <Bloque titulo="Tu calificación">
              {item.rating ? (
                <p className="flex items-center gap-1.5 text-sm text-[#1D1E20]">
                  <Star size={15} className="fill-[#48C9B0] text-[#48C9B0]" /> {item.rating}.0 de 5
                </p>
              ) : (
                <p className="text-xs text-[#999]">Todavía no lo calificas.</p>
              )}
            </Bloque>
            <Bloque titulo="Nota">
              <Texto valor={item.review_text} vacio="Sin nota de cómo te fue." />
            </Bloque>
            <button
              onClick={onAbrirCompleta}
              className="self-start rounded-lg bg-[#48C9B0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
            >
              {item.rating ? 'Cambiar la calificación' : 'Calificar'}
            </button>
          </>
        )}

        {carpetas[carpeta] === 'Motivo' && (
          <>
            <Bloque titulo="Por qué lo descartaste">
              <p className="text-xs text-[#999]">
                Todavía no se guarda el motivo del descarte. Es la columna que falta del spec.
              </p>
            </Bloque>
            <Bloque titulo="Notas de esta boda">
              <Texto valor={item.event_notes} vacio="Sin notas." />
            </Bloque>
            <p className="text-[11px] text-[#aaa]">Sin estrellas: nunca trabajaste con él, no hay nada que calificar.</p>
          </>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-[#e8e8e8] bg-[#fafafa] px-5 py-2.5">
        <button
          onClick={onAbrirCompleta}
          className="rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1E20] transition hover:bg-[#f5f5f5]"
        >
          Editar en el formulario completo
        </button>
      </footer>
    </motion.section>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#999]">{titulo}</h3>
      {children}
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#bbb]">{etiqueta}</dt>
      <dd className={`truncate text-[13px] ${valor ? 'text-[#1D1E20]' : 'text-[#ccc]'}`}>{valor || '—'}</dd>
    </div>
  )
}

function Texto({ valor, vacio }: { valor: string | null; vacio: string }) {
  if (!valor) return <p className="text-xs text-[#999]">{vacio}</p>
  return <p className="whitespace-pre-wrap text-sm text-[#555]">{valor}</p>
}

function Renglon({ etiqueta, valor, currency, vacio, fuerte, color }: {
  etiqueta: string
  valor: number | null
  currency: Currency
  vacio?: string
  fuerte?: boolean
  color?: string
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-b border-[#f2f2f2] px-3.5 py-2.5 last:border-b-0 ${fuerte ? 'bg-[#fafafa]' : ''}`}>
      <span className={`text-[13px] ${fuerte ? 'font-semibold text-[#1D1E20]' : 'text-[#666]'}`}>{etiqueta}</span>
      <span className={`text-[15px] font-bold tabular-nums ${valor == null ? 'text-[#ccc]' : color ?? 'text-[#1D1E20]'}`}>
        {valor == null ? (vacio ?? '—') : formatCurrency(valor, currency)}
      </span>
    </div>
  )
}

function Diferencia({ presupuesto, cotizado, contratado, currency }: {
  presupuesto: number | null
  cotizado: number | null
  contratado: number | null
  currency: Currency
}) {
  if (contratado != null && cotizado != null && contratado < cotizado) {
    return (
      <p className="mt-2 text-xs font-semibold text-emerald-600">
        Le bajaste {formatCurrency(cotizado - contratado, currency)} del cotizado al contratado
      </p>
    )
  }
  const contra = contratado ?? cotizado
  if (presupuesto != null && contra != null && contra > presupuesto) {
    return (
      <p className="mt-2 text-xs font-semibold text-red-500">
        Se pasa {formatCurrency(contra - presupuesto, currency)} de lo presupuestado
      </p>
    )
  }
  if (presupuesto != null && contra != null && contra < presupuesto) {
    return (
      <p className="mt-2 text-xs font-semibold text-emerald-600">
        Queda {formatCurrency(presupuesto - contra, currency)} debajo del presupuesto
      </p>
    )
  }
  return null
}
