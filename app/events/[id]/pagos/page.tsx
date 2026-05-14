'use client'

import { useEffect, useState, useMemo, useRef, Fragment } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Receipt, Search, ChevronDown, ChevronRight,
  FileSpreadsheet, FileText, ArrowUpDown, ArrowUp, ArrowDown,
  Plus, X, Calendar, Trash2,
} from 'lucide-react'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import { exportPagosToExcel, exportPagosToPDF } from './lib/exports'

type Pago = {
  id: string
  amount: number
  payment_date: string
  payment_method: string | null
  paid_by: string | null
  reference: string | null
  supplier_name: string
  supplier_category: string
  event_supplier_id: string
}

type EventSupplierOption = {
  id: string
  supplier_name: string
}

type SortField = 'payment_date' | 'amount' | 'supplier_name' | 'payment_method' | 'paid_by'
type SortDir   = 'asc' | 'desc'

const METHOD_LABEL: Record<string, string> = {
  transferencia:   'Transferencia',
  efectivo:        'Efectivo',
  tarjeta_credito: 'Tarjeta crédito',
  tarjeta_debito:  'Tarjeta débito',
  cheque:          'Cheque',
  otro:            'Otro',
}

const METHOD_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  transferencia:   { bg: '#E6F1FB', border: '#B5D4F4', color: '#185FA5' },
  efectivo:        { bg: '#EAF3DE', border: '#C0DD97', color: '#3B6D11' },
  tarjeta_credito: { bg: '#EEEDFE', border: '#CECBF6', color: '#534AB7' },
  tarjeta_debito:  { bg: '#EEEDFE', border: '#CECBF6', color: '#534AB7' },
  cheque:          { bg: '#FAEEDA', border: '#FAC775', color: '#854F0B' },
  otro:            { bg: '#F1EFE8', border: '#D3D1C7', color: '#5F5E5A' },
}

const PAYMENT_METHODS = ['transferencia', 'efectivo', 'tarjeta_credito', 'tarjeta_debito', 'cheque', 'otro']

const PAID_BY_LABEL: Record<string, string> = {
  novia:       'Novia',
  novio:       'Novio',
  pareja:      'Pareja',
  papas_novia: 'Papás novia',
  papas_novio: 'Papás novio',
  familiar:    'Familiar',
  otro:        'Otro',
}

const PAID_BY_VALUES = ['novia', 'novio', 'pareja', 'papas_novia', 'papas_novio', 'familiar', 'otro']

function MethodIcon({ method }: { method: string | null }) {
  if (!method) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#f0f0f0] bg-[#fafafa]">
        <Receipt size={13} className="text-[#ddd]" />
      </div>
    )
  }
  const s = METHOD_STYLE[method] || { bg: '#f5f5f5', border: '#e0e0e0', color: '#888' }
  const abbr: Record<string, string> = {
    transferencia: 'TRF', efectivo: 'EFE', tarjeta_credito: 'TC',
    tarjeta_debito: 'TD', cheque: 'CHQ', otro: 'OTR',
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[9px] font-bold"
      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      {abbr[method] || method.slice(0, 3).toUpperCase()}
    </div>
  )
}

function fmt(amount: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
}

