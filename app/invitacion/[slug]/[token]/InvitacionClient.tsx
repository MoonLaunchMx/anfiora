'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { isInviteOpen, type RsvpSubmission } from '@/lib/invite'
import type { InviteDoc } from '@/lib/invite/schema'
import { botonClass } from '@/lib/invite/theme-css'
import type { DressCode } from '@/lib/dresscode'
import type { InviteCtx, InviteGuest, InviteCompanion } from '@/app/components/invitacion/types'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'
import RegistroForm from '@/app/components/invitacion/RegistroForm'

type ApiData = {
  event: InviteCtx['event']
  guest: InviteGuest | null
  companions: InviteCompanion[]
  doc: InviteDoc
  dressCode: DressCode | null
  itinerary: { start_time: string; title: string; location: string | null }[]
  tokens: { playlist: string | null; registry: string | null }
  mode: 'personal' | 'compartida'
  puerta: { seatsLeft: number | null; maxCompanions: number; agotado: boolean } | null
}

type Estado = 'ok' | 'no_existe' | 'cerrada'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function InvitacionClient({ token }: { token: string }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState<Estado>('ok')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`/api/invitacion/${token}`)
        if (!res.ok) {
          // 403 = el anfitrion cerro la puerta. No es lo mismo que un link malo.
          if (active) { setEstado(res.status === 403 ? 'cerrada' : 'no_existe'); setLoading(false) }
          return
        }
        const json = (await res.json()) as ApiData
        if (active) { setData(json); setLoading(false) }
      } catch {
        if (active) { setEstado('no_existe'); setLoading(false) }
      }
    }
    load()
    return () => { active = false }
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (estado !== 'ok' || !data) {
    const cerrada = estado === 'cerrada'
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
        <Heart size={28} className="mb-3 text-[#d4a853]" />
        <h1 className="text-lg font-semibold text-[#1D1E20]">
          {cerrada ? 'Los registros están cerrados' : 'Invitación no disponible'}
        </h1>
        <p className="mt-1 max-w-xs text-sm text-[#888]">
          {cerrada
            ? 'El anfitrión cerró los registros de este evento. Si crees que es un error, escríbele.'
            : 'Revisa el link que te compartieron.'}
        </p>
      </div>
    )
  }

  const handleSubmit = async (payload: RsvpSubmission) => {
    const res = await fetch(`/api/invitacion/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('rsvp_failed')
    const result = await res.json() as { guest: { rsvp_status: string; allergies: string[] }; companions: InviteCompanion[] }
    setData(prev => prev && prev.guest ? {
      ...prev,
      guest: { ...prev.guest, rsvp_status: result.guest.rsvp_status, allergies: result.guest.allergies },
      companions: result.companions,
    } : prev)
  }

  const compartida = data.mode === 'compartida'

  const ctx: InviteCtx = {
    event: data.event,
    guest: data.guest,
    companions: data.companions,
    dressCode: data.dressCode,
    itinerary: data.itinerary,
    tokens: data.tokens,
    mode: compartida ? 'compartida' : 'public',
    onSubmit: compartida ? undefined : handleSubmit,
    deadlinePassed: !isInviteOpen(data.doc.meta, todayISO()),
    botonClassName: botonClass(data.doc.theme),
  }

  const agotado = compartida && data.puerta?.agotado === true
  const registro = compartida && data.puerta && !agotado && !ctx.deadlinePassed

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      <PreviewBoundary>
        <InvitacionRenderer doc={data.doc} ctx={ctx} />

        {registro && (
          <section className="px-6 pb-16 pt-4">
            <h2 className="mb-4 text-center text-lg font-semibold text-[#1D1E20]">Confirma tu asistencia</h2>
            <RegistroForm
              token={token}
              maxCompanions={data.puerta!.maxCompanions}
              botonClassName={ctx.botonClassName}
              onDone={rsvpToken => {
                // Se va a SU link personal: de ahi en adelante ve la invitacion
                // igual que un invitado de boda.
                window.location.href = window.location.pathname.replace(/[^/]+$/, rsvpToken)
              }}
            />
          </section>
        )}

        {/* El cupo lleno no es un 404: ve la fiesta y se entera de que se lleno. */}
        {agotado && (
          <section className="px-6 pb-16 pt-4">
            <div className="mx-auto max-w-sm rounded-xl border border-[#e8e8e8] bg-white/70 px-5 py-6 text-center">
              <h2 className="text-base font-semibold text-[#1D1E20]">Ya no quedan lugares</h2>
              <p className="mt-1 text-sm text-[#888]">Este evento llegó a su cupo. Escríbele al anfitrión por si se libera alguno.</p>
            </div>
          </section>
        )}

        {compartida && ctx.deadlinePassed && !agotado && (
          <section className="px-6 pb-16 pt-4">
            <div className="mx-auto max-w-sm rounded-xl border border-[#e8e8e8] bg-white/70 px-5 py-6 text-center">
              <h2 className="text-base font-semibold text-[#1D1E20]">Los registros ya cerraron</h2>
              <p className="mt-1 text-sm text-[#888]">La fecha límite para confirmar ya pasó. Escríbele al anfitrión si todavía quieres ir.</p>
            </div>
          </section>
        )}
      </PreviewBoundary>
    </div>
  )
}
