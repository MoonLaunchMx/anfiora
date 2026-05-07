'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, Plus, LayoutGrid, List, Columns3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Event, EventBudget, EventSupplier, Supplier, BudgetCategory,
  BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS,
  SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, Currency, formatCurrency,
} from '@/lib/types'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import SupplierModal from './SupplierModal'
import SupplierCard from './SupplierCard'
import SupplierDetailModal from './SupplierDetailModal'
import SupplierListView from './SupplierListView'
import SupplierKanbanView from './SupplierKanbanView'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }
type ViewMode = 'cards' | 'lista' | 'kanban'
type GroupBy  = 'ninguna' | 'categoria' | 'partida' | 'estatus'

export default function ProveedoresPage() {
  const { id } = useParams()
  const eventId = id as string

  const [event, setEvent]     = useState<Event | null>(null)
  const [items, setItems]     = useState<SupplierWithDetails[]>([])
  const [budgets, setBudgets] = useState<EventBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterCategory, setFilterCategory] = useState<BudgetCategory | ''>('')
  const [filterStatus, setFilterStatus]     = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [groupBy, setGroupBy]   = useState<GroupBy>('ninguna')
  const [modalOpen, setModalOpen]       = useState(false)
  const [selectedItem, setSelectedItem] = useState<SupplierWithDetails | null>(null)

  const statsToggle = useStatsToggle(eventId, 'proveedores')

  useEffect(() => { if (eventId) loadAll() }, [eventId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [eventRes, suppliersRes, budgetsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('event_suppliers').select('*, supplier:suppliers(*)').eq('event_id', eventId).order('created_at', { ascending: false }),
        supabase.from('event_budgets').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
      ])
      if (eventRes.data)     setEvent(eventRes.data as Event)
      if (suppliersRes.data) setItems(suppliersRes.data as SupplierWithDetails[])
      if (budgetsRes.data)   setBudgets(budgetsRes.data as EventBudget[])
    } catch (err: any) {
      console.error('Error cargando proveedores:', err?.message ?? err, err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSupplier = async (data: {
    name: string
    category: BudgetCategory
    subcategory: string | null
    phone: string | null
    phone_country_code: string | null
    instagram: string | null
    facebook: string | null
    quoted_amount: number | null
    event_budget_id: string | null
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Sesión expirada'); return }

    const linkedBudget = data.event_budget_id ? budgets.find(b => b.id === data.event_budget_id) : null

    const { data: newSupplier, error: supErr } = await supabase
      .from('suppliers')
      .insert({
        user_id:            user.id,
        name:               data.name,
        category:           data.category,
        subcategory:        linkedBudget?.subcategory || data.subcategory,
        phone:              data.phone,
        phone_country_code: data.phone_country_code,
        instagram:          data.instagram,
        facebook:           data.facebook,
        country:            'MX',
      })
      .select()
      .single()

    if (supErr) { console.error('Error creando supplier:', supErr?.message ?? supErr, supErr); throw supErr }

    const { data: newEventSupplier, error: esErr } = await supabase
      .from('event_suppliers')
      .insert({
        event_id:        eventId,
        supplier_id:     newSupplier.id,
        status:          'nuevo',
        quoted_amount:   data.quoted_amount,
        event_budget_id: data.event_budget_id,
      })
      .select('*, supplier:suppliers(*)')
      .single()

    if (esErr) { console.error('Error creando event_supplier:', esErr?.message ?? esErr, esErr); throw esErr }
    if (newEventSupplier) setItems(prev => [newEventSupplier as SupplierWithDetails, ...prev])
  }

  const handleSavedItem  = (updated: SupplierWithDetails) => setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
  const handleDeletedItem = (deletedId: string) => setItems(prev => prev.filter(it => it.id !== deletedId))

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: newStatus } : it))
    const { error } = await supabase.from('event_suppliers').update({ status: newStatus }).eq('id', itemId)
    if (error) { console.error('Error actualizando status:', error?.message ?? error, error); loadAll() }
  }

  const filtered = items.filter(item => {
    const s = item.supplier
    if (search.trim()) {
      const q = search.toLowerCase()
      const match = s.name.toLowerCase().includes(q) ||
                    (s.subcategory || '').toLowerCase().includes(q) ||
                    BUDGET_CATEGORY_LABELS[s.category].toLowerCase().includes(q)
      if (!match) return false
    }
    if (filterCategory && s.category !== filterCategory) return false
    if (filterStatus && viewMode !== 'kanban' && item.status !== filterStatus) return false
    return true
  })

  const totalNuevos      = items.filter(i => i.status === 'nuevo').length
  const totalCotizando   = items.filter(i => i.status === 'cotizacion').length
  const totalContratados = items.filter(i => i.status === 'contratado').length
  const totalInvestment  = items.filter(i => i.status === 'contratado').reduce((sum, i) => sum + (i.contract_amount || 0), 0)

  if (loading || !event) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-16 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="h-24 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-[#f5f5f5]" />)}
        </div>
      </div>
    )
  }

  const currency: Currency = event.currency || 'MXN'

  const statsContent = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Nuevos"       value={totalNuevos.toString()} />
      <StatCard label="Cotizando"    value={totalCotizando.toString()} />
      <StatCard label="Contratados"  value={totalContratados.toString()} />
      <StatCard label="Inversión"    value={formatCurrency(totalInvestment, currency)} />
    </div>
  )

  return (
    <div className="overflow-y-auto p-4 sm:p-6">
      {/* Título */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1D1E20]">Proveedores</h1>
          <p className="mt-0.5 text-xs text-[#888]">Cotizaciones, contratos y pagos en un solo lugar.</p>
        </div>
        <div className="lg:hidden pt-1">
          <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4">
        <StatsCollapse visible={statsToggle.visible}>
          {statsContent}
        </StatsCollapse>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor..."
            className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-9 pr-3 text-xs outline-none transition focus:border-[#48C9B0]"
          />
        </div>

        {/* Filtro categoría — desktop */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as BudgetCategory | '')}
          className="hidden rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs outline-none transition focus:border-[#48C9B0] lg:block"
        >
          <option value="">Todas las categorías</option>
          {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{BUDGET_CATEGORY_LABELS[c]}</option>)}
        </select>

        {/* Filtro estatus — desktop, oculto en kanban */}
        {viewMode !== 'kanban' && (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="hidden rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs outline-none transition focus:border-[#48C9B0] lg:block"
          >
            <option value="">Todos los estatus</option>
            {SUPPLIER_STATUSES.map(s => <option key={s} value={s}>{SUPPLIER_STATUS_LABELS[s]}</option>)}
          </select>
        )}

        {/* Agrupación — solo cards desktop */}
        {viewMode === 'cards' && (
          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as GroupBy)}
            className="hidden rounded-lg border border-[#e0e0e0] bg-[#1D1E20] px-3 py-1.5 text-xs text-white outline-none lg:block"
          >
            <option value="ninguna">Sin agrupar</option>
            <option value="categoria">Por categoría</option>
            <option value="partida">Por concepto</option>
            <option value="estatus">Por estatus</option>
          </select>
        )}

        {/* Toggle vista */}
        <div className="flex items-center overflow-hidden rounded-lg border border-[#e0e0e0] bg-white">
          <ViewButton active={viewMode === 'cards'} onClick={() => setViewMode('cards')} title="Cards">
            <LayoutGrid size={14} />
          </ViewButton>
          <ViewButton active={viewMode === 'lista'} onClick={() => setViewMode('lista')} title="Lista" className="hidden lg:flex">
            <List size={14} />
          </ViewButton>
          <ViewButton active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')} title="Kanban" className="hidden lg:flex">
            <Columns3 size={14} />
          </ViewButton>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
        >
          <Plus size={14} />
          <span>Proveedor</span>
        </button>
      </div>

      {/* Contenido */}
      {filtered.length === 0 && items.length === 0 ? (
        <EmptyState onAdd={() => setModalOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa]">
          <p className="text-sm text-[#888]">Sin resultados con los filtros actuales</p>
        </div>
      ) : (
        <>
          {viewMode === 'cards' && (
            <CardsView items={filtered} budgets={budgets} currency={currency} groupBy={groupBy} onSelect={setSelectedItem} />
          )}
          {viewMode === 'lista' && (
            <div className="hidden lg:block">
              <SupplierListView items={filtered} budgets={budgets} currency={currency} onSelect={setSelectedItem} />
            </div>
          )}
          {viewMode === 'kanban' && (
            <div className="hidden lg:block">
              <SupplierKanbanView items={filtered} budgets={budgets} currency={currency} onSelect={setSelectedItem} onStatusChange={handleStatusChange} />
            </div>
          )}
        </>
      )}

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        budgets={budgets}
        onSubmit={handleCreateSupplier}
      />

      {selectedItem && (
        <SupplierDetailModal
          item={selectedItem}
          eventId={eventId}
          currency={currency}
          budgets={budgets}
          onClose={() => setSelectedItem(null)}
          onSaved={handleSavedItem}
          onDeleted={handleDeletedItem}
        />
      )}
    </div>
  )
}

