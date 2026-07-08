'use client'

import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { supabase } from '@/lib/supabase'
import { slugifyEvent } from '@/lib/invite'

type EventInfo = {
  name: string
  host_name: string | null
  host_name_2: string | null
}

type Guest = {
  id: string
  name: string
  phone: string | null
  rsvp_token: string | null
  rsvp_status: string
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmado', color: '#1a9e88', bg: '#f0fdfb' },
  declined: { label: 'Declinó', color: '#cc3333', bg: '#fff0f0' },
}
const DEFAULT_BADGE = { label: 'Pendiente', color: '#888888', bg: '#f2f2f2' }

function badgeFor(status: string): { label: string; color: string; bg: string } {
  return STATUS_BADGE[status] || DEFAULT_BADGE
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function RepartoLinks({ eventId, event }: { eventId: string; event: EventInfo }) {
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [tokensAvailable, setTokensAvailable] = useState(true)
  const [origin, setOrigin] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('guests')
          .select('id, name, phone, rsvp_token, rsvp_status')
          .eq('event_id', eventId)
          .order('name')
        if (error) throw error
        if (!cancelled) {
          setGuests((data || []) as Guest[])
          setTokensAvailable(true)
        }
      } catch {
        // rsvp_token puede no existir aun si el SQL de la feature no se ha corrido
        if (!cancelled) {
          setGuests([])
          setTokensAvailable(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [eventId])

  const slug = slugifyEvent(event)
  const buildLink = (guest: Guest) => `${origin}/invitacion/${slug}/${guest.rsvp_token}`

  const handleCopy = async (guest: Guest) => {
    if (!guest.rsvp_token) return
    try {
      await navigator.clipboard.writeText(buildLink(guest))
      setCopiedId(guest.id)
      setTimeout(() => setCopiedId(prev => (prev === guest.id ? null : prev)), 1800)
    } catch {}
  }

  const handleSendWhatsApp = (guest: Guest) => {
    if (!guest.rsvp_token || !guest.phone) return
    const digits = normalizePhone(guest.phone)
    if (!digits) return
    const mensaje = `Te comparto la invitación: ${buildLink(guest)}`
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  const noTokensYet = !tokensAvailable || guests.every(g => !g.rsvp_token)

  return (
    <div>
      {noTokensYet && (
        <div className="mb-4 rounded-lg border border-[#f0d080] bg-[#fffbf0] px-4 py-3 text-sm text-[#8a6d1a]">
          Publica la invitación para generar los links de tus invitados.
        </div>
      )}

      {guests.length === 0 ? (
        <div className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-4 py-10 text-center text-sm text-[#888]">
          No hay invitados en este evento todavía.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:hidden">
            {guests.map(guest => {
              const badge = badgeFor(guest.rsvp_status)
              const disabled = !guest.rsvp_token
              const hasPhone = !!guest.phone && normalizePhone(guest.phone).length > 0
              return (
                <div key={guest.id} className="rounded-lg border border-[#e8e8e8] bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1D1E20]">{guest.name}</p>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ color: badge.color, background: badge.bg }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleCopy(guest)}
                      disabled={disabled}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs font-semibold text-[#1D1E20] transition hover:bg-[#f8f8f8] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {copiedId === guest.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === guest.id ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      onClick={() => handleSendWhatsApp(guest)}
                      disabled={disabled || !hasPhone}
                      title={!hasPhone ? 'Este invitado no tiene teléfono registrado' : undefined}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FaWhatsapp size={13} /> Enviar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-[#e8e8e8] sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e8e8e8] bg-[#f8f8f8] text-left text-xs font-semibold uppercase tracking-wide text-[#999]">
                  <th className="px-4 py-3">Invitado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {guests.map(guest => {
                  const badge = badgeFor(guest.rsvp_status)
                  const disabled = !guest.rsvp_token
                  const hasPhone = !!guest.phone && normalizePhone(guest.phone).length > 0
                  return (
                    <tr key={guest.id} className="border-b border-[#f0f0f0] last:border-0">
                      <td className="px-4 py-3 font-medium text-[#1D1E20]">{guest.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: badge.color, background: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleCopy(guest)}
                            disabled={disabled}
                            className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-semibold text-[#1D1E20] transition hover:bg-[#f8f8f8] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {copiedId === guest.id ? <Check size={13} /> : <Copy size={13} />}
                            {copiedId === guest.id ? 'Copiado' : 'Copiar'}
                          </button>
                          <button
                            onClick={() => handleSendWhatsApp(guest)}
                            disabled={disabled || !hasPhone}
                            title={!hasPhone ? 'Este invitado no tiene teléfono registrado' : undefined}
                            className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FaWhatsapp size={13} /> Enviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
