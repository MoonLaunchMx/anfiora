'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Search, FileSpreadsheet, FileText, Plus, Upload, X, AlertTriangle, Check } from 'lucide-react'
import * as XLSX from 'xlsx'
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
import { exportToExcel, exportToPDF, downloadImportTemplate } from './lib/exports'
import SupplierDetailModal from '../proveedores/SupplierDetailModal'
import SupplierReviewModal from '../proveedores/SupplierReviewModal'

type EventSupplierWithName = EventSupplier & {
  supplier: Pick<Supplier, 'id' | 'name' | 'category'>
}

type SupplierPaymentRow = {
  id: string
  event_supplier_id: string
  amount: number
}

type ImportRow = {
  category: BudgetCategory
  subcategory: string
  budget_amount: number
  isDuplicate: boolean
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

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importRows, setImportRows]           = useState<ImportRow[]>([])
  const [importError, setImportError]         = useState('')
  const [importing, setImporting]             = useState(false)
  const [importMode, setImportMode]           = useState<'todos' | 'nuevos'>('nuevos')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedSupplier, setSelectedSupplier] = useState<EventSupplierWithName | null>(null)
  const [reviewSupplier, setReviewSupplier]     = useState<EventSupplierWithName | null>(null)

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
        if (paymentsError) console.error('Error cargando pagos:', paymentsError?.message ?? paymentsError)
        setPayments((paymentsData || []) as SupplierPaymentRow[])
      } else {
        setPayments([])
      }

      let currentBudgets = (budgetsRes.data || []) as EventBudget[]
      if (currentBudgets.length === 0) {
        const seed = buildSeedBudgets(eventId)
        const { data: inserted, error: seedError } = await supabase.from('event_budgets').insert(seed).select()
        if (seedError) console.error('Error sembrando presupuesto:', seedError?.message ?? seedError)
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
    if (es.status !== 'contratado') return
    const cat = es.supplier.category
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

  const LABEL_TO_CATEGORY: Record<string, BudgetCategory> = {}
  BUDGET_CATEGORIES.forEach(cat => {
    LABEL_TO_CATEGORY[BUDGET_CATEGORY_LABELS[cat].toLowerCase()] = cat
    LABEL_TO_CATEGORY[cat.toLowerCase()] = cat
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })

        let headerIdx = -1
        for (let i = 0; i < raw.length; i++) {
          const row = raw[i].map((c: any) => String(c || '').toLowerCase())
          if (row.includes('categoria') || row.includes('categoría')) {
            headerIdx = i
            break
          }
        }

        if (headerIdx === -1) {
          setImportError('No se encontró la fila de encabezados. Usa la plantilla de Anfiora.')
          return
        }

        const headers = raw[headerIdx].map((c: any) => String(c || '').toLowerCase())
        const catIdx  = headers.findIndex((h: string) => h.includes('categor'))
        const conIdx  = headers.findIndex((h: string) => h.includes('concepto') || h.includes('partida'))
        const amtIdx  = headers.findIndex((h: string) => h.includes('presupuesto') || h.includes('estimado') || h.includes('monto'))

        if (catIdx === -1 || conIdx === -1) {
          setImportError('El archivo debe tener columnas "Categoria" y "Concepto".')
          return
        }

        const parsed: ImportRow[] = []
        const existingKeys = new Set(
          budgets.map(b => `${b.category}||${b.subcategory.toLowerCase().trim()}`)
        )

        for (let i = headerIdx + 1; i < raw.length; i++) {
          const row = raw[i]
          if (!row || row.length === 0) continue

          const catRaw = String(row[catIdx] || '').trim()
          const conRaw = String(row[conIdx] || '').trim()
          const amtRaw = amtIdx >= 0 ? Number(row[amtIdx]) || 0 : 0

          if (!catRaw || !conRaw) continue
          if (conRaw.toLowerCase().startsWith('ejemplo:')) continue

          const category = LABEL_TO_CATEGORY[catRaw.toLowerCase()]
          if (!category) continue

          const isDuplicate = existingKeys.has(`${category}||${conRaw.toLowerCase()}`)
          parsed.push({ category, subcategory: conRaw, budget_amount: amtRaw, isDuplicate })
        }

        if (parsed.length === 0) {
          setImportError('No se encontraron conceptos válidos en el archivo.')
          return
        }

        setImportRows(parsed)
        setImportModalOpen(true)
      } catch (err: any) {
        setImportError('Error leyendo el archivo. Asegúrate de que sea un .xlsx válido.')
        console.error(err)
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const toInsert = importMode === 'todos'
        ? importRows
        : importRows.filter(r => !r.isDuplicate)

      if (toInsert.length === 0) { setImportModalOpen(false); return }

      const { data: inserted, error } = await supabase
        .from('event_budgets')
        .insert(toInsert.map(r => ({
          event_id:          eventId,
          category:          r.category,
          subcategory:       r.subcategory,
          budget_amount:     r.budget_amount,
          event_supplier_id: null,
          notes:             null,
        })))
        .select()

      if (error) throw error
      if (inserted) setBudgets(prev => [...prev, ...(inserted as EventBudget[])])
      setImportModalOpen(false)
      setImportRows([])
    } catch (err: any) {
      console.error('Error importando:', err?.message ?? err)
      alert(`Error importando: ${err?.message ?? 'Intenta de nuevo'}`)
    } finally {
      setImporting(false)
    }
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
          alert('Ya existe un concepto con ese nombre en esta categoría')
        } else {
          console.error('Error creando concepto:', error?.message ?? error, error)
          alert(`No se pudo crear el concepto: ${error?.message ?? 'Intenta de nuevo'}`)
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
    if (error) { console.error('Error actualizando concepto:', error?.message ?? error, error); loadAll() }
  }

  const handleDeleteItem = async (itemId: string) => {
    const item = budgets.find(b => b.id === itemId)
    const confirmText = item?.subcategory ? `¿Borrar el concepto "${item.subcategory}"?` : '¿Borrar este concepto?'
    if (!confirm(confirmText)) return
    setBudgets(prev => prev.filter(b => b.id !== itemId))
    const { error } = await supabase.from('event_budgets').delete().eq('id', itemId)
    if (error) { console.error('Error borrando concepto:', error?.message ?? error, error); loadAll() }
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
  const duplicateCount = importRows.filter(r => r.isDuplicate).length
  const newCount       = importRows.filter(r => !r.isDuplicate).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ══ TOOLBAR STICKY ══ */}
      <div className="shrink-0 border-b border-[#e8e8e8] px-4 pt-4 pb-0 sm:px-6 sm:pt-5">

        {/* Título + toggle stats mobile */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1D1E20]">Presupuesto</h1>
            <p className="mt-0.5 text-xs text-[#888]">Planea tus gastos y vincula a tus proveedores contratados.</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
          </div>
        </div>

        {/* Stats colapsables mobile, siempre visibles desktop */}
        <StatsCollapse visible={statsToggle.visible}>
          <div className="mb-4">
            <BudgetMetricsCards
              totalBudget={totalBudget}
              totalContracted={totalContracted}
              totalPaid={totalPaid}
              currency={currency}
            />
          </div>
        </StatsCollapse>

        {/* Toolbar: buscador + botones + CTA */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar concepto..."
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex"
          >
            <Upload size={14} />
            Importar
          </button>

          <button
            onClick={downloadImportTemplate}
            className="hidden items-center gap-1.5 rounded-lg border border-dashed border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#aaa] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex"
          >
            <FileSpreadsheet size={14} />
            Plantilla
          </button>

          <button
            onClick={openAddModalGeneric}
            className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
          >
            <Plus size={14} />
            <span>Nuevo concepto</span>
          </button>
        </div>
      </div>

      {/* ══ CONTENIDO SCROLLEABLE ══ */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-6">

        {importError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">{importError}</p>
            <button onClick={() => setImportError('')} className="ml-auto text-amber-400 hover:text-amber-600">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="space-y-3">
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
                onOpenSupplier={setSelectedSupplier}
              />
            )
          })}
        </div>
      </div>

      {/* ── MODAL DE CONCEPTO ── */}
      <BudgetItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        initialCategory={modalCategory}
        eventSuppliers={eventSuppliers}
        onSubmit={handleModalSubmit}
      />

      {/* ── MODAL DE IMPORT ── */}
      {importModalOpen && (
        <>
          <div
            onClick={() => setImportModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">

              <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-[#1D1E20]">Importar presupuesto</h2>
                  <p className="text-xs text-[#888]">
                    {importRows.length} concepto{importRows.length !== 1 ? 's' : ''} encontrado{importRows.length !== 1 ? 's' : ''}
                    {duplicateCount > 0 && ` · ${duplicateCount} duplicado${duplicateCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#aaa] hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
                >
                  <X size={16} />
                </button>
              </div>

              {duplicateCount > 0 && (
                <div className="shrink-0 border-b border-[#f0f0f0] bg-amber-50 px-5 py-3">
                  <p className="mb-2 text-xs font-semibold text-amber-700">
                    {duplicateCount} concepto{duplicateCount !== 1 ? 's' : ''} ya existe{duplicateCount === 1 ? '' : 'n'} en tu presupuesto
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setImportMode('nuevos')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        importMode === 'nuevos'
                          ? 'border-[#1D1E20] bg-[#1D1E20] text-white'
                          : 'border-[#e0e0e0] bg-white text-[#555] hover:border-[#1D1E20]'
                      }`}
                    >
                      Solo importar nuevos ({newCount})
                    </button>
                    <button
                      onClick={() => setImportMode('todos')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        importMode === 'todos'
                          ? 'border-[#1D1E20] bg-[#1D1E20] text-white'
                          : 'border-[#e0e0e0] bg-white text-[#555] hover:border-[#1D1E20]'
                      }`}
                    >
                      Importar todos ({importRows.length})
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-3">
                <div className="space-y-1">
                  {importRows.map((row, idx) => {
                    const skip = importMode === 'nuevos' && row.isDuplicate
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
                          skip ? 'opacity-40' : 'bg-[#fafafa]'
                        }`}
                      >
                        <div className="shrink-0">
                          {row.isDuplicate ? (
                            <span title="Duplicado" className="text-amber-500">
                              <AlertTriangle size={13} />
                            </span>
                          ) : (
                            <Check size={13} className="text-[#48C9B0]" />
                          )}
                        </div>
                        <span className="w-28 shrink-0 text-[#888]">
                          {BUDGET_CATEGORY_LABELS[row.category]}
                        </span>
                        <span className="flex-1 font-medium text-[#1D1E20]">{row.subcategory}</span>
                        <span className="shrink-0 tabular-nums text-[#888]">
                          {row.budget_amount > 0 ? `$${row.budget_amount.toLocaleString('es-MX')}` : '—'}
                        </span>
                        {row.isDuplicate && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            duplicado
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
                <button
                  onClick={() => setImportModalOpen(false)}
                  disabled={importing}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-[#666] hover:bg-[#f0f0f0] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || (importMode === 'nuevos' && newCount === 0)}
                  className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
                >
                  {importing
                    ? 'Importando...'
                    : `Importar ${importMode === 'nuevos' ? newCount : importRows.length} concepto${(importMode === 'nuevos' ? newCount : importRows.length) !== 1 ? 's' : ''}`
                  }
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── SUPPLIER DETAIL DESDE PRESUPUESTO ── */}
      {selectedSupplier && (
        <SupplierDetailModal
          item={selectedSupplier as any}
          eventId={eventId}
          currency={currency}
          budgets={budgets}
          onClose={() => setSelectedSupplier(null)}
          onSaved={updated => {
            setEventSuppliers(prev => prev.map(es => es.id === updated.id ? { ...es, ...updated } : es))
            setSelectedSupplier(null)
          }}
          onDeleted={deletedId => {
            setEventSuppliers(prev => prev.filter(es => es.id !== deletedId))
            setSelectedSupplier(null)
          }}
          onReviewNeeded={item => {
            setSelectedSupplier(null)
            setReviewSupplier(item as any)
          }}
        />
      )}

      {reviewSupplier && (
        <SupplierReviewModal
          eventSupplierId={reviewSupplier.id}
          supplierName={reviewSupplier.supplier.name}
          initialRating={(reviewSupplier as any).rating ?? null}
          initialReview={(reviewSupplier as any).review_text ?? null}
          initialMood={(reviewSupplier as any).mood ?? null}
          initialSpeed={(reviewSupplier as any).response_speed ?? null}
          onSaved={() => { setReviewSupplier(null); loadAll() }}
          onSkip={() => setReviewSupplier(null)}
        />
      )}
    </div>
  )
}