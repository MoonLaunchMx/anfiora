'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Event, EventSupplier, Supplier, BudgetCategory, BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS,
  SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS, Currency, formatCurrency,
} from '@/lib/types'
import SupplierModal from './SupplierModal'
import SupplierCard from './SupplierCard'
import SupplierDetailModal from './SupplierDetailModal'

type SupplierWithDetails = EventSupplier & {
  supplier: Supplier
}

export default function ProveedoresPage() {
  const { id } = useParams()
  const eventId = id as string

  const [event, setEvent]           = useState<Event | null>(null)
  const [items, setItems]           = useState<SupplierWithDetails[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterCategory, setFilterCategory] = useState<BudgetCategory | ''>('')
  const [filterStatus, setFilterStatus]     = useState<string>('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [selectedItem, setSelectedItem] = useState<SupplierWithDetails | null>(null)

  useEffect(() => { if (eventId) loadAll() }, [eventId])

  const loadAll = async () => {
    setLoading(true)
    const [eventRes, suppliersRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase
        .from('event_suppliers')
        .select('*, supplier:suppliers(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
    ])

    if (eventRes.data)     setEvent(eventRes.data as Event)
    if (suppliersRes.data) setItems(suppliersRes.data as SupplierWithDetails[])

    setLoading(false)
  }

  const handleCreateSupplier = async (data: {
    name: string
    category: BudgetCategory
    subcategory: string | null
    phone: string | null
    phone_country_code: string | null
    instagram: string | null
    quoted_amount: number | null
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Sesión expirada'); return }

    const { data: newSupplier, error: supErr } = await supabase
      .from('suppliers')
      .insert({
        user_id:            user.id,
        name:               data.name,
        category:           data.category,
        subcategory:        data.subcategory,
        phone:              data.phone,
        phone_country_code: data.phone_country_code,
        instagram:          data.instagram,
        country:            'MX',
      })
      .select()
      .single()

    if (supErr) { console.error(supErr); throw supErr }

    const { data: newEventSupplier, error: esErr } = await supabase
      .from('event_suppliers')
      .insert({
        event_id:      eventId,
        supplier_id:   newSupplier.id,
        status:        'contactado',
        quoted_amount: data.quoted_amount,
      })
      .select('*, supplier:suppliers(*)')
      .single()

    if (esErr) { console.error(esErr); throw esErr }

    if (newEventSupplier) {
      setItems(prev => [newEventSupplier as SupplierWithDetails, ...prev])
    }
  }

  const handleSavedItem = (updated: SupplierWithDetails) => {
    setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
  }

  const handleDeletedItem = (deletedId: string) => {
    setItems(prev => prev.filter(it => it.id !== deletedId))
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
    if (filterStatus && item.status !== filterStatus) return false
    return true
  })

  const totalContacted   = items.length
  const totalNegotiating = items.filter(i => i.status === 'cotizacion' || i.status === 'negociacion').length
  const totalContracted  = items.filter(i => i.status === 'contratado').length
  const totalInvestment  = items
    .filter(i => i.status === 'contratado')
    .reduce((sum, i) => sum + (i.contract_amount || 0), 0)

  if (loading || !event) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-16 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="h-24 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-40 animate-pulse rounded-xl bg-[#f5f5f5]" />
          <div className="h-40 animate-pulse rounded-xl bg-[#f5f5f5]" />
          <div className="h-40 animate-pulse rounded-xl bg-[#f5f5f5]" />
        </div>
      </div>
    )
  }

  const currency: Currency = event.currency || 'MXN'

  return (
    <div className="overflow-y-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1D1E20] sm:text-3xl">Proveedores</h1>
        <p className="mt-1 text-sm text-[#888]">
          Gestiona todos los proveedores de tu evento, su estatus y cotizaciones.
        </p>
      </div>

      <div className="mb-6 hidden grid-cols-4 gap-3 sm:grid">
        <StatCard label="Contactados"   value={totalContacted.toString()} />
        <StatCard label="Negociando"    value={totalNegotiating.toString()} />
        <StatCard label="Contratados"   value={totalContracted.toString()} />
        <StatCard label="Inversión"     value={formatCurrency(totalInvestment, currency)} />
      </div>

      <div className="mb-6 rounded-xl border border-[#e8e8e8] bg-white p-4 sm:hidden">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Contactados" value={totalContacted.toString()} />
          <Stat label="Negociando"  value={totalNegotiating.toString()} />
          <Stat label="Contratados" value={totalContracted.toString()} />
          <Stat label="Inversión"   value={formatCurrency(totalInvestment, currency)} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor..."
            className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-9 pr-3 text-xs outline-none transition focus:border-[#48C9B0]"
          />
        </div>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as BudgetCategory | '')}
          className="hidden rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs outline-none transition focus:border-[#48C9B0] sm:block"
        >
          <option value="">Todas las categorías</option>
          {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{BUDGET_CATEGORY_LABELS[c]}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="hidden rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs outline-none transition focus:border-[#48C9B0] sm:block"
        >
          <option value="">Todos los estatus</option>
          {SUPPLIER_STATUSES.map(s => <option key={s} value={s}>{SUPPLIER_STATUS_LABELS[s]}</option>)}
        </select>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
        >
          <Plus size={14} />
          <span>Proveedor</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] p-6 text-center">
          {items.length === 0 ? (
            <>
              <p className="text-sm font-semibold text-[#1D1E20]">Sin proveedores aún</p>
              <p className="mt-1 max-w-xs text-xs text-[#888]">
                Empieza agregando los proveedores con los que estás en contacto. Lo mínimo: nombre, categoría y WhatsApp o Instagram.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896]"
              >
                <Plus size={14} />
                Agregar proveedor
              </button>
            </>
          ) : (
            <p className="text-sm text-[#888]">Sin resultados con los filtros actuales</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <SupplierCard
              key={item.id}
              item={item}
              currency={currency}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      <SupplierModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        onSubmit={handleCreateSupplier}
      />

      {selectedItem && (
        <SupplierDetailModal
          item={selectedItem}
          eventId={eventId}
          currency={currency}
          onClose={() => setSelectedItem(null)}
          onSaved={handleSavedItem}
          onDeleted={handleDeletedItem}
        />
      )}
    </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-[#1D1E20]">{value}</p>
    </div>
  )
}