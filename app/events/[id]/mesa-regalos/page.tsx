'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Gift, Plus, Link2, Copy, Check, Trash2, ExternalLink, Coins, Mail, Heart, Eye, Settings, Landmark, Pencil,
} from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { GiftRegistryItem, GiftReservation, RegistryPaymentMethod, normalizePaymentMethods } from '@/lib/types'
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import AddGiftModal, { NewGiftData, GIFT_CATEGORIES } from './AddGiftModal'
import PaymentMethodModal, { payTypeMeta } from './PaymentMethodModal'

function generateToken(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const fmtMXN = (n: number) => '$ ' + (n || 0).toLocaleString('es-MX')

const categoryLabel = (id: string | null) =>
  GIFT_CATEGORIES.find(c => c.id === id)?.label || 'Otro'

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  external: { label: 'Tienda', icon: <ExternalLink size={11} /> },
  fund:     { label: 'Fondo',  icon: <Coins size={11} /> },
  cash:     { label: 'Sobre',  icon: <Mail size={11} /> },
}

export default function MesaRegalosPage() {
  const { id } = useParams()
  const eventId = id as string
  const statsToggle = useStatsToggle(eventId, 'mesa-regalos')

  const [items, setItems]               = useState<GiftRegistryItem[]>([])
  const [reservations, setReservations] = useState<GiftReservation[]>([])
  const [token, setToken]               = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState('regalos')
  const [showAdd, setShowAdd]           = useState(false)
  const [editing, setEditing]           = useState<GiftRegistryItem | null>(null)
  const [copied, setCopied]             = useState(false)
  const [filter, setFilter]             = useState<'all' | 'external' | 'fund' | 'cash'>('all')
  const [payMethods, setPayMethods]     = useState<RegistryPaymentMethod[]>([])
  const [showPayModal, setShowPayModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState<RegistryPaymentMethod | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const [{ data: settings }, { data: itemsData }, { data: resData }] = await Promise.all([
        supabase.from('event_settings').select('registry_token, registry_payment_info').eq('event_id', eventId).maybeSingle(),
        supabase.from('gift_registry_items').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
        supabase.from('gift_reservations').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      ])
      setToken(settings?.registry_token || null)
      setPayMethods(normalizePaymentMethods(settings?.registry_payment_info))
      setItems((itemsData as GiftRegistryItem[]) || [])
      setReservations((resData as GiftReservation[]) || [])
      setLoading(false)
    }
    loadData()
  }, [eventId])

  const handleGenerateLink = async () => {
    const newToken = generateToken()
    setToken(newToken)
    await supabase.from('event_settings').update({ registry_token: newToken }).eq('event_id', eventId)
  }

  const persistMethods = async (methods: RegistryPaymentMethod[]) => {
    setPayMethods(methods)
    await supabase
      .from('event_settings')
      .update({ registry_payment_info: methods.length ? { methods } : null })
      .eq('event_id', eventId)
  }

  const handleSaveMethod = async (m: RegistryPaymentMethod) => {
    const exists = payMethods.some(x => x.id === m.id)
    await persistMethods(exists ? payMethods.map(x => x.id === m.id ? m : x) : [...payMethods, m])
  }

  const handleDeleteMethod = async (id: string) => {
    if (!confirm('¿Eliminar este método de pago?')) return
    await persistMethods(payMethods.filter(x => x.id !== id))
  }

  const openAddMethod  = () => { setEditingMethod(null); setShowPayModal(true) }
  const openEditMethod = (m: RegistryPaymentMethod) => { setEditingMethod(m); setShowPayModal(true) }

  const handleSubmitGift = async (data: NewGiftData) => {
    if (editing) {
      const { data: updated } = await supabase
        .from('gift_registry_items').update(data).eq('id', editing.id).select().single()
      if (updated) setItems(prev => prev.map(i => i.id === editing.id ? (updated as GiftRegistryItem) : i))
    } else {
      const { data: inserted } = await supabase
        .from('gift_registry_items').insert({ event_id: eventId, ...data }).select().single()
      if (inserted) setItems(prev => [inserted as GiftRegistryItem, ...prev])
    }
  }

  const openAdd    = () => { setEditing(null); setShowAdd(true) }
  const openEdit   = (item: GiftRegistryItem) => { setEditing(item); setShowAdd(true) }
  const closeModal = () => { setShowAdd(false); setEditing(null) }

  const handleDeleteGift = async (itemId: string) => {
    if (!confirm('¿Eliminar este regalo de la mesa?')) return
    await supabase.from('gift_registry_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
    setReservations(prev => prev.filter(r => r.item_id !== itemId))
  }

  const handleToggleThanked = async (r: GiftReservation) => {
    await supabase.from('gift_reservations').update({ thanked: !r.thanked }).eq('id', r.id)
    setReservations(prev => prev.map(x => x.id === r.id ? { ...x, thanked: !x.thanked } : x))
  }

  const waThanksUrl = (r: GiftReservation, gift: GiftRegistryItem | undefined) => {
    const num = (r.guest_phone || '').replace(/\D/g, '')
    const firstName = r.guest_name.split(' ')[0]
    const text = gift?.type === 'fund'
      ? `¡Hola ${firstName}! Mil gracias por tu aporte a "${gift.title}". Nos hace mucha ilusión, un abrazo.`
      : gift?.type === 'cash'
      ? `¡Hola ${firstName}! Mil gracias por tu sobre. Nos hace mucha ilusión, un abrazo.`
      : `¡Hola ${firstName}! Mil gracias por regalarnos "${gift?.title || 'tu detalle'}". Nos hace mucha ilusión, un abrazo.`
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
  }

  const thankByWhatsApp = async (r: GiftReservation, gift: GiftRegistryItem | undefined) => {
    window.open(waThanksUrl(r, gift), '_blank', 'noopener,noreferrer')
    if (r.thanked) return
    await supabase.from('gift_reservations').update({ thanked: true }).eq('id', r.id)
    setReservations(prev => prev.map(x => x.id === r.id ? { ...x, thanked: true } : x))
  }

  const publicUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/mesa/${token}`
    : null

  const copyLink = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const waShareUrl = publicUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Te compartimos nuestra mesa de regalos:\n${publicUrl}`)}`
    : '#'

  // Reservaciones agrupadas por regalo (buyers = "lo regalo completo", sin monto)
  const byItem = new Map<string, { count: number; sum: number; buyers: number }>()
  for (const r of reservations) {
    const cur = byItem.get(r.item_id) || { count: 0, sum: 0, buyers: 0 }
    cur.count += 1
    cur.sum += r.amount || 0
    if (r.amount == null) cur.buyers += 1
    byItem.set(r.item_id, cur)
  }

  const totalIntent   = reservations.reduce((a, r) => a + (r.amount || 0), 0)
  const reservedItems = new Set(reservations.map(r => r.item_id)).size

  const visible = items.filter(i => filter === 'all' || i.type === filter)
  const itemById = new Map(items.map(i => [i.id, i]))

  const TABS: TabItem[] = [
    { key: 'regalos',   label: 'Regalos',   icon: Gift },
    { key: 'recibidos', label: 'Recibidos', icon: Heart, badge: reservations.length || undefined },
    { key: 'config',    label: 'Configuración', icon: Settings },
  ]

  if (loading) {
    return <div className="p-8 text-sm text-[#666]">Cargando mesa de regalos...</div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* Zona fija: header + stats + tabs (mismo patron que presupuesto) */}
      <div className="shrink-0 border-b border-[#e8e8e8] px-4 pt-4 sm:px-6 sm:pt-5">

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1D1E20]">Mesa de regalos</h1>
            <p className="mt-0.5 text-xs text-[#888]">Arma y comparte tu lista de regalos.</p>
          </div>
          <div className="shrink-0 pt-1 lg:hidden">
            <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
          </div>
        </div>

        {/* Stats arriba */}
        <StatsCollapse visible={statsToggle.visible}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Regalos</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#1D1E20]">{items.length}</p>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Apartados</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#1D1E20]">{reservedItems}</p>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Intención $</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#1a9e88]">{fmtMXN(totalIntent)}</p>
            </div>
          </div>
        </StatsCollapse>

        {/* Toggle (centrado en mobile, izquierda en desktop) */}
        <div className="mb-4 flex justify-center sm:justify-start">
          <TabToggle tabs={TABS} active={tab} onChange={setTab} />
        </div>
      </div>

      {/* Zona scrolleable: contenido del tab */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">

        {/* ── Tab: Regalos ── */}
        {tab === 'regalos' && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {([
                  { id: 'all',      label: 'Todos' },
                  { id: 'external', label: 'De tienda' },
                  { id: 'fund',     label: 'Fondos' },
                  { id: 'cash',     label: 'Sobres' },
                ] as const).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition
                      ${filter === f.id
                        ? 'border-[#48C9B0] bg-[#48C9B0] text-white'
                        : 'border-[#e0e0e0] bg-white text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
              >
                <Plus size={15} /> Agregar regalo
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] px-6 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#bbb]">
                  <Gift size={22} />
                </div>
                <p className="text-sm font-semibold text-[#1D1E20]">Tu mesa está vacía</p>
                <p className="mt-1 text-xs text-[#888]">Agrega tu primer regalo para empezar a recibir detalles.</p>
                <button
                  onClick={openAdd}
                  className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
                >
                  <Plus size={14} /> Agregar regalo
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {visible.map(item => {
                  const res = byItem.get(item.id) || { count: 0, sum: 0, buyers: 0 }
                  const pct = item.type === 'fund' && item.target_amount
                    ? Math.min(100, Math.round((res.sum / item.target_amount) * 100))
                    : 0
                  return (
                    <div
                      key={item.id}
                      onClick={() => openEdit(item)}
                      className="flex cursor-pointer gap-3 rounded-xl border border-[#e8e8e8] bg-white p-3 transition hover:border-[#48C9B0]"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f0fdfb]">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#48C9B0]">
                            {item.type === 'fund' ? <Coins size={22} /> : item.type === 'cash' ? <Mail size={22} /> : <Gift size={22} />}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-2 py-0.5 text-[10px] font-medium text-[#666]">
                            {TYPE_META[item.type].icon} {TYPE_META[item.type].label}
                          </span>
                          {item.type !== 'cash' && (
                            <span className="rounded-full border border-[#e8e8e8] bg-white px-2 py-0.5 text-[10px] text-[#888]">
                              {categoryLabel(item.category)}
                            </span>
                          )}
                          {item.store && <span className="text-[10px] text-[#aaa]">{item.store}</span>}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-[#1D1E20]">{item.title}</p>

                        {item.type === 'fund' ? (
                          <div className="mt-1.5">
                            <div className="h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
                              <div className="h-full rounded-full bg-[#48C9B0]" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-1 text-[11px] tabular-nums text-[#888]">
                              {fmtMXN(res.sum)}{item.target_amount ? ` de ${fmtMXN(item.target_amount)}` : ''} · {res.count} {res.count === 1 ? 'aporte' : 'aportes'}
                            </p>
                          </div>
                        ) : item.type === 'external' ? (
                          <p className="mt-1 text-[11px] tabular-nums text-[#888]">
                            {item.price ? fmtMXN(item.price) + ' · ' : ''}
                            {res.buyers > 0
                              ? <span className="font-medium text-[#1a9e88]">Apartado por {res.buyers}</span>
                              : res.sum > 0
                              ? <span className="font-medium text-[#1a9e88]">
                                  {fmtMXN(res.sum)} aportados{item.price ? ` (${Math.min(100, Math.round((res.sum / item.price) * 100))}%)` : ''}
                                </span>
                              : 'Disponible'}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] tabular-nums text-[#888]">
                            {res.count > 0 ? `${fmtMXN(res.sum)} · ${res.count} ${res.count === 1 ? 'sobre' : 'sobres'}` : 'Sin sobres aún'}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end justify-between">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteGift(item.id) }}
                          title="Eliminar"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#bbb] transition hover:bg-[#fff0f0] hover:text-[#cc3333]"
                        >
                          <Trash2 size={14} />
                        </button>
                        {res.count > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-[#aaa]">
                            <Heart size={11} className="text-[#48C9B0]" /> {res.count}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Recibidos ── */}
        {tab === 'recibidos' && (
          reservations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#bbb]">
                <Heart size={22} />
              </div>
              <p className="text-sm font-semibold text-[#1D1E20]">Aún no recibes regalos</p>
              <p className="mt-1 text-xs text-[#888]">Comparte tu link y aquí verás quién te apartó cada detalle.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reservations.map(r => {
                const gift = itemById.get(r.item_id)
                return (
                  <div key={r.id} className="flex flex-col rounded-xl border border-[#e8e8e8] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1D1E20]">{r.guest_name}</p>
                        <p className="truncate text-xs text-[#888]">{gift?.title || 'Regalo'}</p>
                      </div>
                      {r.guest_phone && (
                        <button
                          onClick={() => thankByWhatsApp(r, gift)}
                          title="Agradecer por WhatsApp"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#25D366] transition hover:border-[#25D366] hover:bg-[#25D366] hover:text-white"
                        >
                          <FaWhatsapp size={18} />
                        </button>
                      )}
                    </div>

                    {r.message && (
                      <p className="mt-2 line-clamp-3 text-xs italic leading-relaxed text-[#999]">“{r.message}”</p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f0f0f0] pt-3">
                      {r.amount
                        ? <span className="text-sm font-semibold tabular-nums text-[#1a9e88]">{fmtMXN(r.amount)}</span>
                        : <span className="text-xs text-[#aaa]">Regalo apartado</span>}
                      <button
                        onClick={() => handleToggleThanked(r)}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition
                          ${r.thanked
                            ? 'border-[#c8ede7] bg-[#f0fdfb] text-[#1a9e88]'
                            : 'border-[#e0e0e0] bg-white text-[#888] hover:border-[#48C9B0] hover:text-[#48C9B0]'}`}
                      >
                        {r.thanked ? <><Check size={12} /> Agradecido</> : 'Marcar agradecido'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── Tab: Configuración ── */}
        {tab === 'config' && (
          <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
              <Link2 size={15} className="text-[#48C9B0]" />
              <h2 className="text-sm font-semibold text-[#1D1E20]">Link público de tu mesa</h2>
            </div>
            <p className="mb-3 text-xs text-[#888]">Compártelo con tus invitados para que vean y aparten regalos.</p>
            {publicUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2">
                  <span className="truncate font-mono text-xs text-[#555]">{publicUrl.replace(/^https?:\/\//, '')}</span>
                </div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
                >
                  {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
                </button>
                <a
                  href={waShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#555] transition hover:border-[#25D366] hover:text-[#25D366]"
                >
                  <FaWhatsapp size={14} /> WhatsApp
                </a>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:w-auto"
                >
                  <Eye size={14} /> Ver como invitado
                </a>
              </div>
            ) : (
              <button
                onClick={handleGenerateLink}
                className="flex items-center gap-1.5 rounded-lg bg-[#1D1E20] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
              >
                <Link2 size={14} /> Generar link
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
              <Landmark size={15} className="text-[#48C9B0]" />
              <h2 className="text-sm font-semibold text-[#1D1E20]">Cuenta para recibir regalos</h2>
            </div>
            <p className="mb-3 text-xs text-[#888]">
              Estos métodos se muestran al invitado después de confirmar un aporte o sobre.
            </p>

            {payMethods.length > 0 && (
              <div className="mb-3 divide-y divide-[#f0f0f0] rounded-lg border border-[#e8e8e8]">
                {payMethods.map(m => {
                  const meta = payTypeMeta(m.type)
                  const masked = (m.type === 'transfer' || m.type === 'card')
                    ? `•••• ${m.value.slice(-4)}`
                    : m.value
                  const line = m.type === 'other'
                    ? m.label
                    : [m.bank, m.holder].filter(Boolean).join(' · ')
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0fdfb] text-[#1a9e88]">
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#1D1E20]">
                          {m.type === 'other' && m.label ? m.label : meta.label}
                          {line && m.type !== 'other' && <span className="ml-1.5 font-normal text-[#888]">{line}</span>}
                        </p>
                        <p className="truncate text-[11px] tabular-nums text-[#888]">{masked}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => openEditMethod(m)}
                          title="Editar"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#bbb] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteMethod(m.id)}
                          title="Eliminar"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#bbb] transition hover:bg-[#fff0f0] hover:text-[#cc3333]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={openAddMethod}
              className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
            >
              <Plus size={14} /> Agregar método
            </button>
          </div>
          </div>
        )}

      </div>

      <AddGiftModal isOpen={showAdd} initial={editing} onClose={closeModal} onSubmit={handleSubmitGift} />
      <PaymentMethodModal
        isOpen={showPayModal}
        initial={editingMethod}
        onClose={() => { setShowPayModal(false); setEditingMethod(null) }}
        onSave={handleSaveMethod}
      />
    </div>
  )
}
