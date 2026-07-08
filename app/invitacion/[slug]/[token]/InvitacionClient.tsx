'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { isInviteOpen, type RsvpSubmission } from '@/lib/invite'
import type { InviteDoc } from '@/lib/invite/schema'
import type { DressCode } from '@/lib/dresscode'
import type { InviteCtx, InviteGuest, InviteCompanion } from '@/app/components/invitacion/types'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'

type ApiData = {
  event: InviteCtx['event']
  guest: InviteGuest
  companions: InviteCompanion[]
  doc: InviteDoc
  dressCode: DressCode | null
  itinerary: { start_time: string; title: string; location: string | null }[]
  tokens: { playlist: string | null; registry: string | null }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function InvitacionClient({ token }: { token: string }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`/api/invitacion/${token}`)
        if (!res.ok) {
          if (active) { setNotFound(true); setLoading(false) }
          return
        }
        const json = (await res.json()) as ApiData
        if (active) { setData(json); setLoading(false) }
      } catch {
        if (active) { setNotFound(true); setLoading(false) }
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

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
        <Heart size={28} className="mb-3 text-[#d4a853]" />
        <h1 className="text-lg font-semibold text-[#1D1E20]">Invitación no disponible</h1>
        <p className="mt-1 text-sm text-[#888]">Revisa el link que te compartieron.</p>
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
    setData(prev => prev ? {
      ...prev,
      guest: { ...prev.guest, rsvp_status: result.guest.rsvp_status, allergies: result.guest.allergies },
      companions: result.companions,
    } : prev)
  }

  const ctx: InviteCtx = {
    event: data.event,
    guest: data.guest,
    companions: data.companions,
    dressCode: data.dressCode,
    itinerary: data.itinerary,
    tokens: data.tokens,
    mode: 'public',
    onSubmit: handleSubmit,
    deadlinePassed: !isInviteOpen(data.doc.meta, todayISO()),
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      <div className="mx-auto max-w-[480px]">
        <PreviewBoundary>
          <InvitacionRenderer doc={data.doc} ctx={ctx} />
        </PreviewBoundary>
      </div>
    </div>
  )
}
