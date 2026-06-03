'use client'

import { Mail, Globe } from 'lucide-react'
import {
  Currency, formatCurrency, BUDGET_CATEGORY_LABELS, budgetCategoryLabel,
  EventSupplier, Supplier, EventBudget,
  SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'
import { FiInstagram } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'

type SupplierWithDetails = EventSupplier & {
  supplier: Supplier
}

type Props = {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  onClick: () => void
}

export default function SupplierCard({ item, budgets, currency, onClick }: Props) {
  const s = item.supplier

  const waLink   = s.phone ? `https://wa.me/${(s.phone_country_code || '+52').replace('+', '')}${s.phone}` : null
  const igLink   = s.instagram ? `https://instagram.com/${s.instagram.replace('@', '')}` : null
  const webLink  = s.website || null
  const mailLink = s.email ? `mailto:${s.email}` : null

  const openLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Cotización vs meta
  const linkedBudget = budgets.find(b => b.id === item.event_budget_id)
  const meta     = linkedBudget?.budget_amount ?? null
  const cotizado = item.quoted_amount ?? item.contract_amount ?? null
  const exceeds  = meta !== null && cotizado !== null && cotizado > meta
  const saves    = meta !== null && cotizado !== null && cotizado < meta
  const saving   = saves ? meta - cotizado : 0

  // Colores según estado
  const blockBg    = exceeds ? 'bg-red-50'      : saves ? 'bg-emerald-50' : 'bg-[#fafafa]'
  const amountColor = exceeds ? 'text-red-600'   : saves ? 'text-emerald-600' : 'text-[#1D1E20]'
  const labelColor  = exceeds ? 'text-red-500'   : saves ? 'text-emerald-500' : ''
  const labelText   = exceeds ? 'Excede el presupuesto' : saves ? `Ahorro de ${formatCurrency(saving, currency)}` : ''

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-[#e8e8e8] bg-white p-4 transition hover:border-[#48C9B0] hover:shadow-sm"
    >
      {/* Header: categoría + badge status */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
          {BUDGET_CATEGORY_LABELS[s.category]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUPPLIER_STATUS_COLORS[item.status]}`}>
          {SUPPLIER_STATUS_LABELS[item.status]}
        </span>
      </div>

      {/* Nombre */}
      <h3 className="mb-1 text-sm font-bold text-[#1D1E20]">{s.name}</h3>

      {/* Subcategoría / partida */}
      {linkedBudget ? (
        <p className="mb-3 text-xs text-[#888]">
          {linkedBudget.subcategory || budgetCategoryLabel(linkedBudget.category)}
        </p>
      ) : s.subcategory ? (
        <p className="mb-3 text-xs text-[#888]">{s.subcategory}</p>
      ) : (
        <div className="mb-3" />
      )}

      {/* Cotización vs meta */}
      {cotizado !== null && (
        <div className={`mb-3 rounded-lg p-2.5 ${blockBg}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#888]">
                {item.contract_amount ? 'Contratado' : 'Cotizado'}
              </p>
              <p className={`text-sm font-bold tabular-nums ${amountColor}`}>
                {formatCurrency(cotizado, currency)}
              </p>
            </div>
            {meta !== null && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-[#888]">Meta</p>
                <p className="text-sm font-semibold tabular-nums text-[#888]">
                  {formatCurrency(meta, currency)}
                </p>
              </div>
            )}
          </div>
          {labelText && (
            <p className={`mt-1 text-[10px] font-medium ${labelColor}`}>
              {labelText}
            </p>
          )}
        </div>
      )}

      {/* Botones de contacto */}
      <div className="flex items-center gap-1.5">
        {waLink && (
          <button
            onClick={e => openLink(e, waLink)}
            title="WhatsApp"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0fdfb] text-[#1a9e88] transition hover:bg-[#48C9B0] hover:text-white"
          >
            <FaWhatsapp size={14} />
          </button>
        )}
        {igLink && (
          <button
            onClick={e => openLink(e, igLink)}
            title="Instagram"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0f5] text-[#e1306c] transition hover:bg-[#e1306c] hover:text-white"
          >
            <FiInstagram size={14} />
          </button>
        )}
        {webLink && (
          <button
            onClick={e => openLink(e, webLink)}
            title="Sitio web"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f5] text-[#555] transition hover:bg-[#1D1E20] hover:text-white"
          >
            <Globe size={14} />
          </button>
        )}
        {mailLink && (
          <button
            onClick={e => openLink(e, mailLink)}
            title="Email"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f5] text-[#555] transition hover:bg-[#1D1E20] hover:text-white"
          >
            <Mail size={14} />
          </button>
        )}
      </div>
    </div>
  )
}