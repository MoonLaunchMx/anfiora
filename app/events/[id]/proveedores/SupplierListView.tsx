'use client'

import {
  Currency, formatCurrency, budgetCategoryLabel,
  EventSupplier, Supplier, EventBudget,
  SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  onSelect: (item: SupplierWithDetails) => void
}

export default function SupplierListView({ items, budgets, currency, onSelect }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e8e8e8] bg-white pb-6">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#e8e8e8]">
            <th className="px-4 py-3 text-left font-semibold text-[#888]">Nombre</th>
            <th className="px-4 py-3 text-left font-semibold text-[#888]">Categoría</th>
            <th className="px-4 py-3 text-left font-semibold text-[#888]">Partida</th>
            <th className="px-4 py-3 text-left font-semibold text-[#888]">Estado</th>
            <th className="px-4 py-3 text-right font-semibold text-[#888]">Cotizado</th>
            <th className="px-4 py-3 text-right font-semibold text-[#888]">Contratado</th>
            <th className="px-4 py-3 text-right font-semibold text-[#888]">Meta</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const s = item.supplier
            const linkedBudget = budgets.find(b => b.id === item.event_budget_id)
            const meta = linkedBudget?.budget_amount ?? null
            const exceeds = meta !== null && item.contract_amount !== null && item.contract_amount > meta

            return (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                className="cursor-pointer border-b border-[#f0f0f0] transition hover:bg-[#fafafa]"
              >
                <td className="px-4 py-3 font-medium text-[#1D1E20]">{s.name}</td>
                <td className="px-4 py-3 text-[#888]">{budgetCategoryLabel(s.category)}</td>
                <td className="px-4 py-3 text-[#888]">
                  {linkedBudget
                    ? linkedBudget.subcategory || budgetCategoryLabel(linkedBudget.category)
                    : <span className="text-[#ccc]">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUPPLIER_STATUS_COLORS[item.status]}`}>
                    {SUPPLIER_STATUS_LABELS[item.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#888]">
                  {item.quoted_amount ? formatCurrency(item.quoted_amount, currency) : <span className="text-[#ccc]">—</span>}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-medium ${exceeds ? 'text-amber-600' : 'text-[#1D1E20]'}`}>
                  {item.contract_amount ? formatCurrency(item.contract_amount, currency) : <span className="text-[#ccc]">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#888]">
                  {meta ? formatCurrency(meta, currency) : <span className="text-[#ccc]">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}