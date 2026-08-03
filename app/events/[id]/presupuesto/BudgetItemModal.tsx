'use client'

import { useState, useEffect } from 'react'
import {
  SUBCATEGORIES_BY_CATEGORY, BudgetCategory,
  Currency, formatCurrency, EventSupplier, Supplier,
} from '@/lib/types'
import { categoryLabel } from './lib/categories'
import { Modal } from '@/app/components/ui/Modal'

type EventSupplierWithName = EventSupplier & {
  supplier: Pick<Supplier, 'id' | 'name'>
}

type Props = {
  isOpen: boolean
  onClose: () => void
  currency: Currency
  categories: string[]
  initialCategory?: string | null
  eventSuppliers: EventSupplierWithName[]
  onSubmit: (data: {
    category: string
    subcategory: string
    budget_amount: number
    event_supplier_id: string | null
    notes: string | null
  }) => Promise<void>
}

export default function BudgetItemModal({
  isOpen, onClose, currency, categories, initialCategory, eventSuppliers, onSubmit,
}: Props) {
  const [category, setCategory]       = useState<string>('Venue')
  const [subcategory, setSubcategory] = useState('')
  const [amount, setAmount]           = useState('')
  const [supplierId, setSupplierId]   = useState('')
  const [notes, setNotes]             = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory || (categories[0] ?? 'Venue'))
      setSubcategory('')
      setAmount('')
      setSupplierId('')
      setNotes('')
      setSubmitting(false)
    }
  }, [isOpen, initialCategory, categories])

  const suggestions = SUBCATEGORIES_BY_CATEGORY[category as BudgetCategory] || []

  // Solo proveedores con status 'contratado' — son los unicos con contract_amount real y pagos
  const contratados = eventSuppliers.filter(es =>
    es.supplier && es.status === 'contratado'
  )

  const handleSubmit = async () => {
    if (!subcategory.trim()) {
      alert('Escribe el nombre del concepto')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        category:          category,
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
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title="Agregar concepto" subtitle="Agrega un nuevo gasto al presupuesto" />
      <Modal.Body>
        <div className="space-y-4">

          {/* Categoria */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
              Categoría
            </label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setSubcategory('') }}
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{categoryLabel(cat)}</option>
              ))}
            </select>
          </div>

          {/* Concepto */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
              Concepto
            </label>
            <input
              type="text"
              value={subcategory}
              onChange={e => setSubcategory(e.target.value)}
              placeholder="Ej. Pastel principal, DJ noche..."
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />
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

          {/* Presupuesto */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
              Presupuesto
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => {
                const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                if (cleaned.split('.').length > 2) return
                setAmount(cleaned)
              }}
              placeholder="0.00"
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base tabular-nums text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />
            {amount && (
              <p className="mt-1 text-[10px] text-[#aaa]">
                {formatCurrency(parseFloat(amount) || 0, currency)}
              </p>
            )}
          </div>

          {/* Proveedor — solo contratados */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
              Proveedor (opcional)
            </label>
            {contratados.length > 0 ? (
              <>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                >
                  <option value="">Sin proveedor (planeación)</option>
                  {contratados.map(es => (
                    <option key={es.id} value={es.id}>
                      {es.supplier.name}
                      {es.contract_amount ? ` — ${formatCurrency(es.contract_amount, currency)}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-[#aaa]">
                  Si vinculas, los montos y pagos se actualizan automáticamente.
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-3 text-center">
                <p className="text-xs text-[#888]">Aún no tienes proveedores contratados</p>
                <p className="mt-0.5 text-[10px] text-[#aaa]">
                  Márcalos como contratados en la sección Proveedores
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
              className="w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />
          </div>

        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          disabled={submitting}
          className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !subcategory.trim()}
          className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
        >
          {submitting ? 'Guardando...' : 'Agregar concepto'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
