'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolveDoc } from '@/lib/invite/doc'
import { botonClass } from '@/lib/invite/theme-css'
import { parseDressCode, type DressCode } from '@/lib/dresscode'
import { getGuestItinerary } from '@/lib/guest-itinerary'
import type { GuestItineraryItem } from '@/lib/types'
import type { InviteDoc } from '@/lib/invite/schema'
import type { InviteCtx } from '@/app/components/invitacion/types'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'

type EventInfo = InviteCtx['event']

async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await p
    return error ? null : data
  } catch {
    return null
  }
}

export default function InvitacionPreviewPage() {
  const { id } = useParams()
  const eventId = id as string

  const [doc, setDoc] = useState<InviteDoc | null>(null)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [dressCode, setDressCode] = useState<DressCode | null>(null)
  const [playlistToken, setPlaylistToken] = useState<string | null>(null)
  const [registryToken, setRegistryToken] = useState<string | null>(null)
  const [itinerary, setItinerary] = useState<GuestItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        setDenied(true)
        setLoading(false)
        return
      }

      const [ev, inviteRow, dressRow, itinRows] = await Promise.all([
        supabase
          .from('events')
          .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
          .eq('id', eventId)
          .single(),
        safeSingle<{ invite_config: unknown; invite_draft: unknown; playlist_token: string | null; registry_token: string | null }>(
          supabase.from('event_settings').select('invite_config, invite_draft, playlist_token, registry_token').eq('event_id', eventId).maybeSingle(),
        ),
        safeSingle<{ dress_code: unknown }>(
          supabase.from('event_settings').select('dress_code').eq('event_id', eventId).maybeSingle(),
        ),
        getGuestItinerary(eventId),
      ])
      if (!ev.data) {
        setDenied(true)
        setLoading(false)
        return
      }
      setEvent(ev.data)
      setDressCode(parseDressCode(dressRow?.dress_code))
      setPlaylistToken(inviteRow?.playlist_token ?? null)
      setRegistryToken(inviteRow?.registry_token ?? null)
      setItinerary(itinRows)
      // El preview del editor muestra el BORRADOR: es lo que el organizador esta editando.
      setDoc(resolveDoc(inviteRow?.invite_draft ?? inviteRow?.invite_config, () => crypto.randomUUID()))
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (denied || !doc || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
        <Heart size={28} className="mb-3 text-[#d4a853]" />
        <h1 className="text-lg font-semibold text-[#1D1E20]">Vista previa no disponible</h1>
        <p className="mt-1 text-sm text-[#888]">Inicia sesión como organizador del evento.</p>
      </div>
    )
  }

  const ctx: InviteCtx = {
    event,
    guest: { name: 'Invitado de ejemplo', party_size: 3, rsvp_status: 'pending', allergies: [] },
    companions: [
      { name: 'Acompañante 1', rsvp_status: 'pending', allergies: [] },
      { name: 'Acompañante 2', rsvp_status: 'pending', allergies: [] },
    ],
    dressCode,
    itinerary,
    tokens: { playlist: playlistToken, registry: registryToken },
    mode: 'preview',
    botonClassName: botonClass(doc.theme),
    onSubmit: undefined,
    deadlinePassed: false,
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      <PreviewBoundary>
        <InvitacionRenderer doc={doc} ctx={ctx} />
      </PreviewBoundary>
    </div>
  )
}
