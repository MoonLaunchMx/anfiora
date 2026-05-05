'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import {
  BudgetCategory, BUDGET_CATEGORY_LABELS,
  EventBudget, Currency, formatCurrency,
} from '@/lib/types'
import BudgetItemRow from './BudgetItemRow'
import HealthBar from '@/app/components/ui/HealthBar'

type Props = {
  category: BudgetCategory
  items: EventBudget[]
  currency: Currency
  contractedByItem: Record<string, number>
  paidByItem: Record<string, number>
  // Ahora abre el modal en lugar de chips
  onOpenAddModal: (category: BudgetCategory) => void
  onUpdateItem: (id: string, updates: { subcategory?: string; budget_amount?: number }) => void
  onDeleteItem: (id: string) => void
}

export default function BudgetCategoryRow({
  category, items, currency, contractedByItem, paidByItem,
  onOpenAddModal, onUpdateItem, onDeleteItem,
}: Props) {
  const [expanded, setExpanded] = useState(true)

  const totalBudget     = items.reduce((sum, i) => sum + i.budget_amount, 0)
  const totalContracted = items.reduce((sum, i) => sum + (contractedByItem[i.id] || 0), 0)

  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-[#fafafa]"
      >
        {expanded
          ? <ChevronDown size={16} className="shrink-0 text-[#888]" />
          : <ChevronRight size={16} className="shrink-0 text-[#888]" />
        }
        <h3 className="flex-1 text-sm font-semibold text-[#1D1E20]">{BUDGET_CATEGORY_LABELS[category]}</h3>
        <span className="hidden text-xs text-[#888] sm:inline">
          {items.length} {items.length === 1 ? 'partida' : 'partidas'}
        </span>
        <span className="text-sm font-semibold tabular-nums text-[#1D1E20]">
          {formatCurrency(totalBudget, currency)}
        </span>
      </button>

      {totalBudget > 0 && (
        <div className="px-4 pb-2">
          <HealthBar budgeted={totalBudget} contracted={totalContracted} />
        </div>
      )}

      {expanded && (
        <div className="border-t border-[#f0f0f0]">
          {items.length > 0 && (
            <div className="hidden grid-cols-[1fr_140px_140px_140px_140px_40px] gap-3 border-b border-[#f5f5f5] bg-[#fafafa] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#888] sm:grid">
              <span>Partida</span>
              <span className="text-right">Estimado</span>
              <span className="text-right">Cotizado</span>
              <span className="text-right">Pagado</span>
              <span className="text-right">Por pagar</span>
              <span />
            </div>
          )}

          {items.map(item => (
            <BudgetItemRow
              key={item.id}
              item={item}
              currency={currency}
              contractedAmount={contractedByItem[item.id] || 0}
              paidAmount={paidByItem[item.id] || 0}
              onUpdate={onUpdateItem}
              onDelete={onDeleteItem}
            />
          ))}

          {items.length === 0 && (
            <div className="px-4 py-4 text-center text-xs text-[#aaa]">Sin partidas todavía</div>
          )}

          <div className="border-t border-[#f5f5f5] bg-[#fafafa] px-4 py-2">
            <button
              onClick={() => onOpenAddModal(category)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#48C9B0] transition hover:text-[#3aa896]"
            >
              <Plus size={14} />
              Agregar partida
            </button>
          </div>
        </div>
      )}
    </div>
  )
}