function fmtDate(d: string) {
  const [year, month, day] = d.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateShort(d: string) {
  const [year, month, day] = d.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function todayStr() { return new Date().toISOString().split('T')[0] }

export default function PagosPage() {
  const { id: eventId } = useParams()

  const [pagos, setPagos]                   = useState<Pago[]>([])
  const [eventSuppliers, setEventSuppliers] = useState<EventSupplierOption[]>([])
  const [eventName, setEventName]           = useState('')
  const [eventDate, setEventDate]           = useState<string | null>(null)
  const [loading, setLoading]               = useState(true)
  const [currency, setCurrency]             = useState('MXN')

  const [search, setSearch]                 = useState('')
  const [filterSupplier, setFilterSupplier] = useState<string>('todos')
  const [filterMethod, setFilterMethod]     = useState<string>('todos')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')
  const [dateRangeOpen, setDateRangeOpen]   = useState(false)

  const [supplierOpen, setSupplierOpen]     = useState(false)
  const [methodOpen, setMethodOpen]         = useState(false)
  const supplierRef  = useRef<HTMLDivElement>(null)
  const methodRef    = useRef<HTMLDivElement>(null)
  const dateRangeRef = useRef<HTMLDivElement>(null)

  const [collapsed, setCollapsed]           = useState<Set<string>>(new Set())
  const [sortField, setSortField]           = useState<SortField>('payment_date')
  const [sortDir, setSortDir]               = useState<SortDir>('desc')

  const [modalOpen, setModalOpen]           = useState(false)
  const [editingPago, setEditingPago]       = useState<Pago | null>(null)
  const [saving, setSaving]                 = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [newSupplier, setNewSupplier]       = useState('')
  const [newAmount, setNewAmount]           = useState('')
  const [newDate, setNewDate]               = useState(todayStr())
  const [newPaidBy, setNewPaidBy]           = useState('')
  const [newMethod, setNewMethod]           = useState('transferencia')
  const [newReference, setNewReference]     = useState('')
  const [modalSupplierOpen, setModalSupplierOpen] = useState(false)
  const modalSupplierRef = useRef<HTMLDivElement>(null)

  const statsToggle = useStatsToggle(eventId as string, 'pagos')

  const loadAll = async () => {
    setLoading(true)
    const [{ data: eventData }, { data: pagoData }, { data: suppliersData }] = await Promise.all([
      supabase.from('events').select('name, event_date, currency').eq('id', eventId).single(),
      supabase
        .from('supplier_payments')
        .select(`
          id, amount, payment_date, payment_method, paid_by, reference,
          event_suppliers!inner ( id, event_id, suppliers!inner ( name, category ) )
        `)
        .eq('event_suppliers.event_id', eventId)
        .order('payment_date', { ascending: false }),
      supabase
        .from('event_suppliers')
        .select('id, suppliers!inner(name)')
        .eq('event_id', eventId)
        .in('status', ['cotizado', 'contratado']),
    ])

    if (eventData) {
      setEventName(eventData.name || '')
      setEventDate(eventData.event_date || null)
      if (eventData.currency) setCurrency(eventData.currency)
    }
    if (pagoData) {
      setPagos((pagoData as any[]).map(p => ({
        id: p.id, amount: p.amount, payment_date: p.payment_date,
        payment_method: p.payment_method, paid_by: p.paid_by, reference: p.reference,
        event_supplier_id: p.event_suppliers.id,
        supplier_name: p.event_suppliers.suppliers.name,
        supplier_category: p.event_suppliers.suppliers.category,
      })))
    }
    if (suppliersData) {
      setEventSuppliers((suppliersData as any[]).map(es => ({ id: es.id, supplier_name: es.suppliers.name })))
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [eventId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current      && !supplierRef.current.contains(e.target as Node))      setSupplierOpen(false)
      if (methodRef.current        && !methodRef.current.contains(e.target as Node))        setMethodOpen(false)
      if (dateRangeRef.current     && !dateRangeRef.current.contains(e.target as Node))     setDateRangeOpen(false)
      if (modalSupplierRef.current && !modalSupplierRef.current.contains(e.target as Node)) setModalSupplierOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const suppliers = useMemo(() => [...new Set(pagos.map(p => p.supplier_name))].sort(), [pagos])
  const methods   = useMemo(() => [...new Set(pagos.map(p => p.payment_method).filter(Boolean))] as string[], [pagos])

  const filtered = useMemo(() => {
    let result = [...pagos]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.supplier_name.toLowerCase().includes(q) ||
        (p.paid_by || '').toLowerCase().includes(q) ||
        (p.reference || '').toLowerCase().includes(q)
      )
    }
    if (filterSupplier !== 'todos') result = result.filter(p => p.supplier_name === filterSupplier)
    if (filterMethod   !== 'todos') result = result.filter(p => p.payment_method === filterMethod)
    if (filterDateFrom)             result = result.filter(p => p.payment_date >= filterDateFrom)
    if (filterDateTo)               result = result.filter(p => p.payment_date <= filterDateTo)
    result.sort((a, b) => {
      let cmp = 0
      if (sortField === 'payment_date')   cmp = a.payment_date.localeCompare(b.payment_date)
      if (sortField === 'amount')         cmp = a.amount - b.amount
      if (sortField === 'supplier_name')  cmp = a.supplier_name.localeCompare(b.supplier_name)
      if (sortField === 'payment_method') cmp = (a.payment_method || '').localeCompare(b.payment_method || '')
      if (sortField === 'paid_by')        cmp = (a.paid_by || '').localeCompare(b.paid_by || '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [pagos, search, filterSupplier, filterMethod, filterDateFrom, filterDateTo, sortField, sortDir])

  const grouped = useMemo(() => {
    const map = new Map<string, Pago[]>()
    for (const p of filtered) {
      if (!map.has(p.supplier_name)) map.set(p.supplier_name, [])
      map.get(p.supplier_name)!.push(p)
    }
    return map
  }, [filtered])

  const totalPagado = filtered.reduce((s, p) => s + p.amount, 0)
  const totalPagos  = filtered.length
  const totalProvs  = new Set(filtered.map(p => p.supplier_name)).size
  const ultimoPago  = filtered.length > 0
    ? [...filtered].sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0].payment_date
    : null

  const dateRangeLabel = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return 'Fechas'
    return `${filterDateFrom ? fmtDate(filterDateFrom) : '...'} — ${filterDateTo ? fmtDate(filterDateTo) : '...'}`
  }, [filterDateFrom, filterDateTo])

  const hasDateFilter = !!(filterDateFrom || filterDateTo)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="text-[#ccc]" />
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-[#48C9B0]" /> : <ArrowDown size={11} className="text-[#48C9B0]" />
  }

  const getExportData = () => ({
    eventName, eventDate, currency,
    pagos: filtered.map(p => ({
      supplier_name: p.supplier_name, supplier_category: p.supplier_category,
      payment_date: p.payment_date, amount: p.amount,
      payment_method: p.payment_method, paid_by: p.paid_by, reference: p.reference,
    })),
  })

  const toggleGroup = (name: string) => {
    setCollapsed(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })
  }

  const resetModal = () => {
    setEditingPago(null)
    setNewSupplier(''); setNewAmount(''); setNewDate(todayStr())
    setNewPaidBy(''); setNewMethod('transferencia'); setNewReference('')
  }

  const openNuevo = () => { resetModal(); setModalOpen(true) }

  const openEditar = (pago: Pago) => {
    setEditingPago(pago)
    setNewSupplier(pago.event_supplier_id)
    setNewAmount(String(pago.amount))
    setNewDate(pago.payment_date)
    setNewPaidBy(pago.paid_by || '')
    setNewMethod(pago.payment_method || 'transferencia')
    setNewReference(pago.reference || '')
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); resetModal() }

  const handleSavePago = async () => {
    if (!newSupplier || !newAmount || !newDate) return
    const amount = parseFloat(newAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) return
    setSaving(true)
    try {
      if (editingPago) {
        const { error } = await supabase.from('supplier_payments').update({
          event_supplier_id: newSupplier, amount,
          payment_date: newDate, payment_method: newMethod || null,
          paid_by: newPaidBy || null, reference: newReference.trim() || null,
        }).eq('id', editingPago.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('supplier_payments').insert({
          event_supplier_id: newSupplier, amount,
          payment_date: newDate, payment_method: newMethod || null,
          paid_by: newPaidBy || null, reference: newReference.trim() || null,
        })
        if (error) throw error
      }
      closeModal(); await loadAll()
    } catch (err: any) {
      console.error('Error guardando pago:', err?.message ?? err)
      alert('No se pudo guardar el pago. Intenta de nuevo.')
    } finally { setSaving(false) }
  }

  const handleDeletePago = async () => {
    if (!editingPago) return
    if (!confirm('¿Eliminar este pago? Esta accion no se puede deshacer.')) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('supplier_payments').delete().eq('id', editingPago.id)
      if (error) throw error
      closeModal(); await loadAll()
    } catch (err: any) {
      console.error('Error eliminando pago:', err?.message ?? err)
      alert('No se pudo eliminar el pago. Intenta de nuevo.')
    } finally { setDeleting(false) }
  }

  const selectedSupplierName = eventSuppliers.find(es => es.id === newSupplier)?.supplier_name || ''
  const isEditing = !!editingPago

  if (loading) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        <div className="h-16 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="h-24 animate-pulse rounded-xl bg-[#f5f5f5]" />
        <div className="h-32 animate-pulse rounded-xl bg-[#f5f5f5]" />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div className="shrink-0 border-b border-[#e8e8e8] px-4 pt-4 pb-0 sm:px-6 sm:pt-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1D1E20]">Pagos</h1>
            <p className="mt-0.5 text-xs text-[#888]">Historial completo de pagos a proveedores.</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
          </div>
        </div>

        <StatsCollapse visible={statsToggle.visible}>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Total pagado</p>
              <p className="text-base font-bold text-[#48C9B0]">{fmt(totalPagado, currency)}</p>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Pagos</p>
              <p className="text-base font-bold text-[#1D1E20]">{totalPagos}</p>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Proveedores</p>
              <p className="text-base font-bold text-[#1D1E20]">{totalProvs}</p>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Ultimo pago</p>
              <p className="text-sm font-bold text-[#1D1E20]">{ultimoPago ? fmtDate(ultimoPago) : '—'}</p>
            </div>
          </div>
        </StatsCollapse>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full rounded-lg border border-[#e0e0e0] bg-white py-1.5 pl-9 pr-3 text-xs outline-none transition focus:border-[#48C9B0]" />
          </div>

          <div ref={supplierRef} className="relative shrink-0">
            <button onClick={() => { setSupplierOpen(p => !p); setMethodOpen(false); setDateRangeOpen(false) }}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition
                ${filterSupplier !== 'todos' ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white text-[#555] hover:border-[#aaa]'}`}>
              Proveedor <ChevronDown size={12} />
            </button>
            {supplierOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white shadow-lg">
                {['todos', ...suppliers].map(s => (
                  <button key={s} onClick={() => { setFilterSupplier(s); setSupplierOpen(false) }}
                    className={`flex w-full items-center px-3 py-2 text-left text-xs transition hover:bg-[#f8f5f0] ${filterSupplier === s ? 'font-semibold text-[#48C9B0]' : 'text-[#444]'}`}>
                    {s === 'todos' ? 'Todos los proveedores' : s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={methodRef} className="relative shrink-0">
            <button onClick={() => { setMethodOpen(p => !p); setSupplierOpen(false); setDateRangeOpen(false) }}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition
                ${filterMethod !== 'todos' ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white text-[#555] hover:border-[#aaa]'}`}>
              Metodo <ChevronDown size={12} />
            </button>
            {methodOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white shadow-lg">
                {['todos', ...methods].map(m => (
                  <button key={m} onClick={() => { setFilterMethod(m); setMethodOpen(false) }}
                    className={`flex w-full items-center px-3 py-2 text-left text-xs transition hover:bg-[#f8f5f0] ${filterMethod === m ? 'font-semibold text-[#48C9B0]' : 'text-[#444]'}`}>
                    {m === 'todos' ? 'Todos los metodos' : (METHOD_LABEL[m] || m)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={dateRangeRef} className="relative hidden shrink-0 sm:block">
            <button onClick={() => { setDateRangeOpen(p => !p); setSupplierOpen(false); setMethodOpen(false) }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition
                ${hasDateFilter ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white text-[#555] hover:border-[#aaa]'}`}>
              <Calendar size={12} />
              {dateRangeLabel}
              {hasDateFilter && (
                <span onClick={e => { e.stopPropagation(); setFilterDateFrom(''); setFilterDateTo('') }} className="ml-1 opacity-60 hover:opacity-100">
                  <X size={11} />
                </span>
              )}
            </button>
            {dateRangeOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white shadow-lg">
                <div className="flex flex-col gap-2 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Rango de fechas</p>
                  <div>
                    <p className="mb-1 text-[11px] text-[#888]">Desde</p>
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs outline-none focus:border-[#48C9B0]" />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-[#888]">Hasta</p>
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                      className="w-full rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs outline-none focus:border-[#48C9B0]" />
                  </div>
                  <button onClick={() => setDateRangeOpen(false)}
                    className="w-full rounded-lg bg-[#48C9B0] py-1.5 text-xs font-semibold text-white">Aplicar</button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => exportPagosToExcel(getExportData())}
            className="hidden items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={() => exportPagosToPDF(getExportData())}
            className="hidden items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex">
            <FileText size={13} /> PDF
          </button>
          <button onClick={openNuevo}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]">
            <Plus size={13} />
            <span className="hidden sm:inline">Nuevo pago</span>
            <span className="sm:hidden">Pago</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e8e8e8] py-20 text-center">
            <Receipt size={28} className="mb-3 text-[#ddd]" />
            <p className="text-xs font-medium text-[#bbb]">Sin pagos registrados</p>
            <p className="mt-1 text-[11px] text-[#ccc]">Agrega un pago con el boton "Nuevo pago"</p>
          </div>
        ) : (
          <>
            {/* MOBILE */}
            <div className="flex flex-col gap-2 sm:hidden">
              {[...grouped.entries()].map(([supplierName, items]) => {
                const isCollapsed = collapsed.has(supplierName)
                const subtotal = items.reduce((s, p) => s + p.amount, 0)
                return (
                  <div key={'mg-' + supplierName} className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
                    <div onClick={() => toggleGroup(supplierName)}
                      className="flex items-center gap-2 bg-[#f8f5f0] px-3 py-2.5 active:bg-[#f0ede8]">
                      {isCollapsed ? <ChevronRight size={13} className="shrink-0 text-[#aaa]" /> : <ChevronDown size={13} className="shrink-0 text-[#aaa]" />}
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#1D1E20]">{supplierName}</span>
                      <span className="shrink-0 rounded-full bg-[#e8e8e8] px-2 py-0.5 text-[10px] font-medium text-[#888]">
                        {items.length} {items.length === 1 ? 'pago' : 'pagos'}
                      </span>
                      <span className="shrink-0 ml-2 text-xs font-semibold text-[#1D1E20]">{fmt(subtotal, currency)}</span>
                    </div>
                    {!isCollapsed && items.map((pago, i) => (
                      <div key={pago.id}
                        onClick={() => openEditar(pago)}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 transition active:bg-[#f8f5f0] ${i < items.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                        <MethodIcon method={pago.payment_method} />
                        <span className="min-w-0 flex-1 truncate text-xs text-[#1D1E20]">
                          {pago.paid_by ? (PAID_BY_LABEL[pago.paid_by] || pago.paid_by) : <span className="text-[#ccc]">—</span>}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#aaa]" style={{ minWidth: '56px', textAlign: 'right' }}>
                          {fmtDateShort(pago.payment_date)}
                        </span>
                        <span className="shrink-0 ml-2 text-xs text-[#555]" style={{ minWidth: '72px', textAlign: 'right' }}>
                          {fmt(pago.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
              <div className="flex items-center justify-between rounded-xl border border-[#e8e8e8] bg-white px-4 py-3">
                <span className="text-xs font-semibold text-[#1D1E20]">Total</span>
                <span className="text-sm font-bold text-[#48C9B0]">{fmt(totalPagado, currency)}</span>
              </div>
            </div>

            {/* DESKTOP */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-[#e8e8e8]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e8e8e8] bg-[#f8f5f0]">
                    <th className="px-4 py-2.5 text-left">
                      <button onClick={() => toggleSort('supplier_name')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
                        Proveedor <SortIcon field="supplier_name" />
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-left">
                      <button onClick={() => toggleSort('payment_date')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
                        Fecha <SortIcon field="payment_date" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-2.5 text-left md:table-cell">
                      <button onClick={() => toggleSort('paid_by')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
                        Pagado por <SortIcon field="paid_by" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-2.5 text-left md:table-cell">
                      <button onClick={() => toggleSort('payment_method')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
                        Metodo <SortIcon field="payment_method" />
                      </button>
                    </th>
                    <th className="hidden px-4 py-2.5 text-left xl:table-cell">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Referencia</span>
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <button onClick={() => toggleSort('amount')} className="flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
                        Monto <SortIcon field="amount" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...grouped.entries()].map(([supplierName, items]) => {
                    const isCollapsed = collapsed.has(supplierName)
                    const subtotal = items.reduce((s, p) => s + p.amount, 0)
                    return (
                      <Fragment key={'dg-' + supplierName}>
                        <tr onClick={() => toggleGroup(supplierName)}
                          className="cursor-pointer border-b border-[#e8e8e8] bg-[#fafaf9] transition hover:bg-[#f5f2ed]">
                          <td className="px-4 py-2.5" colSpan={5}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight size={13} className="shrink-0 text-[#aaa]" /> : <ChevronDown size={13} className="shrink-0 text-[#aaa]" />}
                              <span className="font-semibold text-[#1D1E20]">{supplierName}</span>
                              <span className="rounded-full bg-[#e8e8e8] px-2 py-0.5 text-[10px] font-medium text-[#888]">
                                {items.length} {items.length === 1 ? 'pago' : 'pagos'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-[#1D1E20]">{fmt(subtotal, currency)}</td>
                        </tr>
                        {!isCollapsed && items.map(pago => (
                          <tr key={pago.id}
                            onClick={() => openEditar(pago)}
                            className="cursor-pointer border-b border-[#f0f0f0] transition hover:bg-[#fafaf9]">
                            <td className="px-4 py-2.5 pl-10 text-[#666]">{supplierName}</td>
                            <td className="px-4 py-2.5 text-[#888]">{fmtDate(pago.payment_date)}</td>
                            <td className="hidden px-4 py-2.5 text-[#888] md:table-cell">
                              {pago.paid_by ? (PAID_BY_LABEL[pago.paid_by] || pago.paid_by) : <span className="text-[#ccc]">—</span>}
                            </td>
                            <td className="hidden px-4 py-2.5 md:table-cell">
                              {pago.payment_method ? (() => {
                                const s = METHOD_STYLE[pago.payment_method] || { bg: '#f5f5f5', border: '#e0e0e0', color: '#888' }
                                return (
                                  <span className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                                    style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                                    {METHOD_LABEL[pago.payment_method] || pago.payment_method}
                                  </span>
                                )
                              })() : <span className="text-[#ccc]">—</span>}
                            </td>
                            <td className="hidden px-4 py-2.5 text-[#aaa] xl:table-cell">
                              {pago.reference || <span className="text-[#ccc]">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[#555]">{fmt(pago.amount, currency)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                  <tr className="border-t-2 border-[#e8e8e8] bg-white">
                    <td className="px-4 py-3 text-xs font-semibold text-[#1D1E20]" colSpan={5}>Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#48C9B0]">{fmt(totalPagado, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <>
          <div onClick={closeModal} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
                <h2 className="text-sm font-bold text-[#1D1E20]">
                  {isEditing ? 'Editar pago' : 'Nuevo pago'}
                </h2>
                <button onClick={closeModal}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#aaa] hover:bg-[#f5f5f5] hover:text-[#1D1E20]">
                  <X size={15} />
                </button>
              </div>

              <div className="flex flex-col gap-4 px-5 py-4">
                {/* Proveedor */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Proveedor *</p>
                  <div ref={modalSupplierRef} className="relative">
                    <button onClick={() => setModalSupplierOpen(p => !p)}
                      className="flex w-full items-center justify-between rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs transition focus:border-[#48C9B0]">
                      <span className={selectedSupplierName ? 'text-[#1D1E20]' : 'text-[#bbb]'}>
                        {selectedSupplierName || 'Selecciona un proveedor'}
                      </span>
                      <ChevronDown size={13} className="text-[#aaa]" />
                    </button>
                    {modalSupplierOpen && (
                      <div className="absolute left-0 top-full z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#e8e8e8] bg-white shadow-lg">
                        {eventSuppliers.length === 0
                          ? <p className="px-3 py-3 text-xs text-[#aaa]">No hay proveedores cotizados o contratados</p>
                          : eventSuppliers.map(es => (
                            <button key={es.id} onClick={() => { setNewSupplier(es.id); setModalSupplierOpen(false) }}
                              className={`flex w-full items-center px-3 py-2 text-left text-xs transition hover:bg-[#f8f5f0] ${newSupplier === es.id ? 'font-semibold text-[#48C9B0]' : 'text-[#444]'}`}>
                              {es.supplier_name}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Monto + Fecha */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Monto *</p>
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={newAmount}
                      onChange={e => setNewAmount(e.target.value)}
                      className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs outline-none transition focus:border-[#48C9B0]" />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Fecha *</p>
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                      className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs outline-none transition focus:border-[#48C9B0]" />
                  </div>
                </div>

                {/* Pagado por + Método — ambos select nativos */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Pagado por</p>
                    <select value={newPaidBy} onChange={e => setNewPaidBy(e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#1D1E20] outline-none transition focus:border-[#48C9B0]">
                      <option value="">Sin especificar</option>
                      {PAID_BY_VALUES.map(v => (
                        <option key={v} value={v}>{PAID_BY_LABEL[v]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Metodo</p>
                    <select value={newMethod} onChange={e => setNewMethod(e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#1D1E20] outline-none transition focus:border-[#48C9B0]">
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Referencia */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Referencia / notas</p>
                  <input type="text" placeholder="Opcional" value={newReference}
                    onChange={e => setNewReference(e.target.value)}
                    className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs outline-none transition focus:border-[#48C9B0]" />
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
                {isEditing ? (
                  <button onClick={handleDeletePago} disabled={deleting || saving}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[#cc3333] transition hover:bg-[#fff0f0] disabled:opacity-50">
                    <Trash2 size={13} />
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button onClick={closeModal} disabled={saving || deleting}
                    className="rounded-lg px-4 py-2 text-xs font-medium text-[#666] hover:bg-[#f0f0f0] disabled:opacity-50">
                    Cancelar
                  </button>
                  <button onClick={handleSavePago} disabled={saving || deleting || !newSupplier || !newAmount || !newDate}
                    className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50">
                    {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}