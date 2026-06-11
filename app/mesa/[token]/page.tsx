'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Gift, Coins, Mail, ExternalLink, Check, X, Heart, Copy, Landmark } from 'lucide-react'
import { GiftRegistryItem, RegistryPaymentMethod, normalizePaymentMethods } from '@/lib/types'

type Aggregates = Record<string, { count: number; sum: number }>
type EventInfo = {
  id: string
  name: string
  host_name: string | null
  host_name_2: string | null
  event_date: string | null
  venue: string | null
  event_type: string | null
}

const fmtMXN = (n: number) => '$ ' + (n || 0).toLocaleString('es-MX')

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${day} de ${months[month - 1]} de ${year}`
}

const josefin = { fontFamily: "'Josefin Sans', sans-serif" }

export default function MesaPublicaPage() {
  const { token } = useParams()

  const [event, setEvent]         = useState<EventInfo | null>(null)
  const [items, setItems]         = useState<GiftRegistryItem[]>([])
  const [agg, setAgg]             = useState<Aggregates>({})
  const [payMethods, setPayMethods] = useState<RegistryPaymentMethod[]>([])
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [active, setActive]       = useState<GiftRegistryItem | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/mesa/${token}`)
        if (!res.ok) { setNotFound(true); setLoading(false); return }
        const data = await res.json()
        setEvent(data.event)
        setItems(data.items || [])
        setAgg(data.aggregates || {})
        setPayMethods(normalizePaymentMethods(data.payment_info))
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const onReserved = (item: GiftRegistryItem, amount: number | null) => {
    setAgg(prev => {
      const cur = prev[item.id] || { count: 0, sum: 0 }
      return { ...prev, [item.id]: { count: cur.count + 1, sum: cur.sum + (amount || 0) } }
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (notFound || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
        <Gift size={32} className="mb-3 text-[#bbb]" />
        <h1 className="text-lg font-semibold text-[#1D1E20]">Mesa no encontrada</h1>
        <p className="mt-1 text-sm text-[#888]">Revisa el link que te compartieron.</p>
      </div>
    )
  }

  const couple = event.host_name && event.host_name_2
    ? `${event.host_name} & ${event.host_name_2}`
    : event.name

  return (
    <div className="min-h-screen bg-[#FBF7F0]">

      {/* Hero */}
      <section className="mx-auto max-w-2xl px-6 pb-8 pt-14 text-center sm:pt-20">
        <p className="mb-5 text-[11px] uppercase tracking-[0.3em] text-[#aaa]" style={josefin}>
          Mesa de regalos
        </p>
        <h1 className="text-4xl font-bold leading-tight text-[#1D1E20] sm:text-5xl" style={josefin}>
          {couple}
        </h1>
        {event.event_date && (
          <p className="mt-4 text-sm tracking-wide text-[#666]" style={josefin}>{formatEventDate(event.event_date)}</p>
        )}
        {event.venue && <p className="mt-1 text-xs text-[#999]">{event.venue}</p>}
        <p className="mx-auto mt-7 max-w-md text-sm leading-relaxed text-[#666]">
          Su presencia es nuestro mayor regalo. Si desean consentirnos, prepararamos esta mesa con mucho cariño.
        </p>
      </section>

      {/* Lista */}
      <section className="mx-auto max-w-2xl px-4 pb-20 sm:px-6">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#e0d9cc] bg-white/60 px-6 py-12 text-center text-sm text-[#999]">
            Esta mesa aun no tiene regalos.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const a = agg[item.id] || { count: 0, sum: 0 }
              const pct = item.type === 'fund' && item.target_amount
                ? Math.min(100, Math.round((a.sum / item.target_amount) * 100))
                : 0
              const taken = item.type === 'external' && a.count > 0
              const done  = item.type === 'fund' && item.target_amount ? a.sum >= item.target_amount : false

              return (
                <article key={item.id} className="flex gap-4 rounded-2xl border border-[#eee4d6] bg-white p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f0fdfb] sm:h-24 sm:w-24">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#48C9B0]">
                        {item.type === 'fund' ? <Coins size={26} /> : item.type === 'cash' ? <Mail size={26} /> : <Gift size={26} />}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    {item.store && <span className="text-[10px] uppercase tracking-wider text-[#aaa]">{item.store}</span>}
                    <h3 className="text-base font-semibold leading-snug text-[#1D1E20]" style={josefin}>{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#888]">{item.description}</p>
                    )}

                    {item.type === 'fund' && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#f0ece3]">
                          <div className="h-full rounded-full bg-[#48C9B0]" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] tabular-nums text-[#888]">
                          {fmtMXN(a.sum)}{item.target_amount ? ` de ${fmtMXN(item.target_amount)}` : ''}
                        </p>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums text-[#1D1E20]">
                        {item.type === 'external' && item.price ? fmtMXN(item.price) : ''}
                        {item.type === 'cash' ? <span className="font-normal italic text-[#999]">Monto libre</span> : ''}
                      </span>
                      {done ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-[#1a9e88]">
                          <Heart size={13} fill="currentColor" /> Completo
                        </span>
                      ) : taken ? (
                        <span className="rounded-full bg-[#f0fdfb] px-3 py-1.5 text-xs font-medium text-[#1a9e88]">Ya apartado</span>
                      ) : (
                        <button
                          onClick={() => setActive(item)}
                          className="rounded-full bg-[#48C9B0] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
                        >
                          {item.type === 'external' ? 'Lo regalo' : item.type === 'cash' ? 'Dejar sobre' : 'Aportar'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-[#eee4d6] bg-[#F5EFE3] py-6 text-center">
        <p className="text-base font-bold tracking-wide text-[#1D1E20]" style={josefin}>Anfiora</p>
        <p className="mt-1 text-[11px] text-[#aaa]">Tu mesa de regalos</p>
      </footer>

      {active && (
        <ReserveModal
          token={token as string}
          item={active}
          payMethods={payMethods}
          onClose={() => setActive(null)}
          onReserved={onReserved}
        />
      )}
    </div>
  )
}

const PAY_LABEL: Record<string, string> = {
  transfer:     'Transferencia',
  card:         'Tarjeta',
  mercado_pago: 'Mercado Pago',
  paypal:       'PayPal',
  zelle:        'Zelle',
  other:        'Otro',
}

function ReserveModal({
  token, item, payMethods, onClose, onReserved,
}: {
  token: string
  item: GiftRegistryItem
  payMethods: RegistryPaymentMethod[]
  onClose: () => void
  onReserved: (item: GiftRegistryItem, amount: number | null) => void
}) {
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [amount, setAmount]       = useState(item.type === 'external' && item.price ? String(item.price) : '')
  const [message, setMessage]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')
  const [copiedId, setCopiedId]   = useState<string | null>(null)

  const needsAmount = item.type !== 'external'
  const showPayment = needsAmount && payMethods.length > 0

  const copyValue = async (m: RegistryPaymentMethod) => {
    await navigator.clipboard.writeText(m.value)
    setCopiedId(m.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const submit = async () => {
    if (!name.trim()) { setError('Escribe tu nombre'); return }
    if (needsAmount && !(parseFloat(amount) > 0)) { setError('Escribe un monto'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/mesa/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          guest_name: name.trim(),
          guest_phone: phone.trim() || null,
          amount: needsAmount ? parseFloat(amount) : null,
          message: message.trim() || null,
        }),
      })
      if (!res.ok) { setError('No se pudo registrar. Intenta de nuevo.'); setSubmitting(false); return }
      onReserved(item, needsAmount ? parseFloat(amount) : null)
      setSuccess(true)
    } catch {
      setError('Sin conexion. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'
  const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]'

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">

          {success ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fdfb] text-[#1a9e88]">
                <Check size={28} strokeWidth={2.4} />
              </div>
              <h3 className="text-xl font-bold text-[#1D1E20]" style={josefin}>¡Gracias, {name.split(' ')[0]}!</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#666]">
                {item.type === 'external'
                  ? <>Marcamos <strong>“{item.title}”</strong> como apartado por ti.</>
                  : <>Registramos tu {item.type === 'cash' ? 'sobre' : 'aporte'} de <strong>{fmtMXN(parseFloat(amount))}</strong>.</>}
              </p>
              {showPayment && (
                <div className="mx-auto mt-5 max-w-xs rounded-xl border border-[#eee4d6] bg-[#FBF7F0] p-4 text-left">
                  <div className="mb-2.5 flex items-center gap-1.5 text-[#1a9e88]">
                    <Landmark size={14} />
                    <p className="text-[11px] font-semibold uppercase tracking-wider">¿Cómo prefieres hacerlo llegar?</p>
                  </div>
                  <div className="space-y-2">
                    {payMethods.map(m => {
                      const isLink = m.type === 'mercado_pago' || m.type === 'paypal' ||
                        (m.type === 'other' && /^https?:\/\//i.test(m.value))
                      const title = m.type === 'other' && m.label ? m.label : PAY_LABEL[m.type]
                      if (isLink) {
                        return (
                          <a
                            key={m.id}
                            href={m.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
                          >
                            <ExternalLink size={13} /> Pagar con {title}
                          </a>
                        )
                      }
                      const sub = [m.bank, m.holder].filter(Boolean).join(' · ')
                      return (
                        <div key={m.id} className="rounded-lg border border-[#eee4d6] bg-white p-2.5">
                          <p className="text-[11px] font-semibold text-[#1D1E20]">
                            {title}{sub && <span className="ml-1 font-normal text-[#999]">{sub}</span>}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="break-all text-xs font-medium tabular-nums text-[#1D1E20]">{m.value}</span>
                            <button
                              onClick={() => copyValue(m)}
                              className="flex shrink-0 items-center gap-1 rounded-md border border-[#e0e0e0] px-2 py-1 text-[10px] font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
                            >
                              {copiedId === m.id ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {item.type === 'external' && item.external_url && (
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3aa896]"
                >
                  <ExternalLink size={15} /> Ir a la tienda
                </a>
              )}
              <button onClick={onClose} className="mt-3 block w-full rounded-lg px-4 py-2 text-sm font-medium text-[#666] transition hover:bg-[#f5f5f5]">
                Volver a la mesa
              </button>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-start justify-between border-b border-[#f0f0f0] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#48C9B0]">
                    {item.type === 'external' ? 'Vas a apartar' : item.type === 'cash' ? 'Dejar un sobre' : 'Aportar a'}
                  </p>
                  <h3 className="truncate text-base font-bold text-[#1D1E20]">{item.title}</h3>
                </div>
                <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#aaa] transition hover:bg-[#f5f5f5]">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>¿Cómo te firmamos?</label>
                    <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Familia Rodríguez" />
                  </div>

                  {needsAmount && (
                    <div>
                      <label className={labelCls}>{item.type === 'cash' ? 'Monto del sobre (MXN)' : 'Monto a aportar (MXN)'}</label>
                      <input
                        className={`${inputCls} tabular-nums`}
                        inputMode="decimal"
                        value={amount}
                        onChange={e => {
                          const c = e.target.value.replace(/[^0-9.]/g, '')
                          if (c.split('.').length > 2) return
                          setAmount(c)
                        }}
                        placeholder="1500"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[500, 1000, 2500, 5000].map(v => (
                          <button key={v} type="button" onClick={() => setAmount(String(v))}
                            className="rounded-full border border-[#e0e0e0] bg-white px-2.5 py-1 text-[11px] text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
                            {fmtMXN(v)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Tu WhatsApp <span className="font-normal text-[#bbb]">(opcional)</span></label>
                    <input className={inputCls} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 55 1234 5678" />
                    <p className="mt-1 text-[10px] text-[#aaa]">Para que los anfitriones puedan agradecerte.</p>
                  </div>

                  <div>
                    <label className={labelCls}>Mensaje para los novios <span className="font-normal text-[#bbb]">(opcional)</span></label>
                    <textarea className={`${inputCls} resize-none`} rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="Unas palabras de felicitación..." />
                  </div>

                  {error && <p className="text-xs text-[#cc3333]">{error}</p>}
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
                <button onClick={onClose} disabled={submitting} className="rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={submit} disabled={submitting} className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50">
                  {submitting ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
