'use client'

import { useState, useEffect, useRef } from 'react'
import { Trash2, Plus, X, Briefcase, AlertTriangle, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  EventBudget, EventSupplier, Supplier,
  Currency, formatCurrency,
} from '@/lib/types'

type EventSupplierWithName = EventSupplier & {
  supplier: Pick<Supplier, 'id' | 'name' | 'category_id'>
}

type Props = {
  item: EventBudget
  categoryName: string
  currency: Currency
  contractedAmount: number
  paidAmount: number
  availableSuppliers: EventSupplierWithName[]
  linkedSupplier: EventSupplierWithName | null
  onUpdate: (id: string, updates: { subcategory?: string; budget_amount?: number; event_supplier_id?: string | null; contract_amount?: number | null }) => void
  onDelete: (id: string) => void
  onOpenSupplier: (supplier: EventSupplierWithName) => void
  puedeEditar: boolean
  puedeBorrar: boolean
}

export default function BudgetItemRow({
  item, categoryName, currency, contractedAmount, paidAmount,
  availableSuppliers, linkedSupplier,
  onUpdate, onDelete, onOpenSupplier,
  puedeEditar, puedeBorrar,
}: Props) {
  const [localName, setLocalName]         = useState(item.subcategory || '')
  const [localAmount, setLocalAmount]     = useState(item.budget_amount.toString())
  const [amountFocused, setAmountFocused] = useState(false)
  const [pickerOpen, setPickerOpen]       = useState(false)
  const [pickerQuery, setPickerQuery]     = useState('')
  // Lo contratado se edita aqui mismo, como lo estimado. Vive en la partida.
  const [localContract, setLocalContract] = useState(item.contract_amount != null ? String(item.contract_amount) : '')
  const [contractFocused, setContractFocused] = useState(false)

  useEffect(() => { setLocalName(item.subcategory || '') }, [item.subcategory])
  useEffect(() => { setLocalAmount(item.budget_amount.toString()) }, [item.budget_amount])
  useEffect(() => { setLocalContract(item.contract_amount != null ? String(item.contract_amount) : '') }, [item.contract_amount])

  const safeSuppliers = availableSuppliers || []
  const pendingAmount = contractedAmount - paidAmount
  const hasNoData     = !linkedSupplier
  const isOverBudget  = !hasNoData && contractedAmount > item.budget_amount && item.budget_amount > 0

  const lastSavedName   = useRef(item.subcategory || '')
  const lastSavedAmount = useRef(item.budget_amount)
  const lastSavedContract = useRef<number | null>(item.contract_amount ?? null)
  const pickerRef       = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [pickerOpen])

  const saveName = () => {
    const trimmed = localName.trim()
    if (trimmed !== lastSavedName.current) {
      onUpdate(item.id, { subcategory: trimmed })
      lastSavedName.current = trimmed
    }
  }

  const saveAmount = () => {
    setAmountFocused(false)
    const parsed = parseFloat(localAmount) || 0
    if (parsed !== lastSavedAmount.current) {
      onUpdate(item.id, { budget_amount: parsed })
      lastSavedAmount.current = parsed
    }
  }

  // Al ligar, lo contratado arranca igual a lo estimado: es la mejor
  // suposicion y se corrige en la misma fila.
  const handleLinkSupplier = (eventSupplierId: string) => {
    onUpdate(item.id, { event_supplier_id: eventSupplierId, contract_amount: item.contract_amount ?? item.budget_amount })
    setPickerOpen(false)
    setPickerQuery('')
  }

  const handleUnlinkSupplier = () => {
    onUpdate(item.id, { event_supplier_id: null, contract_amount: null })
  }

  const saveContract = () => {
    setContractFocused(false)
    const parsed = localContract.trim() === '' ? null : (parseFloat(localContract) || 0)
    if (parsed !== lastSavedContract.current) {
      onUpdate(item.id, { contract_amount: parsed })
      lastSavedContract.current = parsed
    }
  }

  const contractDisplay = contractFocused
    ? localContract
    : formatCurrency(parseFloat(localContract) || 0, currency)

  const suppliersFiltrados = pickerQuery.trim()
    ? safeSuppliers.filter(es => es.supplier.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
    : safeSuppliers

  const amountDisplay = amountFocused
    ? localAmount
    : formatCurrency(parseFloat(localAmount) || 0, currency)

  const pendingColorClass = hasNoData
    ? 'text-[#bbb]'
    : (pendingAmount < 0 || isOverBudget)
      ? 'text-amber-600 font-semibold'
      : 'text-[#888]'

  const SupplierBlock = () => (
    <div className="relative" ref={pickerRef}>
      {linkedSupplier ? (
        // Proveedor vinculado — clickeable para abrir DetailModal
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[#f8f5f0] px-2 py-1 text-xs text-[#1D1E20]">
          <Briefcase size={11} className="shrink-0 text-[#888]" />
          <button
            onClick={() => onOpenSupplier(linkedSupplier)}
            className="truncate max-w-[180px] font-medium text-[#1D1E20] transition hover:text-[#48C9B0]"
          >
            {linkedSupplier.supplier.name}
          </button>
          <button
            onClick={() => onOpenSupplier(linkedSupplier)}
            className="text-[#aaa] transition hover:text-[#48C9B0]"
            title="Ver proveedor"
          >
            <ExternalLink size={10} />
          </button>
          {puedeEditar && (
            <button
              onClick={handleUnlinkSupplier}
              className="flex h-4 w-4 items-center justify-center rounded text-[#aaa] transition hover:bg-white hover:text-red-500"
              title="Desvincular proveedor"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ) : !puedeEditar ? (
        <span className="text-[11px] italic text-[#bbb]">Sin proveedor vinculado</span>
      ) : safeSuppliers.length > 0 ? (
        <button
          onClick={() => setPickerOpen(v => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#48C9B0] bg-white px-2 py-1 text-[11px] font-medium text-[#48C9B0] transition hover:bg-[#48C9B0]/5"
        >
          <Plus size={11} />
          Vincular proveedor
        </button>
      ) : (
        <span className="text-[11px] italic text-[#bbb]">Sin proveedores contratados</span>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            key={`picker-${item.id}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full z-30 mt-1 w-[280px] overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-lg"
          >
            <div className="border-b border-[#f0f0f0] bg-[#1D1E20] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Proveedores contratados · {safeSuppliers.length}
              </p>
            </div>
            <div className="border-b border-[#f0f0f0] px-2 py-1.5">
              <input
                autoFocus
                type="text"
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                placeholder="Buscar proveedor…"
                className="w-full rounded-md border border-[#e8e8e8] bg-[#fafafa] px-2 py-1.5 text-xs outline-none focus:border-[#48C9B0]"
              />
            </div>
            <div className="max-h-[240px] overflow-y-auto py-1">
              {suppliersFiltrados.length === 0 && (
                <p className="px-3 py-2 text-[11px] italic text-[#bbb]">Sin coincidencias</p>
              )}
              {suppliersFiltrados.map(es => (
                <button
                  key={es.id}
                  onClick={() => handleLinkSupplier(es.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-[#f8f5f0]"
                >
                  <span className="flex-1 truncate text-xs font-medium text-[#1D1E20]">
                    {es.supplier.name}
                  </span>
                  {es.quoted_amount != null && (
                    <span className="shrink-0 text-[11px] tabular-nums text-[#888]">
                      cotizó {formatCurrency(Number(es.quoted_amount), currency)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden grid-cols-[1fr_140px_140px_140px_140px_40px] items-start gap-3 border-t border-[#f5f5f5] px-4 py-3 hover:bg-[#fafafa] sm:grid">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            {puedeEditar ? (
              <input
                type="text"
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                onBlur={saveName}
                placeholder="Nombre del concepto..."
                className="flex-1 rounded border border-transparent px-2 py-1 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0] focus:bg-white"
              />
            ) : (
              <p className="flex-1 truncate px-2 py-1 text-sm text-[#1D1E20]">{localName || '—'}</p>
            )}
            {isOverBudget && (
              <span title="El monto contratado supera lo estimado">
                <AlertTriangle size={14} className="shrink-0 text-amber-500" />
              </span>
            )}
          </div>
          <div className="px-2">
            <SupplierBlock />
          </div>
        </div>

        {puedeEditar ? (
          <input
            type="text"
            inputMode="decimal"
            value={amountDisplay}
            onFocus={() => setAmountFocused(true)}
            onChange={e => {
              const cleaned = e.target.value.replace(/[^0-9.]/g, '')
              const parts = cleaned.split('.')
              if (parts.length > 2) return
              setLocalAmount(cleaned)
            }}
            onBlur={saveAmount}
            placeholder={formatCurrency(0, currency)}
            className="w-full rounded border border-transparent px-2 py-1 text-right text-sm tabular-nums text-[#1D1E20] outline-none transition focus:border-[#48C9B0] focus:bg-white"
          />
        ) : (
          <p className="px-2 py-1 text-right text-sm tabular-nums text-[#1D1E20]">
            {formatCurrency(item.budget_amount, currency)}
          </p>
        )}

        {!hasNoData && puedeEditar ? (
          <input
            type="text"
            inputMode="decimal"
            value={contractDisplay}
            onFocus={() => setContractFocused(true)}
            onChange={e => {
              const cleaned = e.target.value.replace(/[^0-9.]/g, '')
              if (cleaned.split('.').length > 2) return
              setLocalContract(cleaned)
            }}
            onBlur={saveContract}
            placeholder={formatCurrency(0, currency)}
            className={`w-full rounded border border-transparent px-2 py-1 text-right text-xs tabular-nums outline-none transition focus:border-[#48C9B0] focus:bg-white ${isOverBudget ? 'text-amber-600 font-semibold' : 'text-[#1D1E20]'}`}
          />
        ) : (
          <div className={`text-right text-xs tabular-nums ${
            hasNoData ? 'text-[#bbb]' : isOverBudget ? 'text-amber-600 font-semibold' : 'text-[#888]'
          }`}>
            {hasNoData ? '—' : formatCurrency(contractedAmount, currency)}
          </div>
        )}
        <div className={`text-right text-xs tabular-nums ${hasNoData ? 'text-[#bbb]' : 'text-[#888]'}`}>
          {hasNoData ? '—' : formatCurrency(paidAmount, currency)}
        </div>
        <div className={`text-right text-xs tabular-nums ${pendingColorClass}`}>
          {hasNoData ? '—' : formatCurrency(pendingAmount, currency)}
        </div>

        {puedeBorrar ? (
          <button
            onClick={() => onDelete(item.id)}
            className="flex h-7 w-7 items-center justify-center rounded text-[#ccc] transition hover:bg-red-50 hover:text-red-500"
            title="Borrar concepto"
          >
            <Trash2 size={14} />
          </button>
        ) : <span />}
      </div>

      {/* MOBILE */}
      <div className="border-t border-[#f5f5f5] px-4 py-3 sm:hidden">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {puedeEditar ? (
                <input
                  type="text"
                  value={localName}
                  onChange={e => setLocalName(e.target.value)}
                  onBlur={saveName}
                  placeholder="Nombre del concepto..."
                  className="flex-1 rounded border border-transparent px-2 py-1 text-sm font-medium text-[#1D1E20] outline-none focus:border-[#48C9B0] focus:bg-white"
                />
              ) : (
                <p className="flex-1 truncate px-2 py-1 text-sm font-medium text-[#1D1E20]">{localName || '—'}</p>
              )}
              {isOverBudget && (
                <span title="El monto contratado supera lo estimado">
                  <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                </span>
              )}
            </div>
            <div className="mt-1.5 px-2">
              <SupplierBlock />
            </div>
          </div>
          {puedeBorrar && (
            <button
              onClick={() => onDelete(item.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#ccc] hover:bg-red-50 hover:text-red-500"
              title="Borrar concepto"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
          <div>
            <p className="text-[#aaa]">Estimado</p>
            {puedeEditar ? (
              <input
                type="text"
                inputMode="decimal"
                value={amountDisplay}
                onFocus={() => setAmountFocused(true)}
                onChange={e => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                  const parts = cleaned.split('.')
                  if (parts.length > 2) return
                  setLocalAmount(cleaned)
                }}
                onBlur={saveAmount}
                className="w-full rounded border border-transparent px-2 py-1 text-sm font-semibold tabular-nums text-[#1D1E20] outline-none focus:border-[#48C9B0] focus:bg-white"
              />
            ) : (
              <p className="px-2 py-1 text-sm font-semibold tabular-nums text-[#1D1E20]">
                {formatCurrency(item.budget_amount, currency)}
              </p>
            )}
          </div>
          <div>
            <p className="text-[#aaa]">Contratado</p>
            {!hasNoData && puedeEditar ? (
              <input
                type="text"
                inputMode="decimal"
                value={contractDisplay}
                onFocus={() => setContractFocused(true)}
                onChange={e => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                  if (cleaned.split('.').length > 2) return
                  setLocalContract(cleaned)
                }}
                onBlur={saveContract}
                className={`w-full rounded border border-transparent px-2 py-1 text-sm tabular-nums outline-none focus:border-[#48C9B0] focus:bg-white ${isOverBudget ? 'text-amber-600 font-semibold' : 'text-[#1D1E20]'}`}
              />
            ) : (
              <p className={`px-2 py-1 text-sm tabular-nums ${
                hasNoData ? 'text-[#bbb]' : isOverBudget ? 'text-amber-600 font-semibold' : 'text-[#888]'
              }`}>
                {hasNoData ? '—' : formatCurrency(contractedAmount, currency)}
              </p>
            )}
          </div>
          <div>
            <p className="text-[#aaa]">Pagado</p>
            <p className={`px-2 py-1 text-sm tabular-nums ${hasNoData ? 'text-[#bbb]' : 'text-[#888]'}`}>
              {hasNoData ? '—' : formatCurrency(paidAmount, currency)}
            </p>
          </div>
          <div>
            <p className="text-[#aaa]">Por pagar</p>
            <p className={`px-2 py-1 text-sm tabular-nums ${pendingColorClass}`}>
              {hasNoData ? '—' : formatCurrency(pendingAmount, currency)}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}