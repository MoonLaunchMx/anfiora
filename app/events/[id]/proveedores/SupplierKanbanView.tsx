'use client'
 
import { useState } from 'react'
import {
  DndContext, DragEndEvent, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core'
import { Frown, Meh, Smile } from 'lucide-react'
import {
  Currency, formatCurrency, budgetCategoryLabel,
  EventSupplier, Supplier, EventBudget, SupplierStatus,
  SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS,
  SUPPLIER_MOOD_COLORS,
} from '@/lib/types'
 
type SupplierWithDetails = EventSupplier & { supplier: Supplier }
 
type Props = {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  onSelect: (item: SupplierWithDetails) => void
  onStatusChange: (itemId: string, newStatus: SupplierStatus) => void
}
 
const VISIBLE_STATUSES: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado']
 
export default function SupplierKanbanView({ items, budgets, currency, onSelect, onStatusChange }: Props) {
  const [showDescartados, setShowDescartados] = useState(false)
 
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )
 
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newStatus = over.id as string
    if (!SUPPLIER_STATUSES.includes(newStatus as SupplierStatus)) return
    const draggedItem = items.find(i => i.id === active.id as string)
    if (!draggedItem || draggedItem.status === newStatus) return
 
    onStatusChange(active.id as string, newStatus as SupplierStatus)
  }
 
  const itemsByStatus: Record<SupplierStatus, SupplierWithDetails[]> = {
    nuevo: [], cotizado: [], contratado: [], descartado: [],
  }
  items.forEach(item => {
    if (itemsByStatus[item.status]) itemsByStatus[item.status].push(item)
  })
 
  const descartadosCount = itemsByStatus['descartado'].length
 
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-6" style={{ alignItems: 'flex-start' }}>
 
        {/* Columnas principales */}
        {VISIBLE_STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            items={itemsByStatus[status]}
            budgets={budgets}
            currency={currency}
            onSelect={onSelect}
          />
        ))}
 
        {/* Descartados — barra vertical colapsada, expande como columna */}
        <div className="flex shrink-0 flex-col" style={{ alignSelf: 'flex-start' }}>
          {!showDescartados ? (
            <button
              onClick={() => setShowDescartados(true)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-4 text-[#bbb] transition hover:border-[#888] hover:text-[#888]"
              style={{ width: 36, minHeight: 120 }}
            >
              <span
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Descartados
              </span>
              {descartadosCount > 0 && (
                <span className="rounded-full bg-[#e8e8e8] px-1.5 py-0.5 text-[9px] font-bold text-[#888]">
                  {descartadosCount}
                </span>
              )}
            </button>
          ) : (
            <div className="w-[220px]">
              <button
                onClick={() => setShowDescartados(false)}
                className="mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#888] transition hover:text-[#1D1E20]"
              >
                <span>Descartados</span>
                <span className="font-normal text-[#bbb]">({descartadosCount}) ✕</span>
              </button>
              <KanbanColumn
                status="descartado"
                items={itemsByStatus['descartado']}
                budgets={budgets}
                currency={currency}
                onSelect={onSelect}
                dimmed
              />
            </div>
          )}
        </div>
 
      </div>
    </DndContext>
  )
}
 
// ── COLUMNA ───────────────────────────────────────────────────────────────
 
function KanbanColumn({
  status, items, budgets, currency, onSelect, dimmed = false,
}: {
  status: SupplierStatus
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  onSelect: (item: SupplierWithDetails) => void
  dimmed?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
 
  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 flex-col rounded-xl border p-3 transition lg:w-auto lg:flex-1 ${
        dimmed
          ? 'w-[220px] border-dashed border-[#e0e0e0] bg-[#fafafa] opacity-70'
          : isOver
            ? 'w-[240px] border-[#48C9B0] bg-[#f0fdfb]'
            : 'w-[240px] border-[#e8e8e8] bg-[#fafafa]'
      }`}
    >
      {/* Header */}
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
          <div className="rounded-lg border border-dashed border-[#e0e0e0] py-8 text-center">
            <p className="text-[10px] text-[#ccc]">Arrastra aquí</p>
          </div>
        )}
      </div>
    </div>
  )
}
 
// ── CARD KANBAN ───────────────────────────────────────────────────────────
 
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
  const meta         = linkedBudget?.budget_amount ?? null
  const cotizado     = item.quoted_amount ?? item.contract_amount ?? null
  const exceeds      = meta !== null && cotizado !== null && cotizado > meta
 
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined
 
  const MoodIcon = item.mood === 'love'
    ? <Smile size={11} className={SUPPLIER_MOOD_COLORS['love']} />
    : item.mood === 'no'
      ? <Frown size={11} className={SUPPLIER_MOOD_COLORS['no']} />
      : item.mood === 'normal'
        ? <Meh size={11} className={SUPPLIER_MOOD_COLORS['normal']} />
        : null
 
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
      {/* Categoría + mood */}
      <div className="mb-1 flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
          {budgetCategoryLabel(item.supplier.category)}
        </p>
        {MoodIcon}
      </div>
 
      {/* Nombre */}
      <p className="text-xs font-bold text-[#1D1E20]">{item.supplier.name}</p>
 
      {/* Concepto */}
      {linkedBudget && (
        <p className="mt-0.5 text-[10px] text-[#aaa]">
          {linkedBudget.subcategory || budgetCategoryLabel(linkedBudget.category)}
        </p>
      )}
 
      {/* Monto */}
      {cotizado !== null && (
        <p className={`mt-2 text-xs font-semibold tabular-nums ${exceeds ? 'text-amber-600' : 'text-[#48C9B0]'}`}>
          {formatCurrency(cotizado, currency)}
          {meta !== null && (
            <span className="font-normal text-[#bbb]"> / {formatCurrency(meta, currency)}</span>
          )}
        </p>
      )}
 
      {/* Notas truncadas */}
      {item.event_notes && (
        <p className="mt-1.5 truncate text-[10px] text-[#aaa]">
          {item.event_notes}
        </p>
      )}
    </div>
  )
}