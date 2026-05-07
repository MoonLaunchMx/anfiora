'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  BudgetCategory, BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS,
  EventBudget, Currency, formatCurrency,
} from '@/lib/types'
import { FiInstagram, FiGlobe, FiFacebook } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'

type Props = {
  isOpen: boolean
  onClose: () => void
  currency: Currency
  budgets: EventBudget[]
  onSubmit: (data: {
    name: string
    category: BudgetCategory
    subcategory: string | null
    phone: string | null
    phone_country_code: string | null
    instagram: string | null
    facebook: string | null
    quoted_amount: number | null
    event_budget_id: string | null
  }) => Promise<void>
}

const COUNTRY_CODES = ['+52', '+1', '+34', '+57', '+54', '+55', '+56', '+51']

export default function SupplierModal({ isOpen, onClose, currency, budgets, onSubmit }: Props) {
  const [name, setName]                   = useState('')
  const [category, setCategory]           = useState<BudgetCategory>('Venue')
  const [eventBudgetId, setEventBudgetId] = useState('')
  const [phone, setPhone]                 = useState('')
  const [phoneCode, setPhoneCode]         = useState('+52')
  const [instagram, setInstagram]         = useState('')
  const [facebook, setFacebook]           = useState('')
  const [submitting, setSubmitting]       = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName(''); setCategory('Venue'); setEventBudgetId('')
      setPhone(''); setPhoneCode('+52'); setInstagram(''); setFacebook('')
      setSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const budgetsForCategory = budgets.filter(b => b.category === category)
  const selectedBudget = eventBudgetId ? budgets.find(b => b.id === eventBudgetId) : null

  const validate = (): string | null => {
    if (!name.trim()) return 'Escribe el nombre del proveedor'
    if (!phone.trim() && !instagram.trim() && !facebook.trim())
      return 'Agrega al menos un contacto (WhatsApp, Instagram o Facebook)'
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { alert(err); return }
    setSubmitting(true)
    try {
      await onSubmit({
        name:               name.trim(),
        category,
        subcategory:        selectedBudget?.subcategory || null,
        phone:              phone.trim() || null,
        phone_country_code: phone.trim() ? phoneCode : null,
        instagram:          instagram.trim().replace(/^@/, '') || null,
        facebook:           facebook.trim().replace(/^@/, '') || null,
        quoted_amount:      null,
        event_budget_id:    eventBudgetId || null,
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
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-[#1D1E20]">Nuevo proveedor</h2>
              <p className="text-xs text-[#888]">Captura lo esencial, completa después</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#aaa] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">

              {/* Nombre */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. DJ Ultra Mix"
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Categoría <span className="text-red-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value as BudgetCategory); setEventBudgetId('') }}
                  className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                >
                  {BUDGET_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{BUDGET_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              {/* Concepto del presupuesto */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  Concepto
                </label>
                {budgetsForCategory.length > 0 ? (
                  <select
                    value={eventBudgetId}
                    onChange={e => setEventBudgetId(e.target.value)}
                    className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                  >
                    <option value="">Sin concepto</option>
                    {budgetsForCategory.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.subcategory || BUDGET_CATEGORY_LABELS[b.category]}
                        {b.budget_amount ? ` — ${formatCurrency(b.budget_amount, currency)}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-2.5 text-center">
                    <p className="text-xs text-[#aaa]">
                      No hay conceptos de {BUDGET_CATEGORY_LABELS[category]} — créalos en Presupuesto
                    </p>
                  </div>
                )}
                {selectedBudget && (
                  <p className="mt-1 text-[10px] text-[#48C9B0]">
                    Meta: {formatCurrency(selectedBudget.budget_amount, currency)}
                  </p>
                )}
              </div>

              {/* Separador */}
              <div className="border-t border-[#f0f0f0]" />

              {/* WhatsApp */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  <FaWhatsapp size={12} />
                  WhatsApp
                </label>
                <div className="flex gap-2">
                  <select
                    value={phoneCode}
                    onChange={e => setPhoneCode(e.target.value)}
                    className="rounded-lg border border-[#e0e0e0] bg-white px-2 py-2 text-sm outline-none transition focus:border-[#48C9B0]"
                  >
                    {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="5512345678"
                    className="flex-1 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm tabular-nums text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                  />
                </div>
              </div>

              {/* Instagram */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  <FiInstagram size={12} />
                  Instagram
                </label>
                <div className="flex items-center rounded-lg border border-[#e0e0e0] bg-white transition focus-within:border-[#48C9B0]">
                  <span className="pl-3 text-sm text-[#aaa]">@</span>
                  <input
                    type="text"
                    value={instagram}
                    onChange={e => setInstagram(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                    placeholder="proveedor"
                    className="flex-1 bg-transparent px-2 py-2 text-sm text-[#1D1E20] outline-none"
                  />
                </div>
              </div>

              {/* Facebook */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#888]">
                  <FiFacebook size={12} />
                  Facebook
                </label>
                <div className="flex items-center rounded-lg border border-[#e0e0e0] bg-white transition focus-within:border-[#48C9B0]">
                  <span className="pl-3 text-sm text-[#aaa]">fb.com/</span>
                  <input
                    type="text"
                    value={facebook}
                    onChange={e => setFacebook(e.target.value)}
                    placeholder="proveedor"
                    className="flex-1 bg-transparent px-2 py-2 text-sm text-[#1D1E20] outline-none"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
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
              disabled={submitting}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar proveedor'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}