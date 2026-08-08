'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Check, UserCheck, Landmark, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { slugifyEvent } from '@/lib/invite'
import { setMeta } from '@/lib/invite/doc'
import type { InviteDoc, InviteAccess } from '@/lib/invite/schema'
import {
  ACCESS_MODES, resolveAccessMode, resolveRequiresApproval, resolveMaxCompanions,
  parseCap, parsePrice, CANDADO_PRECIO_LISTO, CANDADO_APROBACION_LISTO, type AccessMode,
} from '@/lib/features'
import { RegistryPaymentMethod } from '@/lib/types'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import PaymentMethodModal, { payTypeMeta } from '../mesa-regalos/PaymentMethodModal'

type EventInfo = {
  name: string
  event_type: string | null
  host_name: string | null
  host_name_2: string | null
}

// Entero >= 0; vacio o invalido = null (cae al default del tipo de evento).
function parseMaxCompanions(raw: string): number | null {
  if (raw.trim() === '') return null
  return Math.max(0, Math.floor(Number(raw)) || 0)
}

// El acceso vive aqui, junto a los links, porque contesta la misma pregunta que
// la pestana Enviar: como entra la gente a este evento. Antes estaba en
// configuracion, partido de los links personales que siempre vivieron aqui.
//
// Cupo, acompanantes, precio y cuenta de cobro viven en el BORRADOR de la
// invitacion (doc.meta.access) y se publican con el resto del contenido. El
// modo privada/publica es el apagador de la puerta: se queda escribiendo en
// vivo a event_settings, fuera del doc (ver enmienda 17-jul en el spec de
// cobro por transferencia).
export default function AccesoPanel({
  eventId, event, doc, onChange,
}: {
  eventId: string
  event: EventInfo
  doc: InviteDoc
  onChange: (next: InviteDoc) => void
}) {
  const askConfirm = useConfirm()
  const [accessMode, setAccessMode] = useState<AccessMode>('privada')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [sharedToken, setSharedToken] = useState<string | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState<RegistryPaymentMethod | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Buffers de texto para cupo/precio/acompanantes: el doc guarda numero, el
  // input necesita string libre mientras se teclea (ej. "12." antes del decimal).
  const [guestCap, setGuestCap] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [maxCompanions, setMaxCompanions] = useState('')
  // Guarda el objeto access que YO mande via onChange, para distinguir un
  // doc.meta.access que cambio por mi propia tecla (ignorar, no repisar el
  // buffer a medio teclear) de uno que cambio desde afuera (publicar,
  // descartar, carga inicial: ahi si hay que resincronizar los inputs).
  const lastSentAccessRef = useRef<InviteAccess | null>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const st = await supabase
        .from('event_settings')
        .select('access_mode, requires_approval, shared_token')
        .eq('event_id', eventId)
        .maybeSingle()
      if (cancelled) return
      const tipo = event.event_type
      setAccessMode(resolveAccessMode(tipo, st.data?.access_mode))
      setRequiresApproval(resolveRequiresApproval(tipo, st.data?.access_mode, st.data?.requires_approval))
      setSharedToken(st.data?.shared_token ?? null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventId, event.event_type])

  useEffect(() => {
    if (doc.meta.access === lastSentAccessRef.current) return
    setGuestCap(doc.meta.access.guest_cap != null ? String(doc.meta.access.guest_cap) : '')
    setTicketPrice(doc.meta.access.ticket_price != null ? String(doc.meta.access.ticket_price) : '')
    setMaxCompanions(String(resolveMaxCompanions(event.event_type, doc.meta.access.max_companions)))
  }, [doc.meta.access, event.event_type])

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  // Solo el modo (y su aprobacion) siguen en vivo: es el apagador de la puerta.
  const persistMode = useCallback(async (next: { accessMode: AccessMode; requiresApproval: boolean }) => {
    setSaving(true)
    try {
      const requires_approval = next.accessMode === 'privada'
        ? false
        : (CANDADO_APROBACION_LISTO ? next.requiresApproval : false)
      await supabase.from('event_settings').upsert({
        event_id: eventId,
        access_mode: next.accessMode,
        requires_approval,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'event_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [eventId])

  const scheduleMode = (next: Partial<{ accessMode: AccessMode; requiresApproval: boolean }>) => {
    const merged = { accessMode, requiresApproval, ...next }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => persistMode(merged), 800)
  }

  // Cupo, acompanantes, precio y cuenta de cobro: al borrador, no a Supabase.
  // updateDoc (en el page) ya autoguarda el borrador y dispara el sello de
  // "cambios sin publicar" + el aviso al salir.
  const updateAccess = (patch: Partial<InviteAccess>) => {
    const nextAccess: InviteAccess = { ...doc.meta.access, ...patch }
    lastSentAccessRef.current = nextAccess
    onChange(setMeta(doc, { access: nextAccess }))
  }

  if (loading) {
    return (
      <div className="mb-5 flex items-center justify-center rounded-xl border border-[#e8e8e8] bg-white py-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  const sharedLink = sharedToken
    ? `${origin}/invitacion/${slugifyEvent({ name: event.name, host_name: event.host_name, host_name_2: event.host_name_2 })}/${sharedToken}`
    : ''

  const payMethods = doc.meta.access.cobro_payment_methods

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#e8e8e8] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1D1E20]">¿Cómo entra la gente?</h2>
        <span className="text-xs text-[#aaa]">{saved ? 'Guardado' : saving ? 'Guardando...' : ''}</span>
      </div>

      <div className="flex flex-col gap-2">
        {ACCESS_MODES.map(m => {
          const Icon = m.icon
          const on = accessMode === m.key
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => { setAccessMode(m.key); scheduleMode({ accessMode: m.key }) }}
              className={
                'flex items-center gap-3 rounded-xl border p-3 text-left transition ' +
                (on ? 'border-[#c8ede7] bg-[#f0fdfb]' : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]')
              }
            >
              <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (on ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                <Icon size={18} className={on ? 'text-[#0F6E56]' : 'text-[#888]'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1D1E20]">{m.label}</p>
                <p className="mt-0.5 text-xs text-[#888]">{m.description}</p>
              </div>
              <div className={
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ' +
                (on ? 'border-[#48C9B0] bg-[#48C9B0]' : 'border-[#ddd] bg-white')
              }>
                {on && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </button>
          )
        })}
      </div>

      {accessMode === 'publica' && (
        <>
          {CANDADO_APROBACION_LISTO && (
            <button
              type="button"
              onClick={() => { const v = !requiresApproval; setRequiresApproval(v); scheduleMode({ requiresApproval: v }) }}
              className="flex items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white p-3 text-left transition hover:border-[#d0d0d0]"
            >
              <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (requiresApproval ? 'bg-[#d0f5ec]' : 'bg-[#f4f4f4]')}>
                <UserCheck size={18} className={requiresApproval ? 'text-[#0F6E56]' : 'text-[#888]'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1D1E20]">Aprobar cada solicitud</p>
                <p className="mt-0.5 text-xs text-[#888]">
                  {requiresApproval
                    ? 'Nadie entra a la lista hasta que tú lo apruebes.'
                    : 'Quien abra el link se registra y ya está en la lista.'}
                </p>
              </div>
              <div className={
                'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ' +
                (requiresApproval ? 'justify-end bg-[#48C9B0]' : 'justify-start bg-[#ddd]')
              }>
                <div className="h-4 w-4 rounded-full bg-white" />
              </div>
            </button>
          )}

          {/* Cupo, precio y acompanantes son la misma decision: quien entra y en
              que condiciones. En movil se apilan; el precio queda junto al cupo. */}
          <div className={'grid grid-cols-1 gap-3 ' + (CANDADO_PRECIO_LISTO ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            <div>
              <label htmlFor="acc-cap" className="mb-1 block text-xs font-medium text-[#666]">Cupo máximo</label>
              <input
                id="acc-cap"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={guestCap}
                onChange={e => { const v = e.target.value; setGuestCap(v); updateAccess({ guest_cap: parseCap(v) }) }}
                placeholder="Sin límite"
                className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]"
              />
              <p className="mt-1 text-[11px] leading-snug text-[#aaa]">Vacío = sin límite.</p>
            </div>
            {CANDADO_PRECIO_LISTO && (
              <div>
                <label htmlFor="acc-price" className="mb-1 block text-xs font-medium text-[#666]">Precio por persona</label>
                <div className="relative">
                  <input
                    id="acc-price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={ticketPrice}
                    onChange={e => { const v = e.target.value; setTicketPrice(v); updateAccess({ ticket_price: parsePrice(v) }) }}
                    placeholder="Gratis"
                    className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 pr-14 text-sm outline-none focus:border-[#48C9B0]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#aaa]">
                    MXN
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#aaa]">Anfiora no procesa el pago. Tú recibes el dinero directo.</p>
              </div>
            )}
            <div>
              <label htmlFor="acc-companions" className="mb-1 block text-xs font-medium text-[#666]">Acompañantes por invitado</label>
              <input
                id="acc-companions"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={maxCompanions}
                onChange={e => { const v = e.target.value; setMaxCompanions(v); updateAccess({ max_companions: parseMaxCompanions(v) }) }}
                placeholder="0"
                className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]"
              />
              <p className="mt-1 text-[11px] leading-snug text-[#aaa]">Cuántos puede llevar cada quien. 0 = va solo.</p>
            </div>
          </div>

          {CANDADO_PRECIO_LISTO && (
            <>
              <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Landmark size={14} className="text-[#48C9B0]" />
                  <h3 className="text-sm font-medium text-[#1D1E20]">¿A qué cuenta te pagan el boleto?</h3>
                </div>
                <p className="mb-2.5 text-xs text-[#888]">
                  El invitado verá estos datos para transferirte el cobro de esta invitación. Es una cuenta aparte
                  de Mesa de regalos — Anfiora no procesa el pago.
                </p>

                {payMethods.length > 0 && (
                  <div className="mb-2.5 divide-y divide-[#f0f0f0] rounded-lg border border-[#e8e8e8] bg-white">
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
                              type="button"
                              onClick={() => { setEditingMethod(m); setShowPayModal(true) }}
                              title="Editar"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-[#bbb] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await askConfirm({
                                  title: '¿Eliminar esta cuenta de cobro?',
                                  message: <>Tus invitados dejarán de ver <strong>{m.type === 'other' && m.label ? m.label : meta.label}</strong> como forma de pago.</>,
                                })
                                if (!ok) return
                                updateAccess({ cobro_payment_methods: payMethods.filter(x => x.id !== m.id) })
                              }}
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setEditingMethod(null); setShowPayModal(true) }}
                    className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
                  >
                    <Plus size={14} /> Agregar cuenta
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-3">
            <h3 className="text-sm font-medium text-[#1D1E20]">Link público</h3>
            {sharedToken ? (
              <>
                <p className="mt-0.5 text-xs text-[#888]">
                  Compártelo y cualquiera podrá registrarse. Si lo cambias a invitación directa, este link deja de funcionar.
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    readOnly
                    value={sharedLink}
                    onFocus={e => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-[#e8e8e8] bg-white px-3 py-2 text-xs text-[#666] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sharedLink)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-xs text-[#888]">Publica la invitación para generar el link público.</p>
            )}
          </div>
        </>
      )}

      <PaymentMethodModal
        isOpen={showPayModal}
        initial={editingMethod}
        onClose={() => { setShowPayModal(false); setEditingMethod(null) }}
        onSave={async m => {
          const exists = payMethods.some(x => x.id === m.id)
          const methods = exists ? payMethods.map(x => x.id === m.id ? m : x) : [...payMethods, m]
          updateAccess({ cobro_payment_methods: methods })
        }}
      />
    </div>
  )
}
