'use client'

import { useState, useEffect } from 'react'
import { X, Briefcase } from 'lucide-react'
import {
  BudgetCategory, BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS, SUBCATEGORIES_BY_CATEGORY,
  Currency, formatCurrency, EventSupplier, Supplier, SUPPLIER_STATUS_LABELS,
} from '@/lib/types'

type EventSupplierWithName = EventSupplier & {
  supplier: Pick<Supplier, 'id' | 'name'>
}

type Props = {
  isOpen: boolean
  onClose: () => void
  currency: Currency
  // Categoria pre-seleccionada cuando abre desde "+ Agregar partida" dentro de una categoria
  initialCategory?: BudgetCategory | null
  // Proveedores del evento para vincular
  eventSuppliers: EventSupplierWithName[]
  onSubmit: (data: {
    category: BudgetCategory
    subcategory: string
    budget_amount: number
    event_supplier_id: string | null
    notes: string | null
  }) => Promise<void>
}

export default function BudgetItemModal({
  isOpen, onClose, currency, initialCategory, eventSuppliers, onSubmit,
}: Props) {
  const [category, setCategory]            = useState<BudgetCategory>('Venue')
  const [subcategory, setSubcategory]      = useState('')
  const [amount, setAmount]                = useState('')
  const [supplierId, setSupplierId]        = useState<string>('')
  const [notes, setNotes]                  = useState('')
  const [submitting, setSubmitting]        = useState(false)

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory || 'Venue')
      setSubcategory('')
      setAmount('')
      setSupplierId('')
      setNotes('')
      setSubmitting(false)
    }
  }, [isOpen, initialCategory])

  if (!isOpen) return null

  const suggestions = SUBCATEGORIES_BY_CATEGORY[category] || []

  // Filtrar proveedores que correspondan a la categoria seleccionada
  const matchingSuppliers = eventSuppliers.filter(es =>
    es.supplier && es.contract_amount !== null
  )

  const handleSubmit = async () => {
    if (!subcategory.trim()) {
      alert('Escribe el nombre de la partida')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        category,
        subcategory:       subcategory.trim(),
        budget_amount:     parseFloat(amount) || 0,
        event_supplier_id: supplierId || null,
        notes:             notes.trim() || null,
      })
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">

          {/* HEADER */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-[#1D1E20]">Nueva partida</h2>
              <p className="text-xs text-[#888]">Agrega un nuevo gasto al presupuesto</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#aaa] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
            >
              <X size={16} />
            </button>
          </div>

          {/* BODY scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">

              {/* Categoria */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value as BudgetCategory); setSubcategory('') }}
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                >
                  {BUDGET_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{BUDGET_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              {/* Partida (subcategoria) */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Partida
                </label>
                <input
                  type="text"
                  value={subcategory}
                  onChange={e => setSubcategory(e.target.value)}
                  placeholder="Ej. Pastel principal, DJ noche..."
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
                {/* Sugerencias rapidas */}
                {suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setSubcategory(sug)}
                        className="rounded-full border border-[#e0e0e0] bg-white px-2.5 py-1 text-[11px] text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Monto estimado */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Monto estimado
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                    const parts = cleaned.split('.')
                    if (parts.length > 2) return
                    setAmount(cleaned)
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm tabular-nums text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
                {amount && (
                  <p className="mt-1 text-[10px] text-[#aaa]">
                    {formatCurrency(parseFloat(amount) || 0, currency)}
                  </p>
                )}
              </div>

              {/* Proveedor (opcional) */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  <Briefcase size={12} />
                  Proveedor (opcional)
                </label>
                {matchingSuppliers.length > 0 ? (
                  <>
                    <select
                      value={supplierId}
                      onChange={e => setSupplierId(e.target.value)}
                      className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                    >
                      <option value="">Sin proveedor (planeación)</option>
                      {matchingSuppliers.map(es => (
                        <option key={es.id} value={es.id}>
                          {es.supplier.name} — {SUPPLIER_STATUS_LABELS[es.status]}
                          {es.contract_amount ? ` — ${formatCurrency(es.contract_amount, currency)}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-[#aaa]">
                      Si vinculas, los montos cotizados y pagados se actualizan automáticamente.
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-3 text-center">
                    <p className="text-xs text-[#888]">Aún no tienes proveedores</p>
                    <p className="mt-0.5 text-[10px] text-[#aaa]">
                      Créalos en la sección Proveedores para vincularlos a tus partidas
                    </p>
                  </div>
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles adicionales..."
                  className="w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
              </div>

            </div>
          </div>

          {/* FOOTER */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !subcategory.trim()}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Agregar partida'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}