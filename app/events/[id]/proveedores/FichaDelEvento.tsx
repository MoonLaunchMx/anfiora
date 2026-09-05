'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Mail, MapPin, Pencil, Star, User, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiInstagram } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget, SupplierPayment,
  SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS, PAID_BY_LABELS,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import { formatDisplay, toWhatsApp } from '@/lib/phone'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  onCerrar: () => void
  onAbrirCompleta: () => void
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

export default function FichaDelEvento({ item, budgets, currency, categorias, onCerrar, onAbrirCompleta }: Props) {
  const [pagos, setPagos] = useState<SupplierPayment[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(true)

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

  const s = item.supplier
  const categoria = nombrePorId(categorias, s.category_id)

  const telCrudo   = s.phone ? (s.phone.startsWith('+') ? s.phone : `${s.phone_country_code ?? '+52'} ${s.phone}`) : null
  const waDigitos  = telCrudo ? toWhatsApp(telCrudo) : null
  const telVisible = telCrudo ? formatDisplay(telCrudo) : null
  const igLink     = s.instagram ? `https://instagram.com/${s.instagram.replace('@', '')}` : null
  const webLink    = s.website ? (s.website.startsWith('http') ? s.website : `https://${s.website}`) : null

  const partida    = budgets.find(b => b.id === item.event_budget_id)
  const presupuesto = partida?.budget_amount ?? null
  const pagado      = pagos.reduce((suma, p) => suma + (p.amount || 0), 0)
  const contratado  = item.contract_amount ?? null
  const avance      = contratado && contratado > 0 ? Math.min(100, Math.round((pagado / contratado) * 100)) : 0

  const abrir = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  return (
    <motion.section
      key={item.id}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 0.9, 0.28, 1] }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-[#e8e8e8] px-6 py-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#f0e4c8] bg-[#fffbf0] text-sm font-bold text-[#b8912f]">
          {iniciales(s.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-[#1D1E20]">{s.name}</h2>
          <p className="truncate text-xs text-[#888]">
            {categoria}{s.subcategory ? ` · ${s.subcategory}` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${SUPPLIER_STATUS_COLORS[item.status]}`}>
              {SUPPLIER_STATUS_LABELS[item.status]}
            </span>
            {item.rating ? (
              <span className="flex items-center gap-1 text-xs text-[#666]">
                <Star size={12} className="fill-[#48C9B0] text-[#48C9B0]" />{item.rating}.0
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={onCerrar}
          aria-label="Cerrar ficha"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[#888] transition hover:text-[#1D1E20]"
        >
          <X size={15} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#888]">Contacto</h3>
          <div className="flex flex-wrap gap-2">
            {waDigitos && (
              <button onClick={() => abrir(`https://wa.me/${waDigitos}`)}
                className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]">
                <FaWhatsapp size={14} /> {telVisible}
              </button>
            )}
            {s.email && (
              <button onClick={() => abrir(`mailto:${s.email}`)}
                className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1E20] transition hover:bg-[#f5f5f5]">
                <Mail size={14} className="text-[#888]" /> {s.email}
              </button>
            )}
            {igLink && (
              <button onClick={() => abrir(igLink)}
                className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1E20] transition hover:bg-[#f5f5f5]">
                <FiInstagram size={14} className="text-[#888]" /> {s.instagram}
              </button>
            )}
            {webLink && (
              <button onClick={() => abrir(webLink)}
                className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1E20] transition hover:bg-[#f5f5f5]">
                <Globe size={14} className="text-[#888]" /> {s.website}
              </button>
            )}
          </div>
          {(s.contact_name || s.city) && (
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#666]">
              {s.contact_name && <span className="flex items-center gap-1.5"><User size={12} className="text-[#aaa]" />{s.contact_name}</span>}
              {s.city && <span className="flex items-center gap-1.5"><MapPin size={12} className="text-[#aaa]" />{[s.city, s.state_region].filter(Boolean).join(', ')}</span>}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#888]">En esta boda</h3>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#e8e8e8] bg-[#e8e8e8]">
            <Monto label="Presupuestado" valor={presupuesto} currency={currency} />
            <Monto label="Cotizado"      valor={item.quoted_amount} currency={currency} />
            <Monto label="Contratado"    valor={contratado} currency={currency} color="text-[#1D9E75]" />
            <Monto label="Pagado"        valor={cargandoPagos ? null : pagado} currency={currency} />
          </div>

          {contratado ? (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
                <div className="h-full rounded-full bg-[#1D9E75] transition-all duration-500" style={{ width: `${avance}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-[#999]">
                {avance}% pagado · faltan {formatCurrency(Math.max(0, contratado - pagado), currency)}
              </p>
            </div>
          ) : null}

          {partida && (
            <p className="mt-2 text-xs text-[#888]">
              Ligado a la partida <span className="font-medium text-[#1D1E20]">{partida.subcategory || nombrePorId(categorias, partida.category_id)}</span>
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#888]">Pagos</h3>
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
        </section>

        {item.event_notes && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#888]">Notas de esta boda</h3>
            <p className="whitespace-pre-wrap text-sm text-[#555]">{item.event_notes}</p>
          </section>
        )}

        {s.general_notes && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#888]">Notas del proveedor</h3>
            <p className="whitespace-pre-wrap text-sm text-[#555]">{s.general_notes}</p>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-[#e8e8e8] bg-[#fafafa] px-6 py-3">
        <button
          onClick={onAbrirCompleta}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
        >
          <Pencil size={13} /> Editar y registrar pagos
        </button>
      </footer>
    </motion.section>
  )
}

function Monto({ label, valor, currency, color }: {
  label: string
  valor: number | null
  currency: Currency
  color?: string
}) {
  return (
    <div className="bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${valor == null ? 'text-[#ccc]' : color ?? 'text-[#1D1E20]'}`}>
        {valor == null ? '—' : formatCurrency(valor, currency)}
      </p>
    </div>
  )
}
