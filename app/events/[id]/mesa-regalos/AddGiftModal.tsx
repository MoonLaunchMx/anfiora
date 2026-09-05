'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Coins, Mail, Check } from 'lucide-react'
import { GiftType, GiftRegistryItem, GIFT_CATEGORIES } from '@/lib/types'
import { Modal } from '@/app/components/ui/Modal'
import { usePermiso } from '@/lib/event-access-context'

export { GIFT_CATEGORIES }

function guessCategory(text: string): string | null {
  const t = text.toLowerCase()
  if (/(viaje|luna de miel|hotel|vuelo|maleta|equipaje|tour|crucero|airbnb)/.test(t)) return 'viajes'
  if (/(vajilla|sabana|sábana|cocina|olla|sarten|sartén|cafetera|licuadora|toalla|edredon|edredón|mueble|lampara|lámpara|copa|cubierto|plato|cobija)/.test(t)) return 'hogar'
  if (/(cena|experiencia|spa|masaje|clase|taller|boleto|concierto|restaurante|degustacion|degustación)/.test(t)) return 'experiencias'
  if (/(bici|reloj|ropa|zapato|perfume|gadget|audifono|audífono|camara|cámara|maquillaje)/.test(t)) return 'estilo'
  return null
}

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
  initial?: GiftRegistryItem | null
}

const TYPES: { id: GiftType; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'external', label: 'Desde tienda', sub: 'Link a Amazon, Liverpool...', icon: <ExternalLink size={15} /> },
  { id: 'fund',     label: 'Fondo',        sub: 'Con meta, varios aportan',    icon: <Coins size={15} /> },
  { id: 'cash',     label: 'Sobre',        sub: 'Efectivo, monto libre',       icon: <Mail size={15} /> },
]

export default function AddGiftModal({ isOpen, onClose, onSubmit, initial }: Props) {
  const permiso = usePermiso('regalos')
  const isEdit = !!initial
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
  const [fetching, setFetching]       = useState(false)
  const [detectedStore, setDetected]  = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (initial) {
      setType(initial.type)
      setTitle(initial.title || '')
      setCategory(initial.category || 'hogar')
      setDescription(initial.description || '')
      setImageUrl(initial.image_url || '')
      setExternalUrl(initial.external_url || '')
      setStore(initial.store || '')
      setPrice(initial.price != null ? String(initial.price) : '')
      setTarget(initial.target_amount != null ? String(initial.target_amount) : '')
      setDetected(initial.store || null)
    } else {
      setType('external')
      setTitle(''); setCategory('hogar'); setDescription(''); setImageUrl('')
      setExternalUrl(''); setStore(''); setPrice(''); setTarget('')
      setDetected(null)
    }
    setSubmitting(false); setFetching(false)
  }, [isOpen, initial])

  // Auto-rellenar desde el link de la tienda (Open Graph / JSON-LD)
  useEffect(() => {
    if (type !== 'external') return
    const url = externalUrl.trim()
    if (!/^https?:\/\/.+\..+/.test(url)) { setDetected(null); return }
    const ctrl = new AbortController()
    setFetching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
        const data = await res.json()
        if (data?.ok) {
          if (data.title && !title.trim())   setTitle(data.title)
          if (data.store && !store.trim())   setStore(data.store)
          if (data.price && !price)          setPrice(String(data.price))
          if (data.image && !imageUrl.trim()) setImageUrl(data.image)
          if (data.store) setDetected(data.store)
          const g = guessCategory(`${data.title || ''} ${url}`)
          if (g) setCategory(g)
        }
      } catch { /* sin conexion / abortado */ }
      finally { setFetching(false) }
    }, 700)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [externalUrl, type])

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
    'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'
  const labelCls =
    'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]'

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header
        title={isEdit ? 'Editar regalo' : 'Agregar regalo'}
        subtitle={isEdit ? 'Actualiza los datos de este regalo' : 'Suma un detalle a tu mesa de regalos'}
      />

      <Modal.Body>
      <fieldset disabled={!permiso.editar} className="m-0 min-w-0 border-0 p-0">
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
              <div className="relative">
                <input
                  type="url"
                  value={externalUrl}
                  onChange={e => setExternalUrl(e.target.value)}
                  placeholder="https://liverpool.com.mx/..."
                  className={`${inputCls} ${fetching ? 'pr-9' : ''}`}
                />
                {fetching && (
                  <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
                )}
              </div>
              {detectedStore ? (
                <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-[#1a9e88]">
                  <Check size={11} /> Datos detectados desde {detectedStore}. Puedes editarlos.
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-[#aaa]">
                  Pega el link y rellenamos título, precio, tienda e imagen solos.
                </p>
              )}
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
              <div className="flex items-center gap-2">
                {imageUrl.trim() && (
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-[#e8e8e8] object-cover"
                    onError={e => { (e.currentTarget.style.display = 'none') }}
                  />
                )}
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://...jpg"
                  className={inputCls}
                />
              </div>
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
      </fieldset>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          disabled={submitting}
          className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
        >
          {permiso.editar ? 'Cancelar' : 'Cerrar'}
        </button>
        {permiso.editar && <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
        >
          {submitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar regalo'}
        </button>}
      </Modal.Footer>
    </Modal>
  )
}
