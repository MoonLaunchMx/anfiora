'use client'

import { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { EventBudget, Currency, formatCurrency } from '@/lib/types'

type Props = {
  item: EventBudget
  currency: Currency
  contractedAmount: number
  paidAmount: number
  onUpdate: (id: string, updates: { subcategory?: string; budget_amount?: number }) => void
  onDelete: (id: string) => void
}

export default function BudgetItemRow({
  item, currency, contractedAmount, paidAmount, onUpdate, onDelete,
}: Props) {
  const [localName, setLocalName]     = useState(item.subcategory || '')
  const [localAmount, setLocalAmount] = useState(item.budget_amount.toString())
  const [amountFocused, setAmountFocused] = useState(false)

  useEffect(() => { setLocalName(item.subcategory || '') }, [item.subcategory])
  useEffect(() => { setLocalAmount(item.budget_amount.toString()) }, [item.budget_amount])

  const pendingAmount = contractedAmount - paidAmount

  const lastSavedName   = useRef(item.subcategory || '')
  const lastSavedAmount = useRef(item.budget_amount)

  const saveName = () => {
    const trimmed = localName.trim()
    if (trimmed !== lastSavedName.current) {
      onUpdate(item.id, { subcategory: trimmed })
      lastSavedName.current = trimmed
    }
  }

  const saveAmount = () => {
    setAmountFocused(false)
    const parsed = parseFloat(localAmount) || 0
    if (parsed !== lastSavedAmount.current) {
      onUpdate(item.id, { budget_amount: parsed })
      lastSavedAmount.current = parsed
    }
  }

  // Display formateado cuando el input no esta en foco
  const amountDisplay = amountFocused
    ? localAmount
    : formatCurrency(parseFloat(localAmount) || 0, currency)

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden grid-cols-[1fr_140px_140px_140px_140px_40px] items-center gap-3 border-t border-[#f5f5f5] px-4 py-2 hover:bg-[#fafafa] sm:grid">
        <input
          type="text"
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={saveName}
          placeholder="Nombre de partida..."
          className="rounded border border-transparent px-2 py-1 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0] focus:bg-white"
        />
        <input
          type="text"
          inputMode="decimal"
          value={amountDisplay}
          onFocus={() => setAmountFocused(true)}
          onChange={e => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, '')
            const parts = cleaned.split('.')
            if (parts.length > 2) return
            setLocalAmount(cleaned)
          }}
          onBlur={saveAmount}
          placeholder={formatCurrency(0, currency)}
          className="w-full rounded border border-transparent px-2 py-1 text-right text-sm tabular-nums text-[#1D1E20] outline-none transition focus:border-[#48C9B0] focus:bg-white"
        />
        <div className="text-right text-xs text-[#888] tabular-nums">{formatCurrency(contractedAmount, currency)}</div>
        <div className="text-right text-xs text-[#888] tabular-nums">{formatCurrency(paidAmount, currency)}</div>
        <div className="text-right text-xs text-[#888] tabular-nums">{formatCurrency(pendingAmount, currency)}</div>
        <button
          onClick={() => onDelete(item.id)}
          className="flex h-7 w-7 items-center justify-center rounded text-[#ccc] transition hover:bg-red-50 hover:text-red-500"
          title="Borrar partida"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* MOBILE */}
      <div className="border-t border-[#f5f5f5] px-4 py-3 sm:hidden">
        <div className="flex items-start gap-2">
          <input
            type="text"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={saveName}
            placeholder="Nombre de partida..."
            className="flex-1 rounded border border-transparent px-2 py-1 text-sm font-medium text-[#1D1E20] outline-none focus:border-[#48C9B0] focus:bg-white"
          />
          <button
            onClick={() => onDelete(item.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#ccc] hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
          <div>
            <p className="text-[#aaa]">Estimado</p>
            <input
              type="text"
              inputMode="decimal"
              value={amountDisplay}
              onFocus={() => setAmountFocused(true)}
              onChange={e => {
                const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                const parts = cleaned.split('.')
                if (parts.length > 2) return
                setLocalAmount(cleaned)
              }}
              onBlur={saveAmount}
              className="w-full rounded border border-transparent px-2 py-1 text-sm font-semibold tabular-nums text-[#1D1E20] outline-none focus:border-[#48C9B0] focus:bg-white"
            />
          </div>
          <div>
            <p className="text-[#aaa]">Cotizado</p>
            <p className="px-2 py-1 text-sm tabular-nums text-[#888]">{formatCurrency(contractedAmount, currency)}</p>
          </div>
          <div>
            <p className="text-[#aaa]">Pagado</p>
            <p className="px-2 py-1 text-sm tabular-nums text-[#888]">{formatCurrency(paidAmount, currency)}</p>
          </div>
          <div>
            <p className="text-[#aaa]">Por pagar</p>
            <p className="px-2 py-1 text-sm tabular-nums text-[#888]">{formatCurrency(pendingAmount, currency)}</p>
          </div>
        </div>
      </div>
    </>
  )
}