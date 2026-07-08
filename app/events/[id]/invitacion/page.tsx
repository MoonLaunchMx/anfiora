'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Send, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolveDoc, setMeta } from '@/lib/invite/doc'
import type { InviteDoc } from '@/lib/invite/schema'
import { randomToken } from '@/lib/invite'
import { parseDressCode, type DressCode } from '@/lib/dresscode'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'
import type { InviteCtx } from '@/app/components/invitacion/types'
import DatePicker from '@/app/components/ui/DatePicker'
import BlockEditor from './BlockEditor'
import RepartoLinks from './RepartoLinks'

type TabKey = 'diseno' | 'enviar'

type EventInfo = {
  name: string
  event_type: string | null
  event_date: string | null
  event_time: string | null
  venue: string | null
  address: string | null
  host_name: string | null
  host_name_2: string | null
}

async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await p
    return error ? null : data
  } catch {
    return null
  }
}

export default function InvitacionPage() {
  const { id } = useParams()
  const eventId = id as string

  const [doc, setDoc] = useState<InviteDoc | null>(null)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [dressCode, setDressCode] = useState<DressCode | null>(null)
  const [playlistToken, setPlaylistToken] = useState<string | null>(null)
  const [registryToken, setRegistryToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('diseno')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const load = async () => {
      const [ev, inviteRow, dressRow] = await Promise.all([
        supabase
          .from('events')
          .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
          .eq('id', eventId)
          .single(),
        safeSingle<{ invite_config: unknown; playlist_token: string | null; registry_token: string | null }>(
          supabase.from('event_settings').select('invite_config, playlist_token, registry_token').eq('event_id', eventId).maybeSingle(),
        ),
        safeSingle<{ dress_code: unknown }>(
          supabase.from('event_settings').select('dress_code').eq('event_id', eventId).maybeSingle(),
        ),
      ])
      if (ev.data) setEvent(ev.data)
      setDressCode(parseDressCode(dressRow?.dress_code))
      setPlaylistToken(inviteRow?.playlist_token ?? null)
      setRegistryToken(inviteRow?.registry_token ?? null)
      setDoc(resolveDoc(inviteRow?.invite_config, () => crypto.randomUUID()))
    }
    load().finally(() => setLoading(false))
  }, [eventId])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  const persist = useCallback(async (next: InviteDoc) => {
    setSaving(true)
    try {
      await supabase
        .from('event_settings')
        .upsert({ event_id: eventId, invite_config: next, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [eventId])

  const updateDoc = (next: InviteDoc) => {
    setDoc(next)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => persist(next), 800)
  }

  const handlePublish = async () => {
    if (!doc) return
    const next = setMeta(doc, { publicada: true })
    setDoc(next)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setPublishing(true)
    try {
      await persist(next)
      const { data: pending, error } = await supabase
        .from('guests')
        .select('id')
        .eq('event_id', eventId)
        .is('rsvp_token', null)
      if (!error && pending && pending.length > 0) {
        await Promise.all(
          pending.map(g => supabase.from('guests').update({ rsvp_token: randomToken() }).eq('id', g.id)),
        )
      }
    } catch {
      // rsvp_token puede no existir aun si el SQL de la feature no se ha corrido; no bloquea publicar
    } finally {
      setPublishing(false)
    }
  }

  if (loading || !doc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#888]">
        No se pudo cargar el evento. Recarga la página o vuelve al inicio.
      </div>
    )
  }

  const sampleCtx: InviteCtx = {
    event,
    guest: { name: 'Invitado de ejemplo', party_size: 3, rsvp_status: 'pending', allergies: [] },
    companions: [
      { name: 'Acompañante 1', rsvp_status: 'pending', allergies: [] },
      { name: 'Acompañante 2', rsvp_status: 'pending', allergies: [] },
    ],
    dressCode,
    itinerary: [],
    tokens: { playlist: playlistToken, registry: registryToken },
    mode: 'preview',
    onSubmit: undefined,
    deadlinePassed: false,
  }

  const badgeClass = doc.meta.publicada
    ? 'border-[#c8ede7] bg-[#f0fdfb] text-[#1a9e88]'
    : 'border-[#e0e0e0] bg-[#f8f8f8] text-[#888]'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-4 pt-4 pb-4 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#1D1E20]">Invitación</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Arma la invitación digital que verán tus invitados.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2.5">
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${badgeClass}`}>
              {doc.meta.publicada ? 'Publicada' : 'Borrador'}
            </span>
            <div className="w-40">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Fecha límite</label>
              <DatePicker
                value={doc.meta.fecha_limite ?? ''}
                onChange={v => updateDoc(setMeta(doc, { fecha_limite: v || null }))}
                placeholder="Sin límite"
              />
            </div>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? (
                'Publicando...'
              ) : doc.meta.publicada ? (
                <><Check size={14} /> Publicada</>
              ) : (
                <><Send size={14} /> Publicar</>
              )}
            </button>
            <span className="w-16 shrink-0 text-right text-xs text-[#aaa]">
              {saved ? 'Guardado' : saving ? 'Guardando...' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-4 sm:px-6 lg:px-10">
        <div className="flex gap-6">
          {([
            { key: 'diseno', label: 'Diseño' },
            { key: 'enviar', label: 'Enviar' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'border-[#48C9B0] text-[#1D1E20]'
                  : 'border-transparent text-[#999] hover:text-[#1D1E20]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6 lg:px-10">
        {activeTab === 'diseno' ? (
          <div className="grid items-start gap-6 sm:grid-cols-[1fr_360px] lg:gap-8">
            <BlockEditor doc={doc} onChange={updateDoc} makeId={() => crypto.randomUUID()} />

            <div className="sm:sticky sm:top-0">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">Vista previa</p>
              <div className="flex justify-center">
                <div className="w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border-[10px] border-[#1D1E20] bg-[#1D1E20] shadow-xl">
                  <div className="h-[720px] overflow-y-auto overflow-x-hidden bg-[#FBF7F0]">
                    <PreviewBoundary>
                      <InvitacionRenderer doc={doc} ctx={sampleCtx} />
                    </PreviewBoundary>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <RepartoLinks eventId={eventId} event={event} />
        )}
      </div>
    </div>
  )
}
