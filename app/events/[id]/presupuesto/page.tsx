'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Search, FileSpreadsheet, FileText, Plus, Upload, X, AlertTriangle, Check, ChevronDown, Sparkles, SlidersHorizontal, ArrowRight, Minus } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import {
  Event, EventBudget, Currency, EventSupplier, Supplier,
} from '@/lib/types'
import { getEventCategories, categoryLabel } from './lib/categories'
import {
  leerMonto, planearImport, resumenImport, mensajeImportado,
  decidirRenombre, fechaDelArchivo, avisoArchivoViejo, FilaPlan,
} from '@/lib/presupuesto/import'
import { interpretarEscritura } from '@/lib/invite/persistencia'
import { BudgetCategoriesModal } from './BudgetCategoriesModal'
import { ImportStepsModal } from '@/app/components/ui/ImportStepsModal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import BudgetMetricsCards from '@/app/components/ui/BudgetMetricsCards'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import BudgetCategoryRow from './BudgetCategoryRow'
import BudgetItemModal from './BudgetItemModal'
import { buildBudgetItems, BudgetTier } from './lib/templates'
import { exportToExcel, exportToPDF, downloadImportTemplate } from './lib/exports'
import SupplierDetailModal from '../proveedores/SupplierDetailModal'
import SupplierReviewModal from '../proveedores/SupplierReviewModal'
import { Modal } from '@/app/components/ui/Modal'
import { Categoria, cargarCategorias, buscarPorNombre, nombrePorId } from '@/lib/rolodex/categorias-store'
import { mismaCategoria } from '@/lib/rolodex/categorias'

