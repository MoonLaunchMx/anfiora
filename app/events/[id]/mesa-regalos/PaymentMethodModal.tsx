'use client'

import { useState, useEffect } from 'react'
import { X, Landmark, CreditCard, Wallet, Zap, Banknote } from 'lucide-react'
import { FaPaypal } from 'react-icons/fa'
import { RegistryPaymentMethod, RegistryPaymentMethodType } from '@/lib/types'

export const PAY_TYPES: {
  id: RegistryPaymentMethodType
  label: string
  sub: string
  icon: React.ReactNode
}[] = [
  { id: 'transfer',     label: 'Transferencia', sub: 'SPEI con CLABE',          icon: <Landmark size={15} /> },
  { id: 'card',         label: 'Tarjeta',       sub: 'Depósito a tarjeta',      icon: <CreditCard size={15} /> },
  { id: 'mercado_pago', label: 'Mercado Pago',  sub: 'Link de dinero',          icon: <Wallet size={15} /> },
  { id: 'paypal',       label: 'PayPal',        sub: 'Link paypal.me',          icon: <FaPaypal size={14} /> },
  { id: 'zelle',        label: 'Zelle',         sub: 'Para invitados en USA',   icon: <Zap size={15} /> },
  { id: 'other',        label: 'Otro',          sub: 'Cualquier app o medio',   icon: <Banknote size={15} /> },
]

export const payTypeMeta = (t: RegistryPaymentMethodType) =>
  PAY_TYPES.find(p => p.id === t) || PAY_TYPES[5]

function normalizeUrl(v: string): string {
  const t = v.trim()
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSave: (m: RegistryPaymentMethod) => Promise<void>
  initial?: RegistryPaymentMethod | null
}

export default function PaymentMethodModal({ isOpen, onClose, onSave, initial }: Props) {
  const isEdit = !!initial
  const [type, setType]       = useState<RegistryPaymentMethodType>('transfer')
  const [bank, setBank]       = useState('')
  const [holder, setHolder]   = useState('')
  const [value, setValue]     = useState('')
  const [label, setLabel]     = useState('')
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      setType(initial.type)
      setBank(initial.bank || '')
      setHolder(initial.holder || '')
      setValue(initial.value || '')
      setLabel(initial.label || '')
    } else {
      setType('transfer')
      setBank(''); setHolder(''); setValue(''); setLabel('')
    }
    setError(''); setSaving(false)
  }, [isOpen, initial])

  if (!isOpen) return null

  const validate = (): string | null => {
    const v = value.trim()
    if (type === 'transfer') {
      if (!/^\d{18}$/.test(v.replace(/\s/g, ''))) return 'La CLABE debe tener exactamente 18 dígitos.'
    } else if (type === 'card') {
      if (!/^\d{15,16}$/.test(v.replace(/\s/g, ''))) return 'El número de tarjeta debe tener 15 o 16 dígitos.'
    } else if (type === 'mercado_pago' || type === 'paypal') {
      if (!/.+\..+/.test(v)) return 'Pega el link completo.'
    } else if (type === 'zelle') {
      const isEmail = /^\S+@\S+\.\S+$/.test(v)
      const isPhone = /^\+?\d{10,15}$/.test(v.replace(/[\s()-]/g, ''))
      if (!isEmail && !isPhone) return 'Escribe el email o teléfono registrado en Zelle.'
    } else {
      if (!label.trim()) return 'Escribe el nombre del medio (ej. Wise).'
      if (!v) return 'Escribe el link o la instrucción.'
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)
    const isLink = type === 'mercado_pago' || type === 'paypal'
    try {
      await onSave({
        id: initial?.id || Math.random().toString(36).slice(2, 10),
        type,
        bank: (type === 'transfer' || type === 'card') ? bank.trim() : undefined,
        holder: (type === 'transfer' || type === 'card' || type === 'zelle') ? holder.trim() : undefined,
        value: isLink ? normalizeUrl(value)
          : (type === 'transfer' || type === 'card') ? value.replace(/\s/g, '')
          : value.trim(),
        label: type === 'other' ? label.trim() : undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'
  const labelCls =
    'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]'

  const valueLabel =
    type === 'transfer'     ? 'CLABE (18 dígitos)' :
    type === 'card'         ? 'Número de tarjeta' :
    type === 'mercado_pago' ? 'Link de Mercado Pago' :
    type === 'paypal'       ? 'Link de PayPal' :
    type === 'zelle'        ? 'Email o teléfono de Zelle' :
    'Link o instrucción'

  const valuePlaceholder =
    type === 'transfer'     ? '18 dígitos' :
    type === 'card'         ? '16 dígitos' :
    type === 'mercado_pago' ? 'link.mercadopago.com.mx/tunombre' :
    type === 'paypal'       ? 'paypal.me/tunombre' :
    type === 'zelle'        ? 'correo@ejemplo.com' :
    'Link o cómo depositarte'

  const numericValue = type === 'transfer' || type === 'card'

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">

          <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-[#1D1E20]">{isEdit ? 'Editar método' : 'Agregar método'}</h2>
              <p className="text-xs text-[#888]">Cómo pueden hacerte llegar un regalo en dinero</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#aaa] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">

              {!isEdit && (
                <div>
                  <label className={labelCls}>Tipo de método</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PAY_TYPES.map(t => {
                      const active = type === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setType(t.id); setError('') }}
                          className={`flex flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition
                            ${active
                              ? 'border-[#48C9B0] bg-[#f0fdfb]'
                              : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]'}`}
                        >
                          <span className={active ? 'text-[#1a9e88]' : 'text-[#888]'}>{t.icon}</span>
                          <span className={`text-xs font-semibold ${active ? 'text-[#1D1E20]' : 'text-[#666]'}`}>
                            {t.label}
                          </span>
                          <span className="text-[10px] leading-tight text-[#aaa]">{t.sub}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {type === 'other' && (
                <div>
                  <label className={labelCls}>Nombre del medio</label>
                  <input
                    className={inputCls}
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="Ej. Wise, OXXO, Bitso"
                  />
                </div>
              )}

              {(type === 'transfer' || type === 'card') && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Banco</label>
                    <input className={inputCls} value={bank} onChange={e => setBank(e.target.value)} placeholder="Ej. BBVA" />
                  </div>
                  <div>
                    <label className={labelCls}>Titular</label>
                    <input className={inputCls} value={holder} onChange={e => setHolder(e.target.value)} placeholder="Ej. María Pérez" />
                  </div>
                </div>
              )}

              {type === 'zelle' && (
                <div>
                  <label className={labelCls}>Titular</label>
                  <input className={inputCls} value={holder} onChange={e => setHolder(e.target.value)} placeholder="Ej. María Pérez" />
                </div>
              )}

              <div>
                <label className={labelCls}>{valueLabel}</label>
                <input
                  className={`${inputCls} ${numericValue ? 'tabular-nums' : ''}`}
                  inputMode={numericValue ? 'numeric' : undefined}
                  maxLength={numericValue ? (type === 'transfer' ? 18 : 16) : undefined}
                  value={value}
                  onChange={e => setValue(numericValue ? e.target.value.replace(/\D/g, '') : e.target.value)}
                  placeholder={valuePlaceholder}
                />
              </div>

              {error && <p className="text-xs text-[#cc3333]">{error}</p>}

            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar método'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
