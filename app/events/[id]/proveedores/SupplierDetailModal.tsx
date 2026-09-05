'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star, Trash2, Plus, Check, Paperclip, Wallet, Pencil, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiInstagram, FiGlobe, FiMail, FiFacebook } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import {
  EventSupplier, Supplier, SupplierPayment, EventBudget, Currency, formatCurrency,
  SupplierStatus, SUPPLIER_STATUSES, SUPPLIER_STATUS_LABELS,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PaymentMethod,
  PAID_BY_OPTIONS, PAID_BY_LABELS, PaidBy,
} from '@/lib/types'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { toWhatsApp, detectCountry, dialCode } from '@/lib/phone'
import { Modal } from '@/app/components/ui/Modal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import CategoriaPicker from './CategoriaPicker'

const INPUT_CLASS = 'rounded-lg border border-[#e8e8e8] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition-colors focus:border-[#48C9B0]'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

interface Props {
  item: SupplierWithDetails
  eventId: string
  currency: Currency
  budgets: EventBudget[]
  categorias: Categoria[]
  duenoCatalogo: string
  onClose: () => void
  onSaved: (updated: SupplierWithDetails) => void
  onDeleted: (id: string) => void
  // Nuevo: el padre maneja el review modal
  onReviewNeeded: (item: SupplierWithDetails) => void
}

