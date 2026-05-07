'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, FileSpreadsheet, FileText, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Event, EventBudget, BudgetCategory, BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS,
  Currency, EventSupplier, Supplier,
} from '@/lib/types'
import BudgetMetricsCards from '@/app/components/ui/BudgetMetricsCards'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import BudgetCategoryRow from './BudgetCategoryRow'
import BudgetItemModal from './BudgetItemModal'
import { buildSeedBudgets } from './lib/seed'
import { exportToExcel, exportToPDF } from './lib/exports'

type EventSupplierWithName = EventSupplier & {
  supplier: Pick<Supplier, 'id' | 'name'>
}

type SupplierPaymentRow = {
  id: string
  event_supplier_id: string
  amount: number
}

export default function PresupuestoPage() {
  const { id } = useParams()
  const eventId = id as string

  const [event, setEvent]                   = useState<Event | null>(null)
  const [budgets, setBudgets]               = useState<EventBudget[]>([])
  const [eventSuppliers, setEventSuppliers] = useState<EventSupplierWithName[]>([])
  const [payments, setPayments]             = useState<SupplierPaymentRow[]>([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')

  const [modalOpen, setModalOpen]         = useState(false)
  const [modalCategory, setModalCategory] = useState<BudgetCategory | null>(null)

  const statsToggle = useStatsToggle(eventId, 'presupuesto')

  useEffect(() => {
    if (!eventId) return
    loadAll()
  }, [eventId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [eventRes, budgetsRes, suppliersRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('event_budgets').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
        supabase.from('event_suppliers').select('*, supplier:suppliers(id, name, category)').eq('event_id', eventId),
      ])

      if (eventRes.data) setEvent(eventRes.data as Event)
      const supplierRows = (suppliersRes.data || []) as EventSupplierWithName[]
      setEventSuppliers(supplierRows)

      const supplierIds = supplierRows.map(s => s.id)
      if (supplierIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('supplier_payments')
          .select('id, event_supplier_id, amount')
          .in('event_supplier_id', supplierIds)
        if (paymentsError) {
          console.error('Error cargando pagos:', paymentsError?.message ?? paymentsError, paymentsError)
        }
        setPayments((paymentsData || []) as SupplierPaymentRow[])
      } else {
        setPayments([])
      }

      let currentBudgets = (budgetsRes.data || []) as EventBudget[]
      if (currentBudgets.length === 0) {
        const seed = buildSeedBudgets(eventId)
        const { data: inserted, error: seedError } = await supabase.from('event_budgets').insert(seed).select()
        if (seedError) {
          console.error('Error sembrando presupuesto:', seedError?.message ?? seedError, seedError)
        }
        if (inserted) currentBudgets = inserted as EventBudget[]
      }

      setBudgets(currentBudgets)
    } catch (err: any) {
      console.error('Error cargando presupuesto:', err?.message ?? err, err)
    } finally {
      setLoading(false)
    }
  }

  const paidByEventSupplier: Record<string, number> = {}
  payments.forEach(p => {
    paidByEventSupplier[p.event_supplier_id] = (paidByEventSupplier[p.event_supplier_id] || 0) + Number(p.amount || 0)
  })

  const eventSuppliersById: Record<string, EventSupplierWithName> = {}
  eventSuppliers.forEach(es => { eventSuppliersById[es.id] = es })

  const availableSuppliersByCategory: Record<string, EventSupplierWithName[]> = {}
  BUDGET_CATEGORIES.forEach(cat => { availableSuppliersByCategory[cat] = [] })
  eventSuppliers.forEach(es => {
    if (!es.supplier) return
    if (es.contract_amount === null || es.contract_amount === undefined) return
    const cat = (es as any).supplier?.category || (es as any).category
    if (cat && availableSuppliersByCategory[cat]) {
      availableSuppliersByCategory[cat].push(es)
    }
  })

  const contractedByItem: Record<string, number> = {}
  const paidByItem: Record<string, number>       = {}
  budgets.forEach(b => {
    if (b.event_supplier_id) {
      const supplier = eventSuppliersById[b.event_supplier_id]
      contractedByItem[b.id] = Number(supplier?.contract_amount || 0)
      paidByItem[b.id]       = paidByEventSupplier[b.event_supplier_id] || 0
    } else {
      contractedByItem[b.id] = 0
      paidByItem[b.id]       = 0
    }
  })

  const filteredBudgets = search.trim()
    ? budgets.filter(b => {
        const q = search.toLowerCase()
        return b.subcategory.toLowerCase().includes(q) || BUDGET_CATEGORY_LABELS[b.category].toLowerCase().includes(q)
      })
    : budgets

  const itemsByCategory: Record<BudgetCategory, EventBudget[]> = {} as any
  BUDGET_CATEGORIES.forEach(cat => { itemsByCategory[cat] = [] })
  filteredBudgets.forEach(b => {
    if (itemsByCategory[b.category]) itemsByCategory[b.category].push(b)
  })

  const totalBudget     = budgets.reduce((sum, b) => sum + b.budget_amount, 0)
  const totalContracted = budgets.reduce((sum, b) => sum + (contractedByItem[b.id] || 0), 0)
  const totalPaid       = budgets.reduce((sum, b) => sum + (paidByItem[b.id] || 0), 0)

  const openAddModalForCategory = (category: BudgetCategory) => {
    setModalCategory(category)
    setModalOpen(true)
  }

  const openAddModalGeneric = () => {
    setModalCategory(null)
    setModalOpen(true)
  }

  const handleModalSubmit = async (data: {
    category: BudgetCategory
    subcategory: string
    budget_amount: number
    event_supplier_id: string | null
    notes: string | null
  }) => {
    try {
      const { data: inserted, error } = await supabase
        .from('event_budgets')
        .insert({ event_id: eventId, ...data })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          alert('Ya existe una partida con ese nombre en esta categoría')
        } else {
          console.error('Error creando partida:', error?.message ?? error, error)
          alert(`No se pudo crear la partida: ${error?.message ?? 'Intenta de nuevo'}`)
        }
        throw error
      }
      if (inserted) setBudgets(prev => [...prev, inserted as EventBudget])
    } catch (err: any) {
      console.error('Error en handleModalSubmit:', err?.message ?? err, err)
      throw err
    }
  }

  const handleUpdateItem = async (
    itemId: string,
    updates: { subcategory?: string; budget_amount?: number; event_supplier_id?: string | null },
  ) => {
    setBudgets(prev => prev.map(b => b.id === itemId ? { ...b, ...updates } : b))
    const { error } = await supabase.from('event_budgets').update(updates).eq('id', itemId)
    if (error) {
      console.error('Error actualizando partida:', error?.message ?? error, error)
      loadAll()
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    const item = budgets.find(b => b.id === itemId)
    const confirmText = item?.subcategory ? `¿Borrar la partida "${item.subcategory}"?` : '¿Borrar esta partida?'
    if (!confirm(confirmText)) return
    setBudgets(prev => prev.filter(b => b.id !== itemId))
    const { error } = await supabase.from('event_budgets').delete().eq('id', itemId)
    if (error) {
      console.error('Error borrando partida:', error?.message ?? error, error)
      loadAll()
    }
  }

  const handleExport = (format: 'excel' | 'pdf') => {
    if (!event) return
    const exportData = {
      eventName: event.name, eventDate: event.event_date, currency: event.currency,
      itemsByCategory, contractedByItem, paidByItem,
      totalBudget, totalContracted, totalPaid,
    }
    if (format === 'excel') exportToExcel(exportData)
    else exportToPDF(exportData)
  }

  if (loading || !event) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-16 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="h-24 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="h-32 animate-pulse rounded-xl bg-[#f5f5f5]" />
      </div>
    )
  }

  const currency: Currency = event.currency || 'MXN'

  return (
    <div className="overflow-y-auto p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1D1E20]">Presupuesto</h1>
          <p className="mt-0.5 text-xs text-[#888]">Sincroniza proveedores con tu presupuesto.</p>
        </div>
        <div className="lg:hidden pt-1">
          <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
        </div>
      </div>

      <div className="mb-4">
        <StatsCollapse visible={statsToggle.visible}>
          <BudgetMetricsCards
            totalBudget={totalBudget}
            totalContracted={totalContracted}
            totalPaid={totalPaid}
            currency={currency}
          />
        </StatsCollapse>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar partida..."
            className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-9 pr-3 text-xs outline-none transition focus:border-[#48C9B0]"
          />
        </div>

        <button
          onClick={() => handleExport('excel')}
          className="hidden items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex"
        >
          <FileSpreadsheet size={14} />
          Excel
        </button>

        <button
          onClick={() => handleExport('pdf')}
          className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
        >
          <FileText size={14} />
          <span className="hidden sm:inline">PDF</span>
        </button>

        <button
          onClick={openAddModalGeneric}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
        >
          <Plus size={14} />
          <span>Nueva partida</span>
        </button>
      </div>

      <div className="space-y-3 pb-6">
        {BUDGET_CATEGORIES.map(category => {
          const items = itemsByCategory[category]
          if (search.trim() && items.length === 0) return null
          return (
            <BudgetCategoryRow
              key={category}
              category={category}
              items={items}
              currency={currency}
              contractedByItem={contractedByItem}
              paidByItem={paidByItem}
              eventSuppliersById={eventSuppliersById}
              availableSuppliersForCategory={availableSuppliersByCategory[category] || []}
              onOpenAddModal={openAddModalForCategory}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
          )
        })}
      </div>

      <BudgetItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        initialCategory={modalCategory}
        eventSuppliers={eventSuppliers}
        onSubmit={handleModalSubmit}
      />
    </div>
  )
}