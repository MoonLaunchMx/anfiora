'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, AlertTriangle } from 'lucide-react'
import {
  BudgetCategory, BUDGET_CATEGORY_LABELS,
  EventBudget, EventSupplier, Supplier,
  Currency, formatCurrency,
} from '@/lib/types'
import BudgetItemRow from './BudgetItemRow'
import HealthBar from '@/app/components/ui/HealthBar'

type EventSupplierWithName = EventSupplier & {
  supplier: Pick<Supplier, 'id' | 'name' | 'category'>
}

type Props = {
  category: BudgetCategory
  items: EventBudget[]
  currency: Currency
  contractedByItem: Record<string, number>
  paidByItem: Record<string, number>
  eventSuppliersById: Record<string, EventSupplierWithName>
  availableSuppliersForCategory: EventSupplierWithName[]
  onOpenAddModal: (category: BudgetCategory) => void
  onUpdateItem: (id: string, updates: { subcategory?: string; budget_amount?: number; event_supplier_id?: string | null }) => void
  onDeleteItem: (id: string) => void
  onOpenSupplier: (supplier: EventSupplierWithName) => void
}

export default function BudgetCategoryRow({
  category, items, currency, contractedByItem, paidByItem,
  eventSuppliersById, availableSuppliersForCategory,
  onOpenAddModal, onUpdateItem, onDeleteItem, onOpenSupplier,
}: Props) {
  const [expanded, setExpanded] = useState(true)

  const safeItems       = items || []
  const totalBudget     = safeItems.reduce((sum, i) => sum + i.budget_amount, 0)
  const totalContracted = safeItems.reduce((sum, i) => sum + (contractedByItem[i.id] || 0), 0)

  const isOverBudget = totalContracted > totalBudget && totalBudget > 0

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
        <h3 className="flex-1 text-sm font-semibold text-[#1D1E20] flex items-center gap-1.5">
          {BUDGET_CATEGORY_LABELS[category]}
          {isOverBudget && (
            <span title="El total contratado supera el presupuesto de la categoría">
              <AlertTriangle size={13} className="shrink-0 text-amber-500" />
            </span>
          )}
        </h3>
        <span className="hidden text-xs text-[#888] sm:inline">
          {safeItems.length} {safeItems.length === 1 ? 'concepto' : 'conceptos'}
        </span>
        <span className={`text-sm font-semibold tabular-nums ${isOverBudget ? 'text-amber-600' : 'text-[#1D1E20]'}`}>
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
          {safeItems.length > 0 && (
            <div className="hidden grid-cols-[1fr_140px_140px_140px_140px_40px] gap-3 border-b border-[#f5f5f5] bg-[#fafafa] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#888] sm:grid">
              <span>Concepto / Proveedor</span>
              <span className="text-right">Estimado</span>
              <span className="text-right">Contratado</span>
              <span className="text-right">Pagado</span>
              <span className="text-right">Por pagar</span>
              <span />
            </div>
          )}

          {safeItems.map(item => {
            const linked = item.event_supplier_id
              ? eventSuppliersById[item.event_supplier_id] || null
              : null
            return (
              <BudgetItemRow
                key={item.id}
                item={item}
                currency={currency}
                contractedAmount={contractedByItem[item.id] || 0}
                paidAmount={paidByItem[item.id] || 0}
                availableSuppliers={availableSuppliersForCategory}
                linkedSupplier={linked}
                onUpdate={onUpdateItem}
                onDelete={onDeleteItem}
                onOpenSupplier={onOpenSupplier}
              />
            )
          })}

          {safeItems.length === 0 && (
            <div className="px-4 py-4 text-center text-xs text-[#aaa]">
              Sin conceptos todavía
            </div>
          )}

          <div className="border-t border-[#f5f5f5] bg-[#fafafa] px-4 py-2">
            <button
              onClick={() => onOpenAddModal(category)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#48C9B0] transition hover:text-[#3aa896]"
            >
              <Plus size={14} />
              Agregar concepto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}