export default function SupplierDetailModal({
  item, eventId, currency, budgets, categorias, duenoCatalogo, onClose, onSaved, onDeleted, onReviewNeeded,
}: Props) {
  const router = useRouter()
  const askConfirm = useConfirm()

  const categoriaPropia = categorias.find(c => c.id === item.supplier.category_id)

  const [name, setName]             = useState(item.supplier.name)
  const [categoryId, setCategoryId] = useState<string>(categoriaPropia?.id ?? item.supplier.category_id ?? '')
  const [phone, setPhone]           = useState(item.supplier.phone ?? '')
  const [instagram, setInstagram]   = useState(item.supplier.instagram ?? '')
  const [facebook, setFacebook]     = useState((item.supplier as any).facebook ?? '')
  const [website, setWebsite]       = useState(item.supplier.website ?? '')
  const [email, setEmail]           = useState(item.supplier.email ?? '')

  const [status, setStatus]                 = useState<SupplierStatus>(item.status)
  const [quotedAmount, setQuotedAmount]     = useState<string>(item.quoted_amount?.toString() ?? '')
  const [contractAmount, setContractAmount] = useState<string>(item.contract_amount?.toString() ?? '')
  const [eventBudgetId, setEventBudgetId]   = useState<string>((item as any).event_budget_id ?? '')
  const [supplierNotes, setSupplierNotes]   = useState<string>(item.event_notes ?? '')

  const [payments, setPayments]                     = useState<SupplierPayment[]>([])
  const [showNewPaymentForm, setShowNewPaymentForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId]     = useState<string | null>(null)
  const [payAmount, setPayAmount]       = useState('')
  const [payDate, setPayDate]           = useState(new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod]       = useState<PaymentMethod>('transferencia')
  const [payBy, setPayBy]               = useState<PaidBy>('pareja')
  const [payReference, setPayReference] = useState('')
  const [savingPay, setSavingPay]       = useState(false)

  const [linkedBudget, setLinkedBudget] = useState<EventBudget | null>(null)
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [showProModal, setShowProModal] = useState(false)

  const totalPaid      = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const contractNum    = contractAmount ? parseFloat(contractAmount) : 0
  const remaining      = contractNum - totalPaid
  const isOverpaid     = contractNum > 0 && totalPaid > contractNum
  const overpaidAmount = isOverpaid ? totalPaid - contractNum : 0
  const payProgress    = contractNum > 0 ? Math.min((totalPaid / contractNum) * 100, 100) : 0
  const hasReview      = item.rating !== null || (item.review_text && item.review_text.length > 0)

  const selectedCategoria = categorias.find(c => c.id === categoryId) ?? categoriaPropia ?? null
  const categoryName      = selectedCategoria?.name ?? ''
  const categoryIdToSave  = categoryId || item.supplier.category_id

  const budgetsForCategory = budgets.filter(b => b.category_id === categoryIdToSave)
  const selectedBudget     = eventBudgetId ? budgets.find(b => b.id === eventBudgetId) : null
  const budgetMeta         = selectedBudget?.budget_amount || 0

  const quotedNum            = parseFloat(quotedAmount) || 0
  const isQuotedOverBudget   = selectedBudget && quotedNum > 0 && budgetMeta > 0 && quotedNum > budgetMeta
  const isQuotedUnderBudget  = selectedBudget && quotedNum > 0 && budgetMeta > 0 && quotedNum <= budgetMeta
  const isContractOverBudget = selectedBudget && contractNum > 0 && budgetMeta > 0 && contractNum > budgetMeta

  useEffect(() => {
    loadPayments()
    loadLinkedBudget()
  }, [])

  const loadPayments = async () => {
    const { data } = await supabase
      .from('supplier_payments').select('*')
      .eq('event_supplier_id', item.id)
      .order('payment_date', { ascending: false })
    if (data) setPayments(data as SupplierPayment[])
  }

  const loadLinkedBudget = async () => {
    const { data } = await supabase
      .from('event_budgets').select('*')
      .eq('event_supplier_id', item.id)
      .maybeSingle()
    if (data) setLinkedBudget(data as EventBudget)
  }

  const derivePhoneCountryCode = (): string | null => {
    if (!phone.trim()) return null
    const cc = detectCountry(phone)
    return cc ? dialCode(cc) || null : null
  }

  const buildUpdatedItem = (): SupplierWithDetails => ({
    ...item,
    status,
    quoted_amount:   quotedAmount   ? parseFloat(quotedAmount)   : null,
    contract_amount: contractAmount ? parseFloat(contractAmount) : null,
    event_notes:     supplierNotes.trim() || null,
    event_budget_id: eventBudgetId || null,
    supplier: {
      ...item.supplier,
      name:               name.trim(),
      category_id:        categoryIdToSave,
      subcategory:        selectedBudget?.subcategory || null,
      phone:              phone.trim() || null,
      phone_country_code: derivePhoneCountryCode(),
      instagram:          instagram.trim() || null,
      facebook:           facebook.trim() || null,
      website:            website.trim() || null,
      email:              email.trim() || null,
    },
  })

  const handleSave = async () => {
    if (!name.trim()) { alert('El nombre es obligatorio'); return }
    setSaving(true)

    const wasFinalState   = item.status === 'contratado' || item.status === 'descartado'
    const isNowFinalState = status === 'contratado' || status === 'descartado'
    const reachedFinalState = !wasFinalState && isNowFinalState

    try {
      const { error: supErr } = await supabase
        .from('suppliers')
        .update({
          name:               name.trim(),
          category_id:        categoryIdToSave,
          subcategory:        selectedBudget?.subcategory || null,
          phone:              phone.trim() || null,
          phone_country_code: derivePhoneCountryCode(),
          instagram:          instagram.trim() || null,
          facebook:           facebook.trim() || null,
          website:            website.trim() || null,
          email:              email.trim() || null,
        })
        .eq('id', item.supplier.id)
      if (supErr) throw supErr

      const { data, error } = await supabase
        .from('event_suppliers')
        .update({
          status,
          quoted_amount:   quotedAmount   ? parseFloat(quotedAmount)   : null,
          contract_amount: contractAmount ? parseFloat(contractAmount) : null,
          event_notes:     supplierNotes.trim() || null,
          event_budget_id: eventBudgetId || null,
        })
        .eq('id', item.id)
        .select('*, supplier:suppliers(*)')
        .single()
      if (error) throw error
      if (data) onSaved(data as SupplierWithDetails)

      // Cerrar el detail modal primero, luego el padre lanza el review
      onClose()
      if (reachedFinalState && !hasReview) {
        onReviewNeeded(buildUpdatedItem())
      }
    } catch (err: any) {
      console.error('Error guardando:', err?.message ?? err, err)
      alert(`No se pudo guardar: ${err?.message ?? 'Intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const ok = await askConfirm({
      title: `¿Quitar a ${item.supplier.name} de este evento?`,
      message: payments.length > 0
        ? `Se borran ${payments.length === 1 ? 'el pago registrado' : `los ${payments.length} pagos registrados`} y su vínculo con el presupuesto. El proveedor sigue en tu catálogo para otros eventos.`
        : 'Se borra su vínculo con el presupuesto de este evento. El proveedor sigue en tu catálogo para otros eventos.',
      confirmLabel: 'Quitar del evento',
    })
    if (!ok) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('event_suppliers').delete().eq('id', item.id)
      if (error) throw error
      onDeleted(item.id)
      onClose()
    } catch (err: any) {
      console.error('Error eliminando:', err?.message ?? err, err)
      alert('No se pudo eliminar.')
      setDeleting(false)
    }
  }

  const resetPaymentForm = () => {
    setPayAmount(''); setPayDate(new Date().toISOString().slice(0, 10))
    setPayMethod('transferencia'); setPayBy('pareja'); setPayReference('')
    setEditingPaymentId(null); setShowNewPaymentForm(false)
  }

  const openNewPaymentForm  = () => { resetPaymentForm(); setShowNewPaymentForm(true) }
  const openEditPaymentForm = (p: SupplierPayment) => {
    setShowNewPaymentForm(false); setEditingPaymentId(p.id)
    setPayAmount(p.amount.toString()); setPayDate(p.payment_date)
    setPayMethod(p.payment_method ?? 'transferencia'); setPayBy(p.paid_by ?? 'pareja')
    setPayReference(p.reference ?? '')
  }

  const handleSavePayment = async () => {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) { alert('Monto inválido'); return }
    if (contractNum > 0) {
      const previousAmount = editingPaymentId ? (payments.find(p => p.id === editingPaymentId)?.amount ?? 0) : 0
      const projectedTotal = totalPaid - previousAmount + amt
      if (projectedTotal > contractNum) {
        const excess = projectedTotal - contractNum
        const ok = await askConfirm({
          title: 'Este pago rebasa lo contratado',
          message: `Vas a pagar ${formatCurrency(excess, currency)} de más a ${item.supplier.name}. Registra el pago si el monto acordado cambió.`,
          confirmLabel: 'Registrar de todos modos',
          tone: 'default',
        })
        if (!ok) return
      }
    }
    setSavingPay(true)
    try {
      const payload = { amount: amt, payment_date: payDate, payment_method: payMethod, paid_by: payBy, reference: payReference.trim() || null }
      if (editingPaymentId) {
        const { data, error } = await supabase.from('supplier_payments').update(payload).eq('id', editingPaymentId).select().single()
        if (error) throw error
        if (data) setPayments(prev => prev.map(p => p.id === editingPaymentId ? (data as SupplierPayment) : p))
      } else {
        const { data, error } = await supabase.from('supplier_payments').insert({ event_supplier_id: item.id, ...payload }).select().single()
        if (error) throw error
        if (data) setPayments(prev => [data as SupplierPayment, ...prev])
      }
      resetPaymentForm()
    } catch (err: any) {
      console.error('Error guardando pago:', err?.message ?? err, err)
      alert(`No se pudo guardar el pago: ${err?.message ?? 'Intenta de nuevo'}`)
    } finally {
      setSavingPay(false)
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    const pago = payments.find(p => p.id === paymentId)
    const ok = await askConfirm({
      title: pago ? `¿Eliminar el pago de ${formatCurrency(pago.amount, currency)}?` : '¿Eliminar este pago?',
      message: `Bajará el total pagado a ${item.supplier.name}. No se puede deshacer.`,
    })
    if (!ok) return
    const { error } = await supabase.from('supplier_payments').delete().eq('id', paymentId)
    if (error) { alert('No se pudo eliminar'); return }
    setPayments(prev => prev.filter(p => p.id !== paymentId))
    if (editingPaymentId === paymentId) resetPaymentForm()
  }

  const openWhatsApp  = () => {
    const raw = phone.startsWith('+') ? phone : `${item.supplier.phone_country_code ?? '+52'} ${phone}`
    const num = toWhatsApp(raw)
    if (!num) return
    window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer')
  }
  const openInstagram = () => { if (!instagram) return; window.open(`https://instagram.com/${instagram.replace('@', '').trim()}`, '_blank', 'noopener,noreferrer') }
  const openFacebook  = () => { if (!facebook) return; const h = facebook.replace(/^(https?:\/\/)?(www\.)?facebook\.com\//, '').replace(/^@/, '').trim(); window.open(`https://facebook.com/${h}`, '_blank', 'noopener,noreferrer') }
  const openWebsite   = () => { if (!website) return; window.open(website.startsWith('http') ? website : `https://${website}`, '_blank', 'noopener,noreferrer') }
  const openEmail     = () => { if (!email) return; window.open(`mailto:${email}`, '_blank', 'noopener,noreferrer') }
  const goToBudget    = () => { onClose(); router.push(`/events/${eventId}/presupuesto`) }

  const renderPaymentForm = (mode: 'new' | 'edit') => (
    <div className="space-y-2 rounded-lg border border-[#48C9B0] bg-[#48C9B0]/5 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
        {mode === 'edit' ? 'Editar pago' : 'Nuevo pago'}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" inputMode="decimal" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={`Monto (${currency})`} className={`${INPUT_CLASS} w-full`} autoFocus />
        <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={`${INPUT_CLASS} w-full`} />
        <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)} className={`${INPUT_CLASS} w-full`}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
        </select>
        <select value={payBy} onChange={e => setPayBy(e.target.value as PaidBy)} className={`${INPUT_CLASS} w-full`}>
          {PAID_BY_OPTIONS.map(p => <option key={p} value={p}>{PAID_BY_LABELS[p]}</option>)}
        </select>
      </div>
      <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="Referencia o nota (opcional)" className={`${INPUT_CLASS} w-full`} />
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={resetPaymentForm} disabled={savingPay} className="px-3 py-1 text-xs text-[#666] hover:text-[#1D1E20]">Cancelar</button>
        <button onClick={handleSavePayment} disabled={savingPay || !payAmount} className="flex items-center gap-1 rounded-lg bg-[#48C9B0] px-3 py-1 text-xs font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50">
          <Check size={12} />
          {savingPay ? 'Guardando...' : (mode === 'edit' ? 'Actualizar' : 'Agregar')}
        </button>
      </div>
    </div>
  )

  return (
    <Modal open onClose={onClose} size="2xl">
      <Modal.Header title={name || 'Sin nombre'} subtitle={categoryName} />
      <Modal.Body className="space-y-7 py-5">

        {/* ① ESTADO */}
        <Section title="Estado">
          <div className="flex flex-wrap gap-2">
            {SUPPLIER_STATUSES.map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                  status === s ? 'border-[#1D1E20] bg-[#1D1E20] font-medium text-white' : 'border-[#e8e8e8] bg-white text-[#666] hover:bg-[#fafafa]'
                }`}
              >
                {SUPPLIER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </Section>

        {/* ② IDENTIDAD */}
        <Section title="Identidad">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={`${INPUT_CLASS} w-full`} />
            </Field>
            <Field label="Categoría">
              <CategoriaPicker
                categorias={categorias}
                valorId={categoryId || null}
                onChange={c => { setCategoryId(c.id); setEventBudgetId('') }}
                duenoCatalogo={duenoCatalogo}
                className="border-[#e8e8e8]"
              />
            </Field>
            <Field label="Concepto del presupuesto" className="sm:col-span-2">
              {budgetsForCategory.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <Wallet size={14} className="shrink-0 text-[#888]" />
                    <select value={eventBudgetId} onChange={e => setEventBudgetId(e.target.value)} className={`${INPUT_CLASS} flex-1`}>
                      <option value="">Sin concepto</option>
                      {budgetsForCategory.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.subcategory || categoryName} — {formatCurrency(b.budget_amount, currency)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedBudget && <p className="mt-1 text-[10px] text-[#888]">Meta: {formatCurrency(budgetMeta, currency)}</p>}
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-3">
                  <Wallet size={14} className="shrink-0 text-[#aaa]" />
                  <p className="text-xs text-[#888]">No hay conceptos de {categoryName || 'esta categoría'} — créalos en Presupuesto</p>
                </div>
              )}
            </Field>
          </div>
        </Section>

        {/* ③ CONTACTO */}
        <Section title="Contacto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="WhatsApp">
              <div className="flex gap-1.5">
                <PhoneInput value={phone} onChange={setPhone} placeholder="55 1234 5678" className="min-w-0 flex-1" />
                <button onClick={openWhatsApp} disabled={!phone} className="flex shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] px-3 text-emerald-600 hover:bg-emerald-50 disabled:opacity-30">
                  <FaWhatsapp size={18} />
                </button>
              </div>
            </Field>
            <Field label="Email">
              <div className="flex gap-1.5">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contacto@proveedor.com" className={`${INPUT_CLASS} min-w-0 flex-1`} />
                <button onClick={openEmail} disabled={!email} className="flex shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] px-3 text-[#1D1E20] hover:bg-[#fafafa] disabled:opacity-30">
                  <FiMail size={18} />
                </button>
              </div>
            </Field>
            <Field label="Instagram">
              <div className="flex gap-1.5">
                <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@usuario" className={`${INPUT_CLASS} min-w-0 flex-1`} />
                <button onClick={openInstagram} disabled={!instagram} className="flex shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] px-3 text-pink-600 hover:bg-pink-50 disabled:opacity-30">
                  <FiInstagram size={18} />
                </button>
              </div>
            </Field>
            <Field label="Facebook">
              <div className="flex gap-1.5">
                <input type="text" value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="fb.com/proveedor" className={`${INPUT_CLASS} min-w-0 flex-1`} />
                <button onClick={openFacebook} disabled={!facebook} className="flex shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] px-3 text-blue-600 hover:bg-blue-50 disabled:opacity-30">
                  <FiFacebook size={18} />
                </button>
              </div>
            </Field>
            <Field label="Website" className="sm:col-span-2">
              <div className="flex gap-1.5">
                <input type="text" value={website} onChange={e => setWebsite(e.target.value)} placeholder="proveedor.com" className={`${INPUT_CLASS} min-w-0 flex-1`} />
                <button onClick={openWebsite} disabled={!website} className="flex shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] px-3 text-[#1D1E20] hover:bg-[#fafafa] disabled:opacity-30">
                  <FiGlobe size={18} />
                </button>
              </div>
            </Field>
          </div>
        </Section>

        {/* ④ PRESUPUESTO ASIGNADO */}
        {linkedBudget && (
          <Section title="Presupuesto asignado">
            <button onClick={goToBudget} className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-left transition-colors hover:border-[#48C9B0] hover:bg-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                  <Wallet size={16} className="text-[#48C9B0]" />
                </div>
                <div>
                  <div className="text-xs text-[#888]">{linkedBudget.subcategory || nombrePorId(categorias, linkedBudget.category_id)}</div>
                  <div className="text-sm font-semibold text-[#1D1E20]">Meta: {formatCurrency(linkedBudget.budget_amount, currency)}</div>
                </div>
              </div>
              <span className="text-xs font-medium text-[#48C9B0]">Ver →</span>
            </button>
          </Section>
        )}

        {/* ⑤ COMERCIAL */}
        <Section title="Comercial">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={`Cotización (${currency})`}>
              <input type="number" inputMode="decimal" value={quotedAmount} onChange={e => setQuotedAmount(e.target.value)} placeholder="0.00" className={`${INPUT_CLASS} w-full`} />
              {quotedAmount && <p className="mt-1 text-xs text-[#888]">{formatCurrency(quotedNum, currency)}</p>}
            </Field>
            <Field label={`Monto contratado (${currency})`}>
              <input type="number" inputMode="decimal" value={contractAmount} onChange={e => setContractAmount(e.target.value)} placeholder="0.00" className={`${INPUT_CLASS} w-full`} />
              {contractAmount && <p className="mt-1 text-xs text-[#888]">{formatCurrency(contractNum, currency)}</p>}
            </Field>
          </div>
          {selectedBudget && (quotedNum > 0 || contractNum > 0) && (
            <div className="mt-3">
              {(isContractOverBudget || isQuotedOverBudget) ? (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
                  <p className="text-[11px] text-amber-700">
                    {isContractOverBudget
                      ? `El monto contratado supera la meta de "${selectedBudget.subcategory}" por ${formatCurrency(contractNum - budgetMeta, currency)}`
                      : `La cotización supera la meta de "${selectedBudget.subcategory}" por ${formatCurrency(quotedNum - budgetMeta, currency)}`}
                  </p>
                </div>
              ) : isQuotedUnderBudget ? (
                <div className="flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                  <p className="text-[11px] text-emerald-700">
                    Dentro del presupuesto — quedan {formatCurrency(budgetMeta - (contractNum || quotedNum), currency)} disponibles
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </Section>

        {/* ⑥ PAGOS */}
        <AnimatePresence initial={false}>
          {status === 'contratado' && (
            <motion.div key="pagos-section" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Section
                title="Pagos"
                action={!showNewPaymentForm && !editingPaymentId && (
                  <button onClick={openNewPaymentForm} className="flex items-center gap-1 text-xs font-medium text-[#48C9B0] hover:text-[#3aa896]">
                    <Plus size={12} />Registrar pago
                  </button>
                )}
              >
                {contractNum > 0 && (
                  <div className={`mb-3 rounded-lg border p-3 ${isOverpaid ? 'border-amber-300 bg-amber-50' : 'border-[#e8e8e8] bg-[#fafafa]'}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#888]">Pagado <span className="font-semibold text-[#1D1E20]">{formatCurrency(totalPaid, currency)}</span> / {formatCurrency(contractNum, currency)}</span>
                      <span className={`font-medium ${isOverpaid ? 'text-amber-700' : 'text-[#1D1E20]'}`}>
                        {isOverpaid ? `+${formatCurrency(overpaidAmount, currency)} de más` : remaining > 0 ? `Falta ${formatCurrency(remaining, currency)}` : 'Liquidado'}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
                      <div className={`h-full transition-all ${isOverpaid ? 'bg-amber-500' : 'bg-[#48C9B0]'}`} style={{ width: `${payProgress}%` }} />
                    </div>
                    {isOverpaid && (
                      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        <span>Los pagos exceden el monto contratado.</span>
                      </div>
                    )}
                  </div>
                )}
                <AnimatePresence>
                  {showNewPaymentForm && (
                    <motion.div key="new-payment-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
                      {renderPaymentForm('new')}
                    </motion.div>
                  )}
                </AnimatePresence>
                {payments.length === 0 && !showNewPaymentForm ? (
                  <p className="py-2 text-xs text-[#aaa]">Sin pagos registrados</p>
                ) : (
                  <ul className="space-y-1.5">
                    {payments.map(p => {
                      const isEditing = editingPaymentId === p.id
                      return (
                        <li key={p.id} className="space-y-1.5">
                          {!isEditing && (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e8e8e8] bg-white px-3 py-2 text-sm">
                              <button onClick={() => openEditPaymentForm(p)} className="min-w-0 flex-1 text-left">
                                <div className="font-semibold text-[#1D1E20]">{formatCurrency(p.amount, currency)}</div>
                                <div className="truncate text-[10px] text-[#888]">
                                  {p.payment_date}
                                  {p.payment_method && ` • ${PAYMENT_METHOD_LABELS[p.payment_method]}`}
                                  {p.paid_by && ` • ${PAID_BY_LABELS[p.paid_by]}`}
                                  {p.reference && ` • ${p.reference}`}
                                </div>
                              </button>
                              <div className="flex shrink-0 items-center gap-1">
                                <button onClick={() => openEditPaymentForm(p)} className="rounded p-1 text-[#aaa] hover:bg-[#f5f5f5] hover:text-[#1D1E20]"><Pencil size={13} /></button>
                                <button onClick={() => handleDeletePayment(p.id)} className="rounded p-1 text-[#aaa] hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          )}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div key={`edit-form-${p.id}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                {renderPaymentForm('edit')}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ⑦ NOTAS */}
        <Section title="Notas del proveedor">
          <textarea value={supplierNotes} onChange={e => setSupplierNotes(e.target.value)} rows={3} placeholder="Detalles, acuerdos, observaciones..." className={`${INPUT_CLASS} w-full resize-none`} />
        </Section>

        {/* ⑧ ARCHIVOS PRO */}
        <Section title="Archivos">
          <button onClick={() => setShowProModal(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#e8e8e8] bg-[#fafafa] px-4 py-4 text-sm text-[#666] transition-colors hover:border-[#1D1E20] hover:bg-white">
            <Paperclip size={16} />
            <span>Añadir archivos</span>
            <span className="rounded bg-[#1D1E20] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">PRO</span>
          </button>
        </Section>

        {/* ⑨ REVIEW existente */}
        {hasReview && (
          <Section title="Review">
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
              {item.rating && (
                <div className="mb-1 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} size={16} className={n <= (item.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-[#d4d4d4]'} />
                  ))}
                </div>
              )}
              {item.review_text && <p className="mb-2 text-sm text-[#1D1E20]">{item.review_text}</p>}
              <button
                onClick={() => { onClose(); onReviewNeeded(item) }}
                className="flex items-center gap-1 text-xs font-medium text-[#48C9B0] hover:text-[#3aa896]"
              >
                <Pencil size={11} />Editar review
              </button>
            </div>
          </Section>
        )}

        <div className="h-2" />
      </Modal.Body>

      <Modal.Footer>
        <div className="flex w-full items-center justify-between gap-2">
          <button onClick={handleDelete} disabled={deleting || saving} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">
            <Trash2 size={15} />
            <span>{deleting ? 'Eliminando...' : 'Eliminar'}</span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={saving || deleting} className="px-4 py-2 text-sm text-[#666] hover:text-[#1D1E20] disabled:opacity-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving || deleting} className="rounded-lg bg-[#48C9B0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Modal.Footer>

      {/* modal anidado: el primitivo lo portaliza fuera del panel y lleva el conteo de capas */}
      <Modal open={showProModal} onClose={() => setShowProModal(false)} size="sm">
        <Modal.Body className="py-6 text-center">
          <div className="mb-3 inline-block rounded-full bg-[#1D1E20] px-2.5 py-1 text-[10px] font-bold uppercase text-white">Próximamente PRO</div>
          <h3 className="mb-2 text-base font-semibold text-[#1D1E20]">Archivos del proveedor</h3>
          <p className="text-sm text-[#666]">Sube contratos, cotizaciones y comprobantes. Disponible próximamente en plan PRO.</p>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setShowProModal(false)} className="w-full rounded-lg bg-[#1D1E20] px-4 py-2 text-sm font-semibold text-white hover:bg-black">Entendido</button>
        </Modal.Footer>
      </Modal>
    </Modal>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#888]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs text-[#888]">{label}</label>
      {children}
    </div>
  )
}