function CardsView({ items, budgets, currency, groupBy, onSelect }: {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  groupBy: GroupBy
  onSelect: (item: SupplierWithDetails) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleGroup = (label: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  if (groupBy === 'ninguna') {
    return (
      <div className="grid grid-cols-1 gap-3 pb-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <SupplierCard key={item.id} item={item} budgets={budgets} currency={currency} onClick={() => onSelect(item)} />
        ))}
      </div>
    )
  }

  const seen = new Map<string, SupplierWithDetails[]>()
  items.forEach(item => {
    let key = ''
    if (groupBy === 'categoria') key = BUDGET_CATEGORY_LABELS[item.supplier.category] || 'Sin categoría'
    if (groupBy === 'estatus')   key = SUPPLIER_STATUS_LABELS[item.status] || item.status
    if (groupBy === 'partida') {
      const budget = budgets.find(b => b.id === item.event_budget_id)
      key = budget ? (budget.subcategory || BUDGET_CATEGORY_LABELS[budget.category]) : 'Sin concepto'
    }
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(item)
  })

  const groups: { label: string; items: SupplierWithDetails[] }[] = []
  seen.forEach((groupItems, label) => groups.push({ label, items: groupItems }))

  return (
    <div className="space-y-4 pb-6">
      {groups.map(g => {
        const isCollapsed = collapsed.has(g.label)
        return (
          <div key={g.label}>
            <button
              onClick={() => toggleGroup(g.label)}
              className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888] hover:text-[#1D1E20]"
            >
              <span className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
              {g.label}
              <span className="font-normal text-[#bbb]">({g.items.length})</span>
            </button>
            {!isCollapsed && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map(item => (
                  <SupplierCard key={item.id} item={item} budgets={budgets} currency={currency} onClick={() => onSelect(item)} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ViewButton({ active, onClick, title, children, className = '' }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode; className?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center px-2.5 py-1.5 transition ${active ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5] hover:text-[#1D1E20]'} ${className}`}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[#1D1E20]">{value}</p>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] p-6 text-center">
      <p className="text-sm font-semibold text-[#1D1E20]">Sin proveedores aún</p>
      <p className="mt-1 max-w-xs text-xs text-[#888]">Empieza agregando los proveedores con los que estás en contacto.</p>
      <button onClick={onAdd} className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896]">
        <Plus size={14} />
        Agregar proveedor
      </button>
    </div>
  )
}