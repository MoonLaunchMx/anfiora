'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Gift, Plus, Link2, Copy, Check, Trash2, ExternalLink, Coins, Mail, Heart, Eye,
} from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { GiftRegistryItem, GiftReservation } from '@/lib/types'
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
import StatsCollapse, { useStatsToggle, StatsToggleButton } from '@/app/components/ui/StatsCollapse'
import AddGiftModal, { NewGiftData, GIFT_CATEGORIES } from './AddGiftModal'

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

  useEffect(() => {
    const loadData = async () => {
      const [{ data: settings }, { data: itemsData }, { data: resData }] = await Promise.all([
        supabase.from('event_settings').select('registry_token').eq('event_id', eventId).maybeSingle(),
        supabase.from('gift_registry_items').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
        supabase.from('gift_reservations').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      ])
      setToken(settings?.registry_token || null)
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

  // Reservaciones agrupadas por regalo
  const byItem = new Map<string, { count: number; sum: number }>()
  for (const r of reservations) {
    const cur = byItem.get(r.item_id) || { count: 0, sum: 0 }
    cur.count += 1
    cur.sum += r.amount || 0
    byItem.set(r.item_id, cur)
  }

  const totalIntent   = reservations.reduce((a, r) => a + (r.amount || 0), 0)
  const reservedItems = new Set(reservations.map(r => r.item_id)).size

  const visible = items.filter(i => filter === 'all' || i.type === filter)
  const itemById = new Map(items.map(i => [i.id, i]))

  const TABS: TabItem[] = [
    { key: 'regalos',   label: 'Regalos',   icon: Gift },
    { key: 'recibidos', label: 'Recibidos', icon: Heart, badge: reservations.length || undefined },
    { key: 'compartir', label: 'Compartir', icon: Link2 },
  ]

  if (loading) {
    return <div className="p-8 text-sm text-[#666]">Cargando mesa de regalos...</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">

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
                  const res = byItem.get(item.id) || { count: 0, sum: 0 }
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
                            {res.count > 0
                              ? <span className="font-medium text-[#1a9e88]">Apartado por {res.count}</span>
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
            <div className="space-y-2.5">
              {reservations.map(r => {
                const gift = itemById.get(r.item_id)
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#1D1E20]">{r.guest_name}</p>
                      <p className="truncate text-xs text-[#888]">{gift?.title || 'Regalo'}</p>
                      {r.message && <p className="mt-1 line-clamp-2 text-xs italic text-[#999]">“{r.message}”</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {r.amount ? <span className="text-sm font-semibold tabular-nums text-[#1a9e88]">{fmtMXN(r.amount)}</span> : null}
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

        {/* ── Tab: Compartir ── */}
        {tab === 'compartir' && (
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4 sm:max-w-xl">
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
        )}

      </div>

      <AddGiftModal isOpen={showAdd} initial={editing} onClose={closeModal} onSubmit={handleSubmitGift} />
    </div>
  )
}
