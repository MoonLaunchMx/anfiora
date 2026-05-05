'use client'

import { Phone, MoreVertical } from 'lucide-react'
import {
  Currency, formatCurrency, BUDGET_CATEGORY_LABELS,
  EventSupplier, Supplier, SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'
import { FiInstagram } from 'react-icons/fi'

type SupplierWithDetails = EventSupplier & {
  supplier: Supplier
}

type Props = {
  item: SupplierWithDetails
  currency: Currency
  onClick: () => void
}

export default function SupplierCard({ item, currency, onClick }: Props) {
  const s = item.supplier

  const waLink = s.phone
    ? `https://wa.me/${(s.phone_country_code || '+52').replace('+', '')}${s.phone}`
    : null

  const igLink = s.instagram ? `https://instagram.com/${s.instagram}` : null

  const openLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-[#e8e8e8] bg-white p-4 transition hover:border-[#48C9B0] hover:shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
          {BUDGET_CATEGORY_LABELS[s.category]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUPPLIER_STATUS_COLORS[item.status]}`}>
          {SUPPLIER_STATUS_LABELS[item.status]}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-bold text-[#1D1E20]">{s.name}</h3>

      {s.subcategory && (
        <p className="mb-3 text-xs text-[#888]">{s.subcategory}</p>
      )}

      {(item.contract_amount || item.quoted_amount) && (
        <div className="mb-3 rounded-lg bg-[#fafafa] p-2.5">
          {item.contract_amount ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#888]">Contratado</p>
              <p className="text-sm font-bold tabular-nums text-[#1D1E20]">
                {formatCurrency(item.contract_amount, currency)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#888]">Cotizado</p>
              <p className="text-sm font-semibold tabular-nums text-[#666]">
                {formatCurrency(item.quoted_amount || 0, currency)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {waLink && (
          <button
            onClick={e => openLink(e, waLink)}
            title="Abrir WhatsApp"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0fdfb] text-[#1a9e88] transition hover:bg-[#48C9B0] hover:text-white"
          >
            <Phone size={14} />
          </button>
        )}
        {igLink && (
          <button
            onClick={e => openLink(e, igLink)}
            title="Abrir Instagram"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0f5] text-[#e1306c] transition hover:bg-[#e1306c] hover:text-white"
          >
            <FiInstagram size={14} />
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={e => { e.stopPropagation(); onClick() }}
          className="flex h-7 w-7 items-center justify-center rounded text-[#aaa] hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  )
}