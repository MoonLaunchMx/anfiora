'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Search, FileSpreadsheet, FileText, Plus, Upload, X, AlertTriangle, Check, ChevronDown, Sparkles, SlidersHorizontal } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import {
  Event, EventBudget, BudgetCategory, BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS,
  Currency, EventSupplier, Supplier,
} from '@/lib/types'
import { getEventCategories, categoryLabel } from './lib/categories'
import { BudgetCategoriesModal } from './BudgetCategoriesModal'
import BudgetMetricsCards from '@/app/components/ui/BudgetMetricsCards'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import BudgetCategoryRow from './BudgetCategoryRow'
import BudgetItemModal from './BudgetItemModal'
import { buildBudgetItems, BudgetTier } from './lib/templates'
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
  category: string
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

  const [showTierModal, setShowTierModal]   = useState(false)
  const [generating, setGenerating]         = useState(false)
  const [showImportHelp, setShowImportHelp] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const [modalOpen, setModalOpen]         = useState(false)
  const [modalCategory, setModalCategory] = useState<string | null>(null)

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importRows, setImportRows]           = useState<ImportRow[]>([])
  const [importError, setImportError]         = useState('')
  const [importing, setImporting]             = useState(false)
  const [importMode, setImportMode]           = useState<'todos' | 'nuevos'>('nuevos')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedSupplier, setSelectedSupplier] = useState<EventSupplierWithName | null>(null)
  const [reviewSupplier, setReviewSupplier]     = useState<EventSupplierWithName | null>(null)

  const [storedCategories, setStoredCategories]   = useState<string[] | null>(null)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [addingCategory, setAddingCategory]       = useState(false)
  const [newCategoryName, setNewCategoryName]     = useState('')

  const statsToggle = useStatsToggle(eventId, 'presupuesto')

  useEffect(() => {
    if (!eventId) return
    loadAll()
  }, [eventId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-budget-menu]')) { setShowExportMenu(false) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

      setBudgets((budgetsRes.data || []) as EventBudget[])

      const { data: settingsRow } = await supabase
        .from('event_settings').select('budget_categories').eq('event_id', eventId).single()
      setStoredCategories((settingsRow?.budget_categories as string[] | null) ?? null)
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

  const categories = getEventCategories(storedCategories, event?.event_type ?? null, event?.event_category ?? null, budgets)

  const availableSuppliersByCategory: Record<string, EventSupplierWithName[]> = {}
  categories.forEach(cat => { availableSuppliersByCategory[cat] = [] })
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
        return b.subcategory.toLowerCase().includes(q) || categoryLabel(b.category).toLowerCase().includes(q)
      })
    : budgets

  const itemsByCategory: Record<string, EventBudget[]> = {}
  categories.forEach(cat => { itemsByCategory[cat] = [] })
  filteredBudgets.forEach(b => { (itemsByCategory[b.category] ||= []).push(b) })

  const totalBudget     = budgets.reduce((sum, b) => sum + b.budget_amount, 0)
  const totalContracted = budgets.reduce((sum, b) => sum + (contractedByItem[b.id] || 0), 0)
  const totalPaid       = budgets.reduce((sum, b) => sum + (paidByItem[b.id] || 0), 0)

  const openAddModalForCategory = (category: string) => {
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

        // Buscar entre TODAS las hojas la que tenga la fila de encabezados (Categoria)
        let raw: any[] = []
        let headerIdx = -1
        for (const sheetName of wb.SheetNames) {
          const sheetRows = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName], { header: 1 })
          for (let i = 0; i < sheetRows.length; i++) {
            const row = (sheetRows[i] || []).map((c: any) => String(c || '').toLowerCase())
            if (row.includes('categoria') || row.includes('categoría')) {
              raw = sheetRows
              headerIdx = i
              break
            }
          }
          if (headerIdx !== -1) break
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

          const category = LABEL_TO_CATEGORY[catRaw.toLowerCase()] ?? catRaw

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
      const news = importRows.filter(r => !r.isDuplicate)
      const dups = importMode === 'todos' ? importRows.filter(r => r.isDuplicate) : []

      if (news.length === 0 && dups.length === 0) { setImportModalOpen(false); return }

      if (news.length > 0) {
        const { error } = await supabase
          .from('event_budgets')
          .insert(news.map(r => ({
            event_id:          eventId,
            category:          r.category,
            subcategory:       r.subcategory,
            budget_amount:     r.budget_amount,
            event_supplier_id: null,
            notes:             null,
          })))
        if (error) throw error
      }

      // Modo "todos": actualizar el monto de los conceptos que ya existen (no re-insertar)
      for (const r of dups) {
        const { error } = await supabase
          .from('event_budgets')
          .update({ budget_amount: r.budget_amount })
          .eq('event_id', eventId).eq('category', r.category).eq('subcategory', r.subcategory)
        if (error) throw error
      }

      setImportModalOpen(false)
      setImportRows([])
      await loadAll()
    } catch (err: any) {
      console.error('Error importando:', err?.message ?? err)
      alert(`Error importando: ${err?.message ?? 'Intenta de nuevo'}`)
    } finally {
      setImporting(false)
    }
  }

  const handleModalSubmit = async (data: {
    category: string
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

  const persistCategories = async (next: string[]) => {
    setStoredCategories(next)
    await supabase.from('event_settings').update({ budget_categories: next }).eq('event_id', eventId)
  }

  const addCategory = async (raw: string) => {
    const name = raw.trim()
    if (!name) return
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) return
    await persistCategories([...categories, name])
    setNewCategoryName(''); setAddingCategory(false)
  }

  const renameCategory = async (oldName: string, raw: string) => {
    const name = raw.trim()
    if (!name || name === oldName) return
    await persistCategories(categories.map(c => c === oldName ? name : c))
    await supabase.from('event_budgets').update({ category: name }).eq('event_id', eventId).eq('category', oldName)
    loadAll()
  }

  const deleteCategory = async (name: string) => {
    const count = (itemsByCategory[name] || []).length
    if (count > 0) {
      if (!confirm(`"${categoryLabel(name)}" tiene ${count} concepto(s). Se moveran a "Otro". Continuar?`)) return
      const next = categories.filter(c => c !== name)
      if (!next.includes('Otro')) next.push('Otro')
      await persistCategories(next)
      await supabase.from('event_budgets').update({ category: 'Otro' }).eq('event_id', eventId).eq('category', name)
      loadAll()
    } else {
      await persistCategories(categories.filter(c => c !== name))
    }
  }

  const reorderCategories = (next: string[]) => persistCategories(next)

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!event) return
    const hosts = [event.host_name, event.host_name_2].filter(Boolean).join(' & ') || null
    const exportData = {
      eventName: event.name, eventDate: event.event_date, currency: event.currency,
      venue: event.venue, hosts,
      itemsByCategory, contractedByItem, paidByItem,
      totalBudget, totalContracted, totalPaid,
    }
    if (format === 'excel') exportToExcel(exportData)
    else await exportToPDF(exportData)
  }

  const handleGenerateClick = () => {
    if (event?.event_type === 'boda') { setShowTierModal(true); return }
    generateWith('esencial')
  }

  const generateWith = async (tier: BudgetTier) => {
    setGenerating(true)
    const existing = new Set(budgets.map(b => `${b.category}|${b.subcategory}`.toLowerCase()))
    const rows = buildBudgetItems(eventId, event?.event_type ?? null, event?.event_category ?? null, tier, existing)
    if (rows.length > 0) await supabase.from('event_budgets').insert(rows)
    const genCats = Array.from(new Set(rows.map(r => r.category as string)))
    const merged = [...categories]
    genCats.forEach(c => { if (!merged.some(x => x.toLowerCase() === c.toLowerCase())) merged.push(c) })
    if (merged.length !== categories.length) await persistCategories(merged)
    setShowTierModal(false)
    await loadAll()
    setGenerating(false)
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => setShowImportHelp(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
          >
            <Upload size={14} /><span className="hidden sm:inline">Importar</span>
          </button>

          <div className="relative" data-budget-menu>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
            >
              <FileText size={14} /><span className="hidden sm:inline">Exportar</span>
              <ChevronDown size={12} className="text-[#aaa]" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
                <button onClick={() => { setShowExportMenu(false); handleExport('excel') }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-[#1D1E20] hover:bg-[#f8f8f8]"><FileSpreadsheet size={13} className="text-[#888]" />Excel</button>
                <button onClick={() => { setShowExportMenu(false); handleExport('pdf') }} className="flex w-full items-center gap-2 border-t border-[#f0f0f0] px-4 py-2.5 text-left text-xs text-[#1D1E20] hover:bg-[#f8f8f8]"><FileText size={13} className="text-[#888]" />PDF</button>
              </div>
            )}
          </div>

          <button onClick={() => setShowCategoriesModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
            <SlidersHorizontal size={14} /><span className="hidden sm:inline">Categorías</span>
          </button>

          <button
            onClick={handleGenerateClick}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-3 py-1.5 text-xs font-semibold text-[#1a9e88] transition hover:bg-[#e0faf5] disabled:opacity-50"
          >
            <Sparkles size={14} /><span className="hidden sm:inline">{generating ? 'Generando...' : 'Generar presupuesto'}</span><span className="sm:hidden">Generar</span>
          </button>

          <button
            onClick={openAddModalGeneric}
            className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nuevo concepto</span>
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

        {budgets.length === 0 && !search.trim() && (
          <div className="mb-4 rounded-xl border border-dashed border-[#cfe9e2] bg-[#f0fdfb] px-5 py-6 text-center">
            <p className="text-sm font-semibold text-[#1D1E20]">Tu presupuesto está vacío</p>
            <p className="mt-1 text-xs text-[#888]">Genera un presupuesto sugerido según tu tipo de evento y ajústalo a tu gusto.</p>
            <button onClick={handleGenerateClick} disabled={generating} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-50">
              <Sparkles size={15} />{generating ? 'Generando...' : 'Generar presupuesto sugerido'}
            </button>
          </div>
        )}

        <div className="space-y-3">
          {categories.map(category => {
            const items = itemsByCategory[category] || []
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

          {!search.trim() && (addingCategory ? (
            <div className="flex items-center gap-2 px-1 py-2">
              <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory(newCategoryName); if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryName('') } }}
                placeholder="Nombre de la categoría" className="flex-1 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm outline-none focus:border-[#48C9B0]" />
              <button onClick={() => addCategory(newCategoryName)} className="rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3ab89f]">Agregar</button>
              <button onClick={() => { setAddingCategory(false); setNewCategoryName('') }} className="text-xs text-[#888] hover:text-[#1D1E20]">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setAddingCategory(true)} className="flex items-center gap-1.5 px-1 py-2 text-sm text-[#888] hover:text-[#48C9B0]">
              <Plus size={14} /> Agregar categoría
            </button>
          ))}
        </div>
      </div>

      {showTierModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!generating) setShowTierModal(false) }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1D1E20]">Generar presupuesto de boda</h2>
              <button onClick={() => { if (!generating) setShowTierModal(false) }} className="text-[#aaa] hover:text-[#555]"><X size={18} /></button>
            </div>
            <p className="mb-4 text-xs text-[#888]">Elige el nivel. A mayor nivel, más categorías y conceptos. Sin montos: tú los defines.</p>
            <div className="flex flex-col gap-2.5">
              {([
                { tier: 'esencial' as BudgetTier, label: 'Esencial', desc: 'Lo indispensable para tu boda.' },
                { tier: 'clasica' as BudgetTier,  label: 'Clásica',  desc: 'Boda completa estándar.' },
                { tier: 'premium' as BudgetTier,  label: 'Premium',  desc: 'Todo + extras (planner, valet, candy bar...).' },
              ]).map(o => (
                <button key={o.tier} onClick={() => generateWith(o.tier)} disabled={generating}
                  className="flex items-center justify-between rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 text-left transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] disabled:opacity-50">
                  <div>
                    <p className="text-sm font-semibold text-[#1D1E20]">{o.label}</p>
                    <p className="text-[11px] text-[#888]">{o.desc}</p>
                  </div>
                  <ChevronDown size={16} className="-rotate-90 text-[#bbb]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCategoriesModal && (
        <BudgetCategoriesModal
          categories={categories}
          itemCountByCategory={Object.fromEntries(categories.map(c => [c, (itemsByCategory[c] || []).length]))}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
          onReorder={reorderCategories}
          onClose={() => setShowCategoriesModal(false)}
        />
      )}

      {/* ── MODAL DE CONCEPTO ── */}
      <BudgetItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        categories={categories}
        initialCategory={modalCategory}
        eventSuppliers={eventSuppliers}
        onSubmit={handleModalSubmit}
      />

      {/* ── MODAL AYUDA IMPORTAR (2 pasos) ── */}
      {showImportHelp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowImportHelp(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1D1E20]">Importar presupuesto</h2>
              <button onClick={() => setShowImportHelp(false)} className="text-[#aaa] hover:text-[#555]"><X size={18} /></button>
            </div>
            <p className="mb-5 text-xs text-[#888]">Trae tu presupuesto desde Excel en dos pasos.</p>

            <div className="mb-5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#48C9B0] text-[11px] font-bold text-white">1</span>
                <span className="text-sm font-semibold text-[#1D1E20]">Descarga la plantilla</span>
              </div>
              <p className="mb-2 ml-7 text-xs text-[#666]">Viene con las categorías de tu evento y conceptos sugeridos. Llena los montos en Excel.</p>
              <button onClick={() => downloadImportTemplate({ categories, eventType: event?.event_type ?? null, eventCategory: event?.event_category ?? null })}
                className="ml-7 flex items-center gap-1.5 rounded-lg border border-[#48C9B0] px-4 py-2 text-xs font-medium text-[#1a9e88] transition hover:bg-[#f0fdfb]">
                <FileSpreadsheet size={14} /> Descargar plantilla
              </button>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#48C9B0] text-[11px] font-bold text-white">2</span>
                <span className="text-sm font-semibold text-[#1D1E20]">Sube tu archivo</span>
              </div>
              <p className="mb-2 ml-7 text-xs text-[#666]">Selecciona el Excel que llenaste (.xlsx). Verás una vista previa antes de guardar.</p>
              <button onClick={() => { setShowImportHelp(false); fileInputRef.current?.click() }}
                className="ml-7 flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f]">
                <Upload size={14} /> Seleccionar archivo
              </button>
            </div>
          </div>
        </div>
      )}

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
                          {categoryLabel(row.category)}
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