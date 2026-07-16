'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Check, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { slugifyEvent } from '@/lib/invite'
import {
  ACCESS_MODES, resolveAccessMode, resolveRequiresApproval, normalizeAccessFields,
  resolveMaxCompanions, CANDADOS_PUERTA_LISTOS, type AccessMode,
} from '@/lib/features'

type EventInfo = {
  name: string
  event_type: string | null
  host_name: string | null
  host_name_2: string | null
}

// El acceso vive aqui, junto a los links, porque contesta la misma pregunta que
// la pestana Enviar: como entra la gente a este evento. Antes estaba en
// configuracion, partido de los links personales que siempre vivieron aqui.
export default function AccesoPanel({ eventId, event }: { eventId: string; event: EventInfo }) {
  const [accessMode, setAccessMode] = useState<AccessMode>('privada')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [guestCap, setGuestCap] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [maxCompanions, setMaxCompanions] = useState('')
  const [sharedToken, setSharedToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [ev, st] = await Promise.all([
        supabase.from('events').select('guest_cap, ticket_price').eq('id', eventId).maybeSingle(),
        supabase.from('event_settings').select('access_mode, requires_approval, shared_token, max_companions').eq('event_id', eventId).maybeSingle(),
      ])
      if (cancelled) return
      const tipo = event.event_type
      setAccessMode(resolveAccessMode(tipo, st.data?.access_mode))
      setRequiresApproval(resolveRequiresApproval(tipo, st.data?.access_mode, st.data?.requires_approval))
      setGuestCap(ev.data?.guest_cap != null ? String(ev.data.guest_cap) : '')
      setTicketPrice(ev.data?.ticket_price != null ? String(ev.data.ticket_price) : '')
      setMaxCompanions(String(resolveMaxCompanions(tipo, st.data?.max_companions)))
      setSharedToken(st.data?.shared_token ?? null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventId, event.event_type])

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const persist = useCallback(async (next: {
    accessMode: AccessMode; requiresApproval: boolean; guestCap: string; ticketPrice: string; maxCompanions: string
  }) => {
    setSaving(true)
    try {
      // Mientras los candados no existan, no se guardan (ver CANDADOS_PUERTA_LISTOS).
      const access = normalizeAccessFields({
        ...next,
        ticketPrice: CANDADOS_PUERTA_LISTOS ? next.ticketPrice : '',
        requiresApproval: CANDADOS_PUERTA_LISTOS ? next.requiresApproval : false,
      })
      // Entero >= 0; vacio o invalido = null (cae al default del tipo de evento).
      const mc = next.maxCompanions.trim() === '' ? null : Math.max(0, Math.floor(Number(next.maxCompanions)) || 0)
      await supabase.from('events')
        .update({ guest_cap: access.guest_cap, ticket_price: access.ticket_price })
        .eq('id', eventId)
      await supabase.from('event_settings').upsert({
        event_id: eventId,
        access_mode: next.accessMode,
        requires_approval: access.requires_approval,
        max_companions: mc,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'event_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [eventId])

  const schedule = (next: Partial<{ accessMode: AccessMode; requiresApproval: boolean; guestCap: string; ticketPrice: string; maxCompanions: string }>) => {
    const merged = { accessMode, requiresApproval, guestCap, ticketPrice, maxCompanions, ...next }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => persist(merged), 800)
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
              onClick={() => { setAccessMode(m.key); schedule({ accessMode: m.key }) }}
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
          {CANDADOS_PUERTA_LISTOS && (
            <button
              type="button"
              onClick={() => { const v = !requiresApproval; setRequiresApproval(v); schedule({ requiresApproval: v }) }}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="acc-cap" className="mb-1 block text-xs font-medium text-[#666]">Cupo máximo</label>
              <input
                id="acc-cap"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={guestCap}
                onChange={e => { setGuestCap(e.target.value); schedule({ guestCap: e.target.value }) }}
                placeholder="Sin límite"
                className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]"
              />
            </div>
            <div>
              <label htmlFor="acc-companions" className="mb-1 block text-xs font-medium text-[#666]">Acompañantes por invitado</label>
              <input
                id="acc-companions"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={maxCompanions}
                onChange={e => { setMaxCompanions(e.target.value); schedule({ maxCompanions: e.target.value }) }}
                placeholder="0"
                className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]"
              />
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-[#aaa]">Cuántos puede llevar cada quien. 0 = va solo.</p>

          {CANDADOS_PUERTA_LISTOS && (
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
                  onChange={e => { setTicketPrice(e.target.value); schedule({ ticketPrice: e.target.value }) }}
                  placeholder="Gratis"
                  className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 pr-14 text-sm outline-none focus:border-[#48C9B0]"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#aaa]">
                  MXN
                </span>
              </div>
            </div>
          )}
          {CANDADOS_PUERTA_LISTOS && (
            <p className="-mt-1 text-[11px] text-[#aaa]">Anfiora no procesa el pago. Tú recibes el dinero directo.</p>
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
    </div>
  )
}
