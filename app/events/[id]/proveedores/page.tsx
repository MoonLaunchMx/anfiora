'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, Plus, LayoutGrid, List, Columns3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Event, EventBudget, EventSupplier, Supplier,
  SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, SupplierStatus, Currency, formatCurrency,
} from '@/lib/types'
import { Categoria, activas, cargarCategorias, nombrePorId } from '@/lib/rolodex/categorias-store'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import SupplierModal from './SupplierModal'
import SupplierCard from './SupplierCard'
import SupplierDetailModal from './SupplierDetailModal'
import SupplierReviewModal from './SupplierReviewModal'
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
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [groupBy, setGroupBy]   = useState<GroupBy>('categoria')
  const [modalOpen, setModalOpen]       = useState(false)
  const [selectedItem, setSelectedItem] = useState<SupplierWithDetails | null>(null)
  const [reviewItem, setReviewItem]     = useState<SupplierWithDetails | null>(null)

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

      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
      setCategorias(user ? await cargarCategorias(user.id) : [])
    } catch (err: any) {
      console.error('Error cargando proveedores:', err?.message ?? err, err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSupplier = async (data: {
    name: string
    category_id: string | null
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
        category_id:        data.category_id,
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

  const handleSavedItem   = (updated: SupplierWithDetails) =>
    setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
  const handleDeletedItem = (deletedId: string) =>
    setItems(prev => prev.filter(it => it.id !== deletedId))

  // Review se maneja desde page para evitar stacking context de Framer Motion
  const handleReviewNeeded = (item: SupplierWithDetails) => {
    setSelectedItem(null)
    setReviewItem(item)
  }

  const handleStatusChange = async (itemId: string, newStatus: SupplierStatus) => {
    const prev = items.find(i => i.id === itemId)
    setItems(p => p.map(it => it.id === itemId ? { ...it, status: newStatus } : it))
    const { error } = await supabase.from('event_suppliers').update({ status: newStatus }).eq('id', itemId)
    if (error) { console.error('Error actualizando status:', error?.message ?? error, error); loadAll() }

    // Review al arrastrar en kanban a estado final
    const wasAlreadyFinal = prev?.status === 'contratado' || prev?.status === 'descartado'
    const isNowFinal      = newStatus === 'contratado' || newStatus === 'descartado'
    if (!wasAlreadyFinal && isNowFinal && prev && !prev.rating && !prev.review_text) {
      setReviewItem({ ...prev, status: newStatus })
    }
  }

  const filtered = items.filter(item => {
    const s = item.supplier
    if (search.trim()) {
      const q = search.toLowerCase()
      const categoryName = nombrePorId(categorias, s.category_id)
      const match = s.name.toLowerCase().includes(q) ||
                    (s.subcategory || '').toLowerCase().includes(q) ||
                    categoryName.toLowerCase().includes(q)
      if (!match) return false
    }
    if (filterCategory && s.category_id !== filterCategory) return false
    return true
  })

  const categoriasDelFiltro = (() => {
    const lista = activas(categorias)
    const vistas = new Set(lista.map(c => c.id))
    items.forEach(it => {
      const catId = it.supplier?.category_id
      if (!catId || vistas.has(catId)) return
      const cat = categorias.find(c => c.id === catId)
      if (cat) { lista.push(cat); vistas.add(catId) }
    })
    return lista
  })()

  const totalNuevos      = items.filter(i => i.status === 'nuevo').length
  const totalCotizando   = items.filter(i => i.status === 'cotizado').length
  const totalContratados = items.filter(i => i.status === 'contratado').length
  const totalInvestment  = items
    .filter(i => i.status === 'contratado')
    .reduce((sum, i) => sum + (i.contract_amount || 0), 0)

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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>

      {/* ── HEADER FIJO ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #e8e8e8' }} className="px-4 pt-4 pb-0 sm:px-6 sm:pt-5">

        {/* Título + toggle stats mobile */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1D1E20]">Proveedores</h1>
            <p className="mt-0.5 text-xs text-[#888]">Cotizaciones, contratos y pagos en un solo lugar.</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
          </div>
        </div>

        {/* Stats */}
        <StatsCollapse visible={statsToggle.visible}>
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatCard label="Nuevos"      value={totalNuevos.toString()} />
            <StatCard label="Cotizando"   value={totalCotizando.toString()} />
            <StatCard label="Contratados" value={totalContratados.toString()} color="emerald" />
            <StatCard label="Inversión"   value={formatCurrency(totalInvestment, currency)} small />
          </div>
        </StatsCollapse>

        {/* ── TOOLBAR ── */}
        <div className="mb-3 flex items-center gap-2 pb-3">

          {/* Vistas con texto */}
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-[#e0e0e0]">
            <ViewButton active={viewMode === 'cards'} onClick={() => setViewMode('cards')}>
              <LayoutGrid size={13} />
              <span>Tarjetas</span>
            </ViewButton>
            <ViewButton active={viewMode === 'lista'} onClick={() => setViewMode('lista')} className="hidden lg:flex">
              <List size={13} />
              <span>Lista</span>
            </ViewButton>
            <ViewButton active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')} className="hidden lg:flex">
              <Columns3 size={13} />
              <span>Kanban</span>
            </ViewButton>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar proveedor..."
              className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[#48C9B0]"
            />
          </div>

          {/* Filtro categoría — solo desktop */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="hidden shrink-0 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs outline-none transition focus:border-[#48C9B0] lg:block"
          >
            <option value="">Todas las categorías</option>
            {categoriasDelFiltro.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Agrupación — solo en tarjetas, solo desktop */}
          {viewMode === 'cards' && (
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as GroupBy)}
              className="hidden shrink-0 rounded-lg border border-[#e0e0e0] bg-[#1D1E20] px-3 py-1.5 text-xs text-white outline-none lg:block"
            >
              <option value="ninguna">Sin agrupar</option>
              <option value="categoria">Por categoría</option>
              <option value="partida">Por concepto</option>
              <option value="estatus">Por estatus</option>
            </select>
          )}

          {/* CTA */}
          <button
            onClick={() => setModalOpen(true)}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
          >
            <Plus size={14} />
            <span>Proveedor</span>
          </button>
        </div>
      </div>

      {/* ── CONTENIDO SCROLLABLE ── */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="px-4 pb-6 pt-4 sm:px-6">
        {filtered.length === 0 && items.length === 0 ? (
          <EmptyState onAdd={() => setModalOpen(true)} />
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[30dvh] items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa]">
            <p className="text-sm text-[#888]">Sin resultados con los filtros actuales</p>
          </div>
        ) : (
          <>
            {viewMode === 'cards' && (
              <CardsView
                items={filtered}
                budgets={budgets}
                currency={currency}
                groupBy={groupBy}
                categorias={categorias}
                onSelect={setSelectedItem}
              />
            )}
            {viewMode === 'lista' && (
              <div className="hidden lg:block">
                <SupplierListView
                  items={filtered}
                  budgets={budgets}
                  currency={currency}
                  categorias={categorias}
                  onSelect={setSelectedItem}
                />
              </div>
            )}
            {viewMode === 'kanban' && (
              <div className="hidden lg:block">
                <SupplierKanbanView
                  items={filtered}
                  budgets={budgets}
                  currency={currency}
                  categorias={categorias}
                  onSelect={setSelectedItem}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODALES ── */}
      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        budgets={budgets}
        categorias={categorias}
        userId={userId ?? ''}
        onSubmit={handleCreateSupplier}
      />

      {selectedItem && (
        <SupplierDetailModal
          item={selectedItem}
          eventId={eventId}
          currency={currency}
          budgets={budgets}
          categorias={categorias}
          userId={userId ?? ''}
          onClose={() => setSelectedItem(null)}
          onSaved={handleSavedItem}
          onDeleted={handleDeletedItem}
          onReviewNeeded={handleReviewNeeded}
        />
      )}

      {/* Review fuera del DetailModal — evita stacking context de Framer Motion */}
      {reviewItem && (
        <SupplierReviewModal
          eventSupplierId={reviewItem.id}
          supplierName={reviewItem.supplier.name}
          initialRating={reviewItem.rating}
          initialReview={reviewItem.review_text}
          initialMood={reviewItem.mood}
          initialSpeed={reviewItem.response_speed}
          onSaved={updates => {
            setItems(prev => prev.map(it => it.id === reviewItem.id ? { ...it, ...updates } : it))
            setReviewItem(null)
          }}
          onSkip={() => setReviewItem(null)}
        />
      )}
    </div>
  )
}

// ── CARDS VIEW ─────────────────────────────────────────────────────────────

function CardsView({ items, budgets, currency, groupBy, categorias, onSelect }: {
  items: SupplierWithDetails[]
  budgets: EventBudget[]
  currency: Currency
  groupBy: GroupBy
  categorias: Categoria[]
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
          <SupplierCard key={item.id} item={item} budgets={budgets} currency={currency} categorias={categorias} onClick={() => onSelect(item)} />
        ))}
      </div>
    )
  }

  const seen = new Map<string, SupplierWithDetails[]>()
  items.forEach(item => {
    let key = ''
    if (groupBy === 'categoria') key = nombrePorId(categorias, item.supplier.category_id) || 'Sin categoría'
    if (groupBy === 'estatus')   key = SUPPLIER_STATUS_LABELS[item.status] || item.status
    if (groupBy === 'partida') {
      const budget = budgets.find(b => b.id === item.event_budget_id)
      key = budget ? (budget.subcategory || nombrePorId(categorias, budget.category_id)) : 'Sin concepto'
    }
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(item)
  })

  const groups: { label: string; items: SupplierWithDetails[] }[] = []
  seen.forEach((groupItems, label) => groups.push({ label, items: groupItems }))

  return (
    <div className="space-y-5 pb-6">
      {groups.map(g => {
        const isCollapsed = collapsed.has(g.label)
        return (
          <div key={g.label}>
            <button
              onClick={() => toggleGroup(g.label)}
              className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888] hover:text-[#1D1E20]"
            >
              <span className={`transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
              {g.label}
              <span className="font-normal text-[#bbb]">({g.items.length})</span>
            </button>
            {!isCollapsed && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map(item => (
                  <SupplierCard key={item.id} item={item} budgets={budgets} currency={currency} categorias={categorias} onClick={() => onSelect(item)} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── COMPONENTES AUXILIARES ─────────────────────────────────────────────────

function ViewButton({ active, onClick, children, className = '' }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-l border-[#e0e0e0] px-3 py-1.5 text-xs font-medium transition first:border-l-0 ${
        active ? 'bg-[#1D1E20] text-white' : 'bg-white text-[#888] hover:bg-[#f5f5f5] hover:text-[#1D1E20]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value, color, small }: {
  label: string
  value: string
  color?: 'emerald'
  small?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">{label}</p>
      <p className={`mt-1.5 tabular-nums font-bold ${small ? 'text-lg' : 'text-2xl'} ${
        color === 'emerald' ? 'text-[#1D9E75]' : 'text-[#1D1E20]'
      }`}>
        {value}
      </p>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] p-6 text-center">
      <p className="text-sm font-semibold text-[#1D1E20]">Sin proveedores aún</p>
      <p className="mt-1 max-w-xs text-xs text-[#888]">
        Empieza agregando los proveedores con los que estás en contacto.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896]"
      >
        <Plus size={14} />
        Agregar proveedor
      </button>
    </div>
  )
}