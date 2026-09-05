'use client'

import { useState, useEffect } from 'react'
import {
  EventBudget, Currency, formatCurrency,
} from '@/lib/types'
import { Categoria, activas, buscarPorNombre, nombrePorId } from '@/lib/rolodex/categorias-store'
import { FiInstagram, FiGlobe, FiFacebook } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { detectCountry, dialCode } from '@/lib/phone'
import { Modal } from '@/app/components/ui/Modal'
import CategoriaPicker from './CategoriaPicker'

type Props = {
  isOpen: boolean
  onClose: () => void
  currency: Currency
  budgets: EventBudget[]
  categorias: Categoria[]
  duenoCatalogo: string
  onSubmit: (data: {
    name: string
    category_id: string | null
    subcategory: string | null
    phone: string | null
    phone_country_code: string | null
    instagram: string | null
    facebook: string | null
    quoted_amount: number | null
    event_budget_id: string | null
  }) => Promise<void>
}

export default function SupplierModal({ isOpen, onClose, currency, budgets, categorias, duenoCatalogo, onSubmit }: Props) {
  const [name, setName]                   = useState('')
  const [categoryId, setCategoryId]       = useState<string>('')
  const [eventBudgetId, setEventBudgetId] = useState('')
  const [phone, setPhone]                 = useState('')
  const [instagram, setInstagram]         = useState('')
  const [facebook, setFacebook]           = useState('')
  const [submitting, setSubmitting]       = useState(false)

  useEffect(() => {
    if (isOpen) {
      const activasIniciales = activas(categorias)
      const porDefecto = buscarPorNombre(activasIniciales, 'Venue') ?? activasIniciales[0] ?? null
      setName(''); setCategoryId(porDefecto?.id ?? ''); setEventBudgetId('')
      setPhone(''); setInstagram(''); setFacebook('')
      setSubmitting(false)
    }
  }, [isOpen])

  const selectedCategoria = categorias.find(c => c.id === categoryId) ?? null
  const budgetsForCategory = budgets.filter(b => b.category_id === selectedCategoria?.id)
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
      const cc = detectCountry(phone)
      const dial = cc ? dialCode(cc) || null : null
      await onSubmit({
        name:               name.trim(),
        category_id:        selectedCategoria?.id ?? null,
        subcategory:        selectedBudget?.subcategory || null,
        phone:              phone.trim() || null,
        phone_country_code: phone.trim() ? dial : null,
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
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title="Nuevo proveedor" subtitle="Captura lo esencial, completa después" />
      <Modal.Body>
        <div className="space-y-4">

          {/* Categoría */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
              Categoría <span className="text-red-400">*</span>
            </label>
            <CategoriaPicker
              categorias={categorias}
              valorId={categoryId || null}
              onChange={c => { setCategoryId(c.id); setEventBudgetId('') }}
              duenoCatalogo={duenoCatalogo}
              className="border-[#e0e0e0]"
            />
          </div>

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
              className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />
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
                className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
              >
                <option value="">Sin concepto</option>
                {budgetsForCategory.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.subcategory || nombrePorId(categorias, b.category_id)}
                    {b.budget_amount ? ` — ${formatCurrency(b.budget_amount, currency)}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-2.5 text-center">
                <p className="text-xs text-[#aaa]">
                  No hay conceptos de {selectedCategoria?.name} — créalos en Presupuesto
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
            <PhoneInput value={phone} onChange={setPhone} placeholder="55 1234 5678" />
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
                className="flex-1 bg-transparent px-2 py-2 text-base text-[#1D1E20] outline-none"
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
                className="flex-1 bg-transparent px-2 py-2 text-base text-[#1D1E20] outline-none"
              />
            </div>
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
          disabled={submitting}
          className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
        >
          {submitting ? 'Guardando...' : 'Guardar proveedor'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}