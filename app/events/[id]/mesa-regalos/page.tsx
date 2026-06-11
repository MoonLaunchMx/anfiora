'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Gift, Plus, Link2, Copy, Check, Trash2, ExternalLink, Coins, Mail, Heart,
} from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { GiftRegistryItem, GiftReservation } from '@/lib/types'
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

  const [items, setItems]               = useState<GiftRegistryItem[]>([])
  const [reservations, setReservations] = useState<GiftReservation[]>([])
  const [token, setToken]               = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
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

  const handleAddGift = async (data: NewGiftData) => {
    const { data: inserted } = await supabase
      .from('gift_registry_items')
      .insert({ event_id: eventId, ...data })
      .select()
      .single()
    if (inserted) setItems(prev => [inserted as GiftRegistryItem, ...prev])
  }

  const handleDeleteGift = async (itemId: string) => {
    if (!confirm('¿Eliminar este regalo de la mesa?')) return
    await supabase.from('gift_registry_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
    setReservations(prev => prev.filter(r => r.item_id !== itemId))
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

  const totalIntent = reservations.reduce((a, r) => a + (r.amount || 0), 0)
  const reservedItems = new Set(reservations.map(r => r.item_id)).size

  const visible = items.filter(i => filter === 'all' || i.type === filter)

  if (loading) {
    return <div className="p-8 text-sm text-[#666]">Cargando mesa de regalos...</div>
  }

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-[#e8e8e8] px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Mesa de regalos</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">
              Arma tu mesa y compártela. Tus invitados apartan o registran su intención de regalo.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] sm:text-sm"
          >
            <Plus size={15} /> <span className="hidden sm:inline">Agregar regalo</span><span className="sm:hidden">Agregar</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">

        {/* Share link */}
        <div className="mb-5 rounded-xl border border-[#e8e8e8] bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 size={15} className="text-[#48C9B0]" />
            <h2 className="text-sm font-semibold text-[#1D1E20]">Link público de tu mesa</h2>
          </div>
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
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#888]">Genera el link para que tus invitados puedan ver y apartar regalos.</p>
              <button
                onClick={handleGenerateLink}
                className="flex items-center gap-1.5 rounded-lg bg-[#1D1E20] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
              >
                <Link2 size={14} /> Generar link
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-3">
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

        {/* Filtros */}
        {items.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
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
        )}

        {/* Lista */}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-[#fafafa] px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#bbb]">
              <Gift size={22} />
            </div>
            <p className="text-sm font-semibold text-[#1D1E20]">Tu mesa está vacía</p>
            <p className="mt-1 text-xs text-[#888]">Agrega tu primer regalo para empezar a recibir detalles.</p>
            <button
              onClick={() => setShowAdd(true)}
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
                <div key={item.id} className="flex gap-3 rounded-xl border border-[#e8e8e8] bg-white p-3">
                  {/* Imagen / icono */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f0fdfb]">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#48C9B0]">
                        {item.type === 'fund' ? <Coins size={22} /> : item.type === 'cash' ? <Mail size={22} /> : <Gift size={22} />}
                      </div>
                    )}
                  </div>

                  {/* Info */}
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
                      {item.store && (
                        <span className="text-[10px] text-[#aaa]">{item.store}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-[#1D1E20]">{item.title}</p>

                    {/* Estado por tipo */}
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

                  {/* Acciones */}
                  <div className="flex shrink-0 flex-col items-end justify-between">
                    <button
                      onClick={() => handleDeleteGift(item.id)}
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
      </div>

      <AddGiftModal isOpen={showAdd} onClose={() => setShowAdd(false)} onSubmit={handleAddGift} />
    </div>
  )
}
