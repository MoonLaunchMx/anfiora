'use client'

import { useRef } from 'react'
import {
  DndContext, DragEndEvent, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core'
import {
  Currency, formatCurrency, BUDGET_CATEGORY_LABELS,
  EventSupplier, Supplier, EventBudget,
  SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
} from '@/lib/types'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  onSelect: (item: SupplierWithDetails) => void
  onStatusChange: (itemId: string, newStatus: string) => void
}

export default function SupplierKanbanView({ items, budgets, currency, onSelect, onStatusChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newStatus = over.id as string
    if (SUPPLIER_STATUSES.includes(newStatus as any)) {
      onStatusChange(active.id as string, newStatus)
    }
  }

  const itemsByStatus: Record<string, SupplierWithDetails[]> = {}
  SUPPLIER_STATUSES.forEach(s => { itemsByStatus[s] = [] })
  items.forEach(item => {
    if (itemsByStatus[item.status]) itemsByStatus[item.status].push(item)
  })

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Mobile: scroll horizontal snap. Desktop: grid 5 col */}
      <div className="flex gap-3 overflow-x-auto pb-6 lg:grid lg:grid-cols-5 lg:overflow-x-visible">
        {SUPPLIER_STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            items={itemsByStatus[status]}
            budgets={budgets}
            currency={currency}
            onSelect={onSelect}
          />
        ))}
      </div>
    </DndContext>
  )
}

function KanbanColumn({
  status, items, budgets, currency, onSelect,
}: {
  status: string
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  onSelect: (item: SupplierWithDetails) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[240px] shrink-0 flex-col rounded-xl border bg-[#fafafa] p-3 transition lg:w-auto ${
        isOver ? 'border-[#48C9B0] bg-[#f0fdfb]' : 'border-[#e8e8e8]'
      }`}
    >
      {/* Header columna */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUPPLIER_STATUS_COLORS[status]}`}>
          {SUPPLIER_STATUS_LABELS[status]}
        </span>
        <span className="text-[10px] font-bold text-[#888]">{items.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {items.map(item => (
          <KanbanCard
            key={item.id}
            item={item}
            budgets={budgets}
            currency={currency}
            onSelect={onSelect}
          />
        ))}
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#e0e0e0] py-6 text-center">
            <p className="text-[10px] text-[#ccc]">Arrastra aquí</p>
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanCard({
  item, budgets, currency, onSelect,
}: {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  onSelect: (item: SupplierWithDetails) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })

  const linkedBudget = budgets.find(b => b.id === item.event_budget_id)
  const meta = linkedBudget?.budget_amount ?? null
  const cotizado = item.quoted_amount ?? item.contract_amount ?? null
  const exceeds = meta !== null && cotizado !== null && cotizado > meta

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(item)}
      className={`cursor-grab rounded-lg border border-[#e8e8e8] bg-white p-3 transition active:cursor-grabbing ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:border-[#48C9B0] hover:shadow-sm'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
        {BUDGET_CATEGORY_LABELS[item.supplier.category]}
      </p>
      <p className="mt-0.5 text-xs font-bold text-[#1D1E20]">{item.supplier.name}</p>
      {cotizado !== null && (
        <p className={`mt-1 text-xs tabular-nums font-medium ${exceeds ? 'text-amber-600' : 'text-[#48C9B0]'}`}>
          {formatCurrency(cotizado, currency)}
          {meta !== null && (
            <span className="font-normal text-[#bbb]"> / {formatCurrency(meta, currency)}</span>
          )}
        </p>
      )}
    </div>
  )
}