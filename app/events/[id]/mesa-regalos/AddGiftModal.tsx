'use client'

import { useState, useEffect } from 'react'
import { X, ExternalLink, Coins, Mail } from 'lucide-react'
import { GiftType } from '@/lib/types'

export const GIFT_CATEGORIES = [
  { id: 'viajes',       label: 'Viajes' },
  { id: 'hogar',        label: 'Hogar' },
  { id: 'experiencias', label: 'Experiencias' },
  { id: 'estilo',       label: 'Estilo de vida' },
  { id: 'otro',         label: 'Otro' },
]

export type NewGiftData = {
  type: GiftType
  title: string
  description: string | null
  category: string | null
  image_url: string | null
  external_url: string | null
  store: string | null
  price: number | null
  target_amount: number | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: NewGiftData) => Promise<void>
}

const TYPES: { id: GiftType; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'external', label: 'Desde tienda', sub: 'Link a Amazon, Liverpool...', icon: <ExternalLink size={15} /> },
  { id: 'fund',     label: 'Fondo',        sub: 'Con meta, varios aportan',    icon: <Coins size={15} /> },
  { id: 'cash',     label: 'Sobre',        sub: 'Efectivo, monto libre',       icon: <Mail size={15} /> },
]

export default function AddGiftModal({ isOpen, onClose, onSubmit }: Props) {
  const [type, setType]               = useState<GiftType>('external')
  const [title, setTitle]             = useState('')
  const [category, setCategory]       = useState('hogar')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl]       = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [store, setStore]             = useState('')
  const [price, setPrice]             = useState('')
  const [target, setTarget]           = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (isOpen) {
      setType('external')
      setTitle(''); setCategory('hogar'); setDescription(''); setImageUrl('')
      setExternalUrl(''); setStore(''); setPrice(''); setTarget('')
      setSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const canSubmit =
    title.trim() !== '' &&
    (type === 'external' ? externalUrl.trim() !== '' :
     type === 'fund'     ? parseFloat(target) > 0 :
     true)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        type,
        title: title.trim(),
        description: description.trim() || null,
        category: type === 'cash' ? 'otro' : category,
        image_url: imageUrl.trim() || null,
        external_url: type === 'external' ? externalUrl.trim() : null,
        store: type === 'external' ? (store.trim() || null) : null,
        price: type === 'external' && price ? parseFloat(price) : null,
        target_amount: type === 'fund' && target ? parseFloat(target) : null,
      })
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'
  const labelCls =
    'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]'

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">

          <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-[#1D1E20]">Agregar regalo</h2>
              <p className="text-xs text-[#888]">Suma un detalle a tu mesa de regalos</p>
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

              {/* Tipo */}
              <div>
                <label className={labelCls}>Tipo de regalo</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map(t => {
                    const active = type === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
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

              {/* Link externo */}
              {type === 'external' && (
                <div>
                  <label className={labelCls}>Link de la tienda</label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    placeholder="https://liverpool.com.mx/..."
                    className={inputCls}
                  />
                  <p className="mt-1 text-[10px] text-[#aaa]">El invitado abrirá este link para comprarlo.</p>
                </div>
              )}

              {/* Titulo */}
              <div>
                <label className={labelCls}>Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={
                    type === 'fund' ? 'Ej. Fondo para la luna de miel' :
                    type === 'cash' ? 'Ej. Sobre' :
                    'Ej. Vajilla de cerámica'
                  }
                  className={inputCls}
                />
              </div>

              {/* Meta del fondo */}
              {type === 'fund' && (
                <div>
                  <label className={labelCls}>Meta (MXN)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={target}
                    onChange={e => {
                      const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                      if (cleaned.split('.').length > 2) return
                      setTarget(cleaned)
                    }}
                    placeholder="50000"
                    className={`${inputCls} tabular-nums`}
                  />
                </div>
              )}

              {/* Precio + tienda (external) */}
              {type === 'external' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Precio aprox. (MXN)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                        if (cleaned.split('.').length > 2) return
                        setPrice(cleaned)
                      }}
                      placeholder="2890"
                      className={`${inputCls} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Tienda</label>
                    <input
                      type="text"
                      value={store}
                      onChange={e => setStore(e.target.value)}
                      placeholder="Liverpool"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Categoria (no cash) */}
              {type !== 'cash' && (
                <div>
                  <label className={labelCls}>Categoría</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className={inputCls}
                  >
                    {GIFT_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Imagen (opcional, no cash) */}
              {type !== 'cash' && (
                <div>
                  <label className={labelCls}>Imagen (opcional)</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://...jpg"
                    className={inputCls}
                  />
                  <p className="mt-1 text-[10px] text-[#aaa]">Pega el link de una foto. Si lo dejas vacío usamos un ícono.</p>
                </div>
              )}

              {/* Nota */}
              <div>
                <label className={labelCls}>Nota para los invitados (opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder={
                    type === 'cash'
                      ? 'Si prefieres regalarnos algo en efectivo, este es el lugar.'
                      : '¿Por qué elegiste este regalo?'
                  }
                  className={`${inputCls} resize-none`}
                />
              </div>

            </div>
          </div>

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
              disabled={submitting || !canSubmit}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Agregar regalo'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