type EventSupplierWithName = EventSupplier & {
  supplier: Pick<Supplier, 'id' | 'name' | 'category'>
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

  const [showTierModal, setShowTierModal]   = useState(false)
  const [generating, setGenerating]         = useState(false)
  const [showImportHelp, setShowImportHelp] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const [modalOpen, setModalOpen]         = useState(false)
  const [modalCategory, setModalCategory] = useState<string | null>(null)

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importPlan, setImportPlan]           = useState<FilaPlan[]>([])
  const [importError, setImportError]         = useState('')
  const [importSuccess, setImportSuccess]     = useState('')
  const [avisoArchivo, setAvisoArchivo]       = useState('')
  const [importing, setImporting]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedSupplier, setSelectedSupplier] = useState<EventSupplierWithName | null>(null)
  const [reviewSupplier, setReviewSupplier]     = useState<EventSupplierWithName | null>(null)

  const [storedCategories, setStoredCategories]   = useState<string[] | null>(null)
  const [categorias, setCategorias]               = useState<Categoria[]>([])
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [addingCategory, setAddingCategory]       = useState(false)
  const [newCategoryName, setNewCategoryName]     = useState('')

  const statsToggle = useStatsToggle(eventId, 'presupuesto')
  const askConfirm  = useConfirm()

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

      const { data: { user } } = await supabase.auth.getUser()
      setCategorias(user ? await cargarCategorias(user.id) : [])
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
  filteredBudgets.forEach(b => {
    // El id manda, pero solo si sigue apuntando a una seccion visible de este
    // evento: un renombrado de Presupuesto (todavia solo texto, no toca la
    // tabla) dejaria el id senalando al nombre viejo, y sin esta comprobacion
    // la partida caeria en una seccion que ya no se dibuja y desaparecería.
    const nombreResuelto = b.category_id ? nombrePorId(categorias, b.category_id) : ''
    const seccion = nombreResuelto && categories.find(c => mismaCategoria(c, nombreResuelto))
    const key = seccion || b.category
    ;(itemsByCategory[key] ||= []).push(b)
  })

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setImportSuccess('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })

        // Buscar entre TODAS las hojas la que tenga la fila de encabezados (Categoria).
        // Se guardan todas las filas porque el sello de fecha puede vivir en otra hoja.
        let raw: any[] = []
        let headerIdx = -1
        const todasLasFilas: any[][] = []
        for (const sheetName of wb.SheetNames) {
          const sheetRows = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName], { header: 1 })
          todasLasFilas.push(...sheetRows)
          if (headerIdx !== -1) continue
          for (let i = 0; i < sheetRows.length; i++) {
            const row = (sheetRows[i] || []).map((c: any) => String(c || '').toLowerCase())
            if (row.includes('categoria') || row.includes('categoría')) {
              raw = sheetRows
              headerIdx = i
              break
            }
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

        const filas = []
        for (let i = headerIdx + 1; i < raw.length; i++) {
          const row = raw[i]
          if (!row || row.length === 0) continue

          const catRaw = String(row[catIdx] ?? '').trim()
          const conRaw = String(row[conIdx] ?? '').trim()

          if (!catRaw || !conRaw) continue
          if (conRaw.toLowerCase().startsWith('ejemplo:')) continue

          filas.push({
            categoria: catRaw,
            concepto:  conRaw,
            monto:     amtIdx >= 0 ? leerMonto(row[amtIdx]) : null,
          })
        }

        const plan = planearImport(filas, budgets, categories)

        if (plan.length === 0) {
          setImportError('No se encontraron conceptos válidos en el archivo.')
          return
        }

        const bajan = resumenImport(plan).bajan > 0
        setAvisoArchivo(avisoArchivoViejo(fechaDelArchivo(todasLasFilas), new Date(), bajan) ?? '')
        setImportPlan(plan)
        setImportModalOpen(true)
      } catch (err: any) {
        setImportError('Error leyendo el archivo. Asegúrate de que sea un .xlsx válido.')
        console.error(err)
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const decidirFila = (indice: number, esElMismo: boolean) => {
    setImportPlan(prev => prev.map((f, i) => i === indice ? decidirRenombre(f, esElMismo) : f))
  }

  const handleImport = async () => {
    setImporting(true)
    setImportError('')
    setImportSuccess('')
    try {
      const nuevos = importPlan.filter(f => f.accion === 'agregar')
      const cambios = importPlan.filter(f => f.accion === 'actualizar')

      if (nuevos.length === 0 && cambios.length === 0) { setImportModalOpen(false); return }

      if (nuevos.length > 0) {
        const { error } = await supabase
          .from('event_budgets')
          .insert(nuevos.map(f => ({
            event_id:          eventId,
            category:          f.categoria,
            category_id:       buscarPorNombre(categorias, f.categoria)?.id ?? null,
            subcategory:       f.concepto,
            budget_amount:     f.montoNuevo,
            event_supplier_id: null,
            notes:             null,
          })))
        if (error) throw error
      }

      // Se actualiza por id: el texto ya no se vuelve a comparar contra la base.
      // Y se piden las filas con .select() porque un UPDATE filtrado por RLS
      // devuelve cero filas SIN error (ver lib/invite/persistencia.ts).
      let actualizados = 0
      for (const f of cambios) {
        const res = await supabase
          .from('event_budgets')
          .update({ budget_amount: f.montoNuevo })
          .eq('id', f.partidaId!)
          .select('id')

        const resultado = interpretarEscritura(res)
        if (!resultado.ok) throw new Error(resultado.motivo)
        actualizados++
      }

      setImportModalOpen(false)
      setImportPlan([])
      setImportSuccess(mensajeImportado(nuevos.length, actualizados))
      await loadAll()
    } catch (err: any) {
      console.error('Error importando:', err?.message ?? err)
      setImportModalOpen(false)
      setImportPlan([])
      setImportError(err?.message ?? 'No se pudo terminar la importación. Revisa tu presupuesto e inténtalo de nuevo.')
      // La importacion pudo quedar a medias: se recarga para que la pantalla
      // muestre lo que de verdad quedo guardado.
      await loadAll()
    } finally {
      setImporting(false)
    }
  }

  const handleModalSubmit = async (data: {
    category: string
    category_id: string | null
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
    const ok = await askConfirm({
      title: item?.subcategory ? `¿Eliminar el concepto "${item.subcategory}"?` : '¿Eliminar este concepto?',
      message: item?.event_supplier_id
        ? 'Se pierde el monto estimado. El proveedor vinculado sigue en el evento.'
        : 'Se pierde el monto estimado de esta partida.',
    })
    if (!ok) return
    setBudgets(prev => prev.filter(b => b.id !== itemId))
    const { error } = await supabase.from('event_budgets').delete().eq('id', itemId)
    if (error) { console.error('Error borrando concepto:', error?.message ?? error, error); loadAll() }
  }

  const persistCategories = async (next: string[]) => {
    setStoredCategories(next)
    await supabase.from('event_settings').update({ budget_categories: next }).eq('event_id', eventId)
  }

  // Si dos pestanas crean la misma categoria a la vez, el indice unico
  // rechaza la segunda; se relee y se usa la que gano, sin mostrar error.
  const crearCategoriaSiNoExiste = async (name: string) => {
    if (buscarPorNombre(categorias, name)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name })
      .select('id, name, archived_at')
      .single()
    if (error) {
      if (error.code === '23505') {
        const { data: recargadas } = await supabase
          .from('categories').select('id, name, archived_at')
          .eq('user_id', user.id).order('name')
        if (recargadas) setCategorias(recargadas as Categoria[])
        return
      }
      console.error('Error creando categoria:', error.message)
      return
    }
    if (data) setCategorias(prev => [...prev, data as Categoria])
  }

  const addCategory = async (raw: string) => {
    const name = raw.trim()
    if (!name) return
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) return
    await crearCategoriaSiNoExiste(name)
    await persistCategories([...categories, name])
    setNewCategoryName(''); setAddingCategory(false)
  }

  const deleteCategory = async (name: string) => {
    const count = (itemsByCategory[name] || []).length
    if (count > 0) {
      const ok = await askConfirm({
        title: `¿Eliminar la categoría "${categoryLabel(name)}"?`,
        message: `Sus ${count === 1 ? 'concepto pasa' : `${count} conceptos pasan`} a "Otro". No se pierde ningún monto.`,
        confirmLabel: 'Eliminar categoría',
      })
      if (!ok) return
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
    const rowsConId = rows.map(r => ({ ...r, category_id: buscarPorNombre(categorias, r.category)?.id ?? null }))
    if (rowsConId.length > 0) await supabase.from('event_budgets').insert(rowsConId)
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
  const conteoImport   = resumenImport(importPlan)
  const porEscribir    = conteoImport.agregar + conteoImport.actualizar
  const pesos          = (n: number) => `$${Math.abs(n).toLocaleString('es-MX')}`
  const titularImport  = (() => {
    const partes: string[] = []
    if (conteoImport.agregar > 0) {
      partes.push(`agregar ${conteoImport.agregar} concepto${conteoImport.agregar !== 1 ? 's' : ''}`)
    }
    if (conteoImport.actualizar > 0) {
      partes.push(`cambiar ${conteoImport.actualizar} monto${conteoImport.actualizar !== 1 ? 's' : ''}`)
    }
    if (partes.length === 0) return 'Con este archivo no cambia nada de tu presupuesto.'
    return `Vas a ${partes.join(' y ')}.`
  })()

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

          <div className="relative hidden sm:block" data-budget-menu>
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
            className="hidden items-center gap-1.5 rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-3 py-1.5 text-xs font-semibold text-[#1a9e88] transition hover:bg-[#e0faf5] disabled:opacity-50 sm:flex"
          >
            <Sparkles size={14} />{generating ? 'Generando...' : 'Generar presupuesto'}
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

        {importSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#a0e0c0] bg-[#f0fff6] px-3 py-2">
            <Check size={14} className="shrink-0 text-[#2a7a50]" />
            <p className="text-xs text-[#2a7a50]">{importSuccess}</p>
            <button onClick={() => setImportSuccess('')} className="ml-auto text-[#8ccdb0] hover:text-[#2a7a50]">
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
        <Modal open onClose={() => { if (!generating) setShowTierModal(false) }} size="md">
          <Modal.Header
            title="Generar presupuesto de boda"
            subtitle="Elige el nivel. A mayor nivel, más categorías y conceptos. Sin montos: tú los defines."
            onClose={() => { if (!generating) setShowTierModal(false) }}
          />
          <Modal.Body>
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
          </Modal.Body>
        </Modal>
      )}

      {showCategoriesModal && (
        <BudgetCategoriesModal
          categories={categories}
          itemCountByCategory={Object.fromEntries(categories.map(c => [c, (itemsByCategory[c] || []).length]))}
          onAdd={addCategory}
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
        categorias={categorias}
        initialCategory={modalCategory}
        eventSuppliers={eventSuppliers}
        onSubmit={handleModalSubmit}
      />

      {/* ── MODAL AYUDA IMPORTAR (2 pasos, componente compartido) ── */}
      <ImportStepsModal
        open={showImportHelp}
        onClose={() => setShowImportHelp(false)}
        title="Importar presupuesto"
        subtitle="Trae tu presupuesto desde Excel en dos pasos."
        step1Desc="Viene con las categorías de tu evento y conceptos sugeridos. Llena los montos en Excel."
        downloadLabel="Descargar plantilla"
        onDownload={() => downloadImportTemplate({ categories, eventType: event?.event_type ?? null, eventCategory: event?.event_category ?? null })}
        step2Desc="Selecciona el Excel que llenaste (.xlsx). Verás una vista previa antes de guardar."
        selectLabel="Seleccionar archivo"
        onSelectFile={() => { setShowImportHelp(false); fileInputRef.current?.click() }}
      />

      {/* ── MODAL DE IMPORT ── */}
      <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)} size="lg">
        <Modal.Header
          title="Importar presupuesto"
          subtitle={`${importPlan.length} concepto${importPlan.length !== 1 ? 's' : ''} en el archivo`}
        />
        <Modal.Body>
          <div className="-mx-5 -mt-4 mb-4 space-y-2 border-b border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
            {avisoArchivo && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <AlertTriangle size={14} className="mt-px shrink-0 text-amber-500" />
                <p className="text-xs text-amber-800">{avisoArchivo}</p>
              </div>
            )}

            <p className="text-xs font-medium text-[#1D1E20]">{titularImport}</p>

            {(conteoImport.bajan > 0 || conteoImport.suben > 0) && (
              <p className="text-xs text-[#666]">
                {conteoImport.bajan > 0 && (
                  <span className="font-semibold text-amber-700">
                    {conteoImport.bajan} baja{conteoImport.bajan !== 1 ? 'n' : ''} (−{pesos(conteoImport.totalBaja)})
                  </span>
                )}
                {conteoImport.bajan > 0 && conteoImport.suben > 0 && <span className="text-[#ccc]"> · </span>}
                {conteoImport.suben > 0 && (
                  <span>{conteoImport.suben} sube{conteoImport.suben !== 1 ? 'n' : ''} (+{pesos(conteoImport.totalSube)})</span>
                )}
              </p>
            )}

            {conteoImport.porRevisar > 0 && (
              <p className="text-xs text-amber-800">
                {conteoImport.porRevisar} concepto{conteoImport.porRevisar !== 1 ? 's se parecen' : ' se parece'} a algo que ya tienes. Revísalo{conteoImport.porRevisar !== 1 ? 's' : ''} abajo antes de guardar.
              </p>
            )}

          </div>

          <div className="space-y-1">
            {importPlan.map((fila, idx) => {
              const omitida  = fila.accion === 'sin_cambios'
              const monto    = (n: number) => n > 0 ? `$${n.toLocaleString('es-MX')}` : '—'

              if (fila.candidato) {
                const esElMismo = fila.partidaId !== null
                return (
                  <div key={idx} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="flex items-center gap-3 text-xs">
                      <AlertTriangle size={13} className="shrink-0 text-amber-500" />
                      <span className="w-28 shrink-0 truncate text-[#888]">{categoryLabel(fila.categoria)}</span>
                      <span className="flex-1 truncate font-medium text-[#1D1E20]">{fila.concepto}</span>
                      {esElMismo && fila.accion === 'actualizar' ? (
                        <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                          <span className="text-[#bbb] line-through">{monto(fila.montoActual ?? 0)}</span>
                          <ArrowRight size={11} className="text-[#ccc]" />
                          <span className="font-semibold text-[#1D1E20]">{monto(fila.montoNuevo)}</span>
                        </span>
                      ) : (
                        <span className="shrink-0 tabular-nums text-[#888]">{monto(fila.montoNuevo)}</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                      <span className="text-[11px] text-amber-800">
                        ¿Es el mismo que <strong className="font-semibold">{fila.candidato.concepto}</strong>?
                      </span>
                      <button
                        onClick={() => decidirFila(idx, true)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          esElMismo
                            ? 'border-[#1D1E20] bg-[#1D1E20] text-white'
                            : 'border-amber-300 bg-white text-amber-800 hover:border-[#1D1E20]'
                        }`}
                      >
                        Es el mismo
                      </button>
                      <button
                        onClick={() => decidirFila(idx, false)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          !esElMismo
                            ? 'border-[#1D1E20] bg-[#1D1E20] text-white'
                            : 'border-amber-300 bg-white text-amber-800 hover:border-[#1D1E20]'
                        }`}
                      >
                        Es otro concepto
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
                    omitida ? 'opacity-40' : 'bg-[#fafafa]'
                  }`}
                >
                  <div className="shrink-0">
                    {fila.accion === 'agregar'
                      ? <Check size={13} className="text-[#48C9B0]" />
                      : fila.accion === 'actualizar'
                        ? <ArrowRight size={13} className="text-[#48C9B0]" />
                        : <Minus size={13} className="text-[#bbb]" />}
                  </div>
                  <span className="w-28 shrink-0 truncate text-[#888]">
                    {categoryLabel(fila.categoria)}
                  </span>
                  <span className="flex-1 truncate font-medium text-[#1D1E20]">{fila.concepto}</span>

                  {fila.accion === 'actualizar' ? (
                    <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                      <span className="text-[#bbb] line-through">{monto(fila.montoActual ?? 0)}</span>
                      <ArrowRight size={11} className="text-[#ccc]" />
                      <span className="font-semibold text-[#1D1E20]">{monto(fila.montoNuevo)}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 tabular-nums text-[#888]">{monto(fila.montoNuevo)}</span>
                  )}

                  {fila.accion === 'sin_cambios' && (
                    <span className="shrink-0 rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-semibold text-[#888]">
                      sin cambios
                    </span>
                  )}
                  {fila.accion === 'agregar' && (
                    <span className="shrink-0 rounded-full bg-[#e8f8f4] px-2 py-0.5 text-[10px] font-semibold text-[#1a9e88]">
                      nuevo
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setImportModalOpen(false)}
            disabled={importing}
            className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] hover:bg-[#f0f0f0] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={importing || porEscribir === 0}
            className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
          >
            {importing
              ? 'Importando...'
              : porEscribir === 0
                ? 'Nada que cambiar'
                : `Guardar ${porEscribir} cambio${porEscribir !== 1 ? 's' : ''}`
            }
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── SUPPLIER DETAIL DESDE PRESUPUESTO ── */}
      {selectedSupplier && (
        <SupplierDetailModal
          item={selectedSupplier as any}
          eventId={eventId}
          currency={currency}
          budgets={budgets}
          categorias={categorias